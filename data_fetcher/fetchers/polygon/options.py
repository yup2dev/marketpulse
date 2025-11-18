"""Polygon.io Options Data Fetcher"""
import logging
import requests
from datetime import datetime
from typing import Any, Dict, List, Optional

from data_fetcher.fetchers.base import Fetcher
from data_fetcher.models.polygon.options import (
    OptionsQueryParams,
    OptionsContractData
)
from data_fetcher.utils.credentials import get_api_key

log = logging.getLogger(__name__)


class PolygonOptionsFetcher(
    Fetcher[OptionsQueryParams, OptionsContractData]
):
    """Polygon.io 옵션 데이터 Fetcher"""

    BASE_URL = "https://api.polygon.io"

    @staticmethod
    def transform_query(params: Dict[str, Any]) -> OptionsQueryParams:
        """쿼리 파라미터 변환"""
        return OptionsQueryParams(**params)

    @staticmethod
    def extract_data(
        query: OptionsQueryParams,
        credentials: Optional[Dict[str, str]] = None,
        **kwargs: Any
    ) -> Dict[str, Any]:
        """
        Polygon.io에서 옵션 데이터 추출

        Args:
            query: 쿼리 파라미터
            credentials: API 키 딕셔너리
            **kwargs: 추가 파라미터

        Returns:
            원시 데이터 딕셔너리
        """
        try:
            # API 키 조회
            api_key = get_api_key(
                credentials=credentials,
                api_name="Polygon.io",
                env_var="POLYGON_API_KEY"
            )

            # API 엔드포인트
            url = f"{PolygonOptionsFetcher.BASE_URL}/v3/reference/options/contracts"

            # 파라미터 설정
            params = {
                "apiKey": api_key,
                "underlying_ticker": query.underlying_ticker,
                "limit": query.limit or 100
            }

            # Optional 파라미터 추가
            if query.contract_type:
                params["contract_type"] = query.contract_type
            if query.expiration_date:
                params["expiration_date"] = query.expiration_date
            if query.expiration_date_gte:
                params["expiration_date.gte"] = query.expiration_date_gte
            if query.expiration_date_lte:
                params["expiration_date.lte"] = query.expiration_date_lte
            if query.strike_price:
                params["strike_price"] = query.strike_price
            if query.strike_price_gte:
                params["strike_price.gte"] = query.strike_price_gte
            if query.strike_price_lte:
                params["strike_price.lte"] = query.strike_price_lte

            # API 호출
            response = requests.get(url, params=params, timeout=30)
            response.raise_for_status()

            data = response.json()

            if data.get("status") != "OK":
                log.warning(f"Polygon API returned status: {data.get('status')}")

            return data

        except requests.exceptions.RequestException as e:
            log.error(f"Error fetching options from Polygon for {query.underlying_ticker}: {e}")
            raise
        except Exception as e:
            log.error(f"Unexpected error: {e}")
            raise

    @staticmethod
    def transform_data(
        query: OptionsQueryParams,
        data: Dict[str, Any],
        **kwargs: Any
    ) -> List[OptionsContractData]:
        """
        원시 데이터를 표준 모델로 변환

        Args:
            query: 쿼리 파라미터
            data: 원시 데이터
            **kwargs: 추가 파라미터

        Returns:
            OptionsContractData 리스트
        """
        results = data.get("results", [])

        if not results:
            log.info(f"No options data for {query.underlying_ticker}")
            return []

        options_list = []

        for item in results:
            try:
                # 만기일 파싱
                expiration_date = datetime.strptime(
                    item["expiration_date"], "%Y-%m-%d"
                ).date()

                # Bid-Ask 스프레드 계산
                bid_ask_spread = None
                bid = item.get("bid")
                ask = item.get("ask")
                if bid is not None and ask is not None:
                    bid_ask_spread = ask - bid

                option_data = OptionsContractData(
                    ticker=item["ticker"],
                    underlying_ticker=item["underlying_ticker"],
                    contract_type=item["contract_type"],
                    strike_price=item["strike_price"],
                    expiration_date=expiration_date,
                    last_price=item.get("last_price"),
                    bid=bid,
                    ask=ask,
                    bid_ask_spread=bid_ask_spread,
                    volume=item.get("volume"),
                    open_interest=item.get("open_interest"),
                    delta=item.get("delta"),
                    gamma=item.get("gamma"),
                    theta=item.get("theta"),
                    vega=item.get("vega"),
                    rho=item.get("rho"),
                    implied_volatility=item.get("implied_volatility"),
                    shares_per_contract=item.get("shares_per_contract", 100),
                    exercise_style=item.get("exercise_style")
                )

                options_list.append(option_data)

            except (KeyError, ValueError) as e:
                log.warning(f"Error parsing options data: {e}")
                continue

        log.info(f"Fetched {len(options_list)} options contracts for {query.underlying_ticker}")
        return options_list

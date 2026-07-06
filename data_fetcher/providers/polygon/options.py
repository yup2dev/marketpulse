"""Polygon.io Options provider (standard OptionsChains 모델 경유)"""
from data_fetcher.abstract_provider.standard_models.options_chains import (
    OptionsQueryParams,
    OptionsContractData,
    OptionsChainData,
)


"""Polygon.io Options Data Fetcher"""
import logging
from typing import Any, Dict, List, Optional

from data_fetcher.abstract_provider.abstract.base_fetchers import ApiFetcher
from data_fetcher.utils.api_keys import get_api_key
from data_fetcher.utils.async_http_client import amake_request, HTTPClientError

log = logging.getLogger(__name__)


class PolygonOptionsFetcher(
    ApiFetcher[OptionsQueryParams, OptionsContractData]
):
    """Polygon.io 옵션 데이터 Fetcher"""

    api_name = "Polygon"
    api_key_env = "POLYGON_API_KEY"

    BASE_URL = "https://api.polygon.io"

    @staticmethod
    def transform_query(params: Dict[str, Any]) -> OptionsQueryParams:
        """쿼리 파라미터 변환"""
        return OptionsQueryParams(**params)

    @staticmethod
    async def aextract_data(
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
            data = await amake_request(url, params=params, timeout=30)

            if data.get("status") != "OK":
                log.warning(f"Polygon API returned status: {data.get('status')}")

            return data

        except HTTPClientError as e:
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
                option_data = OptionsContractData.model_validate(item)
                if option_data.bid is not None and option_data.ask is not None:
                    option_data.bid_ask_spread = option_data.ask - option_data.bid
                options_list.append(option_data)
            except (KeyError, ValueError) as e:
                log.warning(f"Error parsing options data: {e}")
                continue

        log.info(f"Fetched {len(options_list)} options contracts for {query.underlying_ticker}")
        return options_list

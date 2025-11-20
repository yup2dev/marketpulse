"""Polygon.io Insider Trading Fetcher"""
import logging
import requests
from datetime import datetime
from typing import Any, Dict, List, Optional

from data_fetcher.fetchers.base import Fetcher
from data_fetcher.models.polygon.insider_trading import (
    InsiderTradingQueryParams,
    InsiderTradingData
)
from data_fetcher.utils.api_keys import get_api_key

log = logging.getLogger(__name__)


class PolygonInsiderTradingFetcher(
    Fetcher[InsiderTradingQueryParams, InsiderTradingData]
):
    """Polygon.io 내부자 거래 데이터 Fetcher"""

    BASE_URL = "https://api.polygon.io"

    @staticmethod
    def transform_query(params: Dict[str, Any]) -> InsiderTradingQueryParams:
        """쿼리 파라미터 변환"""
        return InsiderTradingQueryParams(**params)

    @staticmethod
    def extract_data(
        query: InsiderTradingQueryParams,
        credentials: Optional[Dict[str, str]] = None,
        **kwargs: Any
    ) -> Dict[str, Any]:
        """
        Polygon.io에서 내부자 거래 데이터 추출

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
            url = f"{PolygonInsiderTradingFetcher.BASE_URL}/v1/reference/insider-transactions"

            # 파라미터 설정
            params = {
                "apiKey": api_key,
                "ticker": query.ticker,
                "limit": query.limit or 100
            }

            if query.transaction_date_gte:
                params["transaction_date.gte"] = query.transaction_date_gte
            if query.transaction_date_lte:
                params["transaction_date.lte"] = query.transaction_date_lte

            # API 호출
            response = requests.get(url, params=params, timeout=30)
            response.raise_for_status()

            data = response.json()

            if data.get("status") != "OK":
                log.warning(f"Polygon API returned status: {data.get('status')}")

            return data

        except requests.exceptions.RequestException as e:
            log.error(f"Error fetching insider trading from Polygon for {query.ticker}: {e}")
            raise
        except Exception as e:
            log.error(f"Unexpected error: {e}")
            raise

    @staticmethod
    def transform_data(
        query: InsiderTradingQueryParams,
        data: Dict[str, Any],
        **kwargs: Any
    ) -> List[InsiderTradingData]:
        """
        원시 데이터를 표준 모델로 변환

        Args:
            query: 쿼리 파라미터
            data: 원시 데이터
            **kwargs: 추가 파라미터

        Returns:
            InsiderTradingData 리스트
        """
        results = data.get("results", [])

        if not results:
            log.info(f"No insider trading data for {query.ticker}")
            return []

        insider_list = []

        for item in results:
            try:
                # 날짜 파싱
                transaction_date = datetime.strptime(
                    item["transaction_date"], "%Y-%m-%d"
                ).date()

                filing_date = None
                if item.get("filing_date"):
                    filing_date = datetime.strptime(
                        item["filing_date"], "%Y-%m-%d"
                    ).date()

                # 거래 금액 계산
                transaction_value = None
                shares = item.get("shares_traded")
                price = item.get("price_per_share")
                if shares and price:
                    transaction_value = shares * price

                insider_data = InsiderTradingData(
                    ticker=query.ticker,
                    transaction_date=transaction_date,
                    filing_date=filing_date,
                    insider_name=item["insider_name"],
                    insider_title=item.get("insider_title"),
                    is_director=item.get("is_director"),
                    is_officer=item.get("is_officer"),
                    is_ten_percent_owner=item.get("is_ten_percent_owner"),
                    transaction_type=item["transaction_type"],
                    transaction_code=item.get("transaction_code"),
                    acquisition_or_disposition=item.get("acquisition_or_disposition"),
                    shares_traded=shares,
                    price_per_share=price,
                    transaction_value=transaction_value,
                    shares_owned_before=item.get("shares_owned_before_transaction"),
                    shares_owned_after=item.get("shares_owned_following_transaction"),
                    ownership_type=item.get("ownership_type"),
                    sec_form_type=item.get("sec_form_type"),
                    sec_link=item.get("sec_link")
                )

                insider_list.append(insider_data)

            except (KeyError, ValueError) as e:
                log.warning(f"Error parsing insider trading data: {e}")
                continue

        log.info(f"Fetched {len(insider_list)} insider trading records for {query.ticker}")
        return insider_list

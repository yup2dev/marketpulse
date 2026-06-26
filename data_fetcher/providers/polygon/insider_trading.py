"""Polygon.io Insider Trading Model"""
from datetime import date as date_type
from typing import Optional
from pydantic import Field, model_validator
from data_fetcher.abstract_provider.standard_models import InsiderTradingQueryParams as _StdInsiderTradingQueryParams
from data_fetcher.abstract_provider.standard_models import InsiderTradingData


class InsiderTradingQueryParams(_StdInsiderTradingQueryParams):
    """내부자 거래 조회 파라미터"""

    ticker: Optional[str] = Field(
        default=None,
        description="종목 티커 (예: AAPL, TSLA). 미지정 시 표준 symbol에서 채운다."
    )

    @model_validator(mode="after")
    def _ticker_from_symbol(self):
        if not self.ticker:
            self.ticker = self.symbol
        return self
    transaction_date_gte: Optional[str] = Field(
        default=None,
        description="거래일 >= (YYYY-MM-DD)"
    )
    transaction_date_lte: Optional[str] = Field(
        default=None,
        description="거래일 <= (YYYY-MM-DD)"
    )
    limit: Optional[int] = Field(
        default=100,
        description="최대 결과 수"
    )


class PolygonInsiderTradingData(InsiderTradingData):
    """Polygon 내부자 거래 — 표준 InsiderTradingData 상속, Polygon 전용 필드 추가"""
    acquisition_or_disposition: Optional[str] = Field(default=None, description="취득/처분 구분 (A/D)")
    shares_owned_before: Optional[float] = Field(default=None, description="거래 전 보유 주식 수")
    sec_form_type: Optional[str] = Field(default=None, description="SEC 양식 유형")

    __alias_dict__ = {
        "shares_owned_before": "shares_owned_before_transaction",
        "shares_owned_after": "shares_owned_following_transaction",
    }


"""Polygon.io Insider Trading Fetcher"""
import logging
from typing import Any, Dict, List, Optional

from data_fetcher.abstract_provider.abstract.fetcher import Fetcher
from data_fetcher.utils.api_keys import get_api_key
from data_fetcher.utils.async_http_client import amake_request, HTTPClientError

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
    async def aextract_data(
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
            data = await amake_request(url, params=params, timeout=30)

            if data.get("status") != "OK":
                log.warning(f"Polygon API returned status: {data.get('status')}")

            return data

        except HTTPClientError as e:
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
                insider_data = InsiderTradingData.model_validate({**item, "ticker": query.ticker})
                if insider_data.transaction_value is None and insider_data.shares_traded and insider_data.price_per_share:
                    insider_data.transaction_value = insider_data.shares_traded * insider_data.price_per_share
                insider_list.append(insider_data)
            except (KeyError, ValueError) as e:
                log.warning(f"Error parsing insider trading data: {e}")
                continue

        log.info(f"Fetched {len(insider_list)} insider trading records for {query.ticker}")
        return insider_list

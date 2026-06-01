"""Polygon.io Insider Trading Model"""
from datetime import date as date_type
from typing import Optional
from pydantic import Field
from data_fetcher.abstract_provider.abstract import BaseQueryParams, BaseData


class InsiderTradingQueryParams(BaseQueryParams):
    """내부자 거래 조회 파라미터"""

    ticker: str = Field(
        description="종목 티커 (예: AAPL, TSLA)"
    )
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


class InsiderTradingData(BaseData):
    """내부자 거래 데이터"""

    ticker: str = Field(
        description="종목 티커"
    )

    # === 거래 정보 ===
    transaction_date: date_type = Field(
        description="거래 날짜"
    )
    filing_date: Optional[date_type] = Field(
        default=None,
        description="SEC 신고 날짜"
    )

    # === 내부자 정보 ===
    insider_name: str = Field(
        description="내부자 이름"
    )
    insider_title: Optional[str] = Field(
        default=None,
        description="직책/직위"
    )
    is_director: Optional[bool] = Field(
        default=None,
        description="이사 여부"
    )
    is_officer: Optional[bool] = Field(
        default=None,
        description="임원 여부"
    )
    is_ten_percent_owner: Optional[bool] = Field(
        default=None,
        description="10% 이상 주주 여부"
    )

    # === 거래 유형 ===
    transaction_type: str = Field(
        description="거래 유형 (P=매수, S=매도, A=수령, D=처분 등)"
    )
    transaction_code: Optional[str] = Field(
        default=None,
        description="거래 코드"
    )
    acquisition_or_disposition: Optional[str] = Field(
        default=None,
        description="취득/처분 구분 (A/D)"
    )

    # === 거래량 및 가격 ===
    shares_traded: Optional[float] = Field(
        default=None,
        description="거래 주식 수"
    )
    price_per_share: Optional[float] = Field(
        default=None,
        description="주당 가격"
    )
    transaction_value: Optional[float] = Field(
        default=None,
        description="거래 금액 (= shares * price)"
    )

    # === 보유 현황 ===
    shares_owned_before: Optional[float] = Field(
        default=None,
        description="거래 전 보유 주식 수"
    )
    shares_owned_after: Optional[float] = Field(
        default=None,
        description="거래 후 보유 주식 수"
    )

    # === 소유권 형태 ===
    ownership_type: Optional[str] = Field(
        default=None,
        description="소유권 유형 (D=직접, I=간접)"
    )

    # === 문서 정보 ===
    sec_form_type: Optional[str] = Field(
        default=None,
        description="SEC 양식 유형 (Form 4, Form 3 등)"
    )
    sec_link: Optional[str] = Field(
        default=None,
        description="SEC 문서 링크"
    )

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

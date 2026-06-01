"""Polygon.io Options Data Model"""
from datetime import date as date_type, datetime
from typing import Optional
from pydantic import Field
from data_fetcher.abstract_provider.abstract import BaseQueryParams, BaseData


class OptionsQueryParams(BaseQueryParams):
    """옵션 데이터 조회 파라미터"""

    underlying_ticker: str = Field(
        description="기초자산 티커 (예: AAPL, TSLA)"
    )
    contract_type: Optional[str] = Field(
        default=None,
        description="계약 유형 (call, put)"
    )
    expiration_date: Optional[str] = Field(
        default=None,
        description="만기일 (YYYY-MM-DD)"
    )
    expiration_date_gte: Optional[str] = Field(
        default=None,
        description="만기일 >= (YYYY-MM-DD)"
    )
    expiration_date_lte: Optional[str] = Field(
        default=None,
        description="만기일 <= (YYYY-MM-DD)"
    )
    strike_price: Optional[float] = Field(
        default=None,
        description="행사가격"
    )
    strike_price_gte: Optional[float] = Field(
        default=None,
        description="행사가격 >="
    )
    strike_price_lte: Optional[float] = Field(
        default=None,
        description="행사가격 <="
    )
    limit: Optional[int] = Field(
        default=100,
        description="최대 결과 수"
    )


class OptionsContractData(BaseData):
    """옵션 계약 데이터"""

    ticker: str = Field(
        description="옵션 티커 심볼"
    )
    underlying_ticker: str = Field(
        description="기초자산 티커"
    )
    contract_type: str = Field(
        description="계약 유형 (call/put)"
    )

    # === 계약 정보 ===
    strike_price: float = Field(
        description="행사가격"
    )
    expiration_date: date_type = Field(
        description="만기일"
    )

    # === 가격 데이터 ===
    last_price: Optional[float] = Field(
        default=None,
        description="최종 거래가"
    )
    bid: Optional[float] = Field(
        default=None,
        description="매수 호가"
    )
    ask: Optional[float] = Field(
        default=None,
        description="매도 호가"
    )
    bid_ask_spread: Optional[float] = Field(
        default=None,
        description="매수-매도 스프레드"
    )

    # === 거래량 데이터 ===
    volume: Optional[int] = Field(
        default=None,
        description="거래량"
    )
    open_interest: Optional[int] = Field(
        default=None,
        description="미결제 약정"
    )

    # === Greeks ===
    delta: Optional[float] = Field(
        default=None,
        description="델타 (가격 민감도)"
    )
    gamma: Optional[float] = Field(
        default=None,
        description="감마 (델타 변화율)"
    )
    theta: Optional[float] = Field(
        default=None,
        description="세타 (시간 가치 감소)"
    )
    vega: Optional[float] = Field(
        default=None,
        description="베가 (변동성 민감도)"
    )
    rho: Optional[float] = Field(
        default=None,
        description="로 (금리 민감도)"
    )

    # === 변동성 ===
    implied_volatility: Optional[float] = Field(
        default=None,
        description="내재 변동성 (%)"
    )

    # === 기타 ===
    shares_per_contract: Optional[int] = Field(
        default=100,
        description="계약당 주식 수"
    )
    exercise_style: Optional[str] = Field(
        default=None,
        description="행사 스타일 (american/european)"
    )


class OptionsChainData(BaseData):
    """옵션 체인 스냅샷 데이터"""

    underlying_ticker: str = Field(
        description="기초자산 티커"
    )
    expiration_date: date_type = Field(
        description="만기일"
    )
    snapshot_date: datetime = Field(
        description="스냅샷 시간"
    )

    # === Call Options ===
    call_volume: Optional[int] = Field(
        default=None,
        description="콜 옵션 총 거래량"
    )
    call_open_interest: Optional[int] = Field(
        default=None,
        description="콜 옵션 총 미결제 약정"
    )

    # === Put Options ===
    put_volume: Optional[int] = Field(
        default=None,
        description="풋 옵션 총 거래량"
    )
    put_open_interest: Optional[int] = Field(
        default=None,
        description="풋 옵션 총 미결제 약정"
    )

    # === Put/Call Ratio ===
    put_call_ratio_volume: Optional[float] = Field(
        default=None,
        description="Put/Call 거래량 비율"
    )
    put_call_ratio_oi: Optional[float] = Field(
        default=None,
        description="Put/Call 미결제약정 비율"
    )

    # === 시장 심리 지표 ===
    max_pain: Optional[float] = Field(
        default=None,
        description="맥스 페인 (최대 손실 가격)"
    )


"""Polygon.io Options Data Fetcher"""
import logging
from typing import Any, Dict, List, Optional

from data_fetcher.abstract_provider.abstract.fetcher import Fetcher
from data_fetcher.utils.api_keys import get_api_key
from data_fetcher.utils.async_http_client import amake_request, HTTPClientError

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

"""Polygon.io Options Data Model"""
from datetime import date, datetime
from typing import Optional
from pydantic import Field
from data_fetcher.models.base import BaseQueryParams, BaseData


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
    expiration_date: date = Field(
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
    expiration_date: date = Field(
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

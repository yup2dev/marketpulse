"""Equity Quote Standard Model (주식 시세)"""
from datetime import datetime
from typing import Optional
from pydantic import Field
from app.models.standard_models.base import BaseQueryParams, BaseData


class EquityQuoteQueryParams(BaseQueryParams):
    """주식 시세 조회 파라미터"""

    symbol: str = Field(
        description="종목 코드 (예: AAPL, MSFT)"
    )


class EquityQuoteData(BaseData):
    """주식 시세 데이터"""

    symbol: str = Field(
        description="종목 코드"
    )
    name: Optional[str] = Field(
        default=None,
        description="종목명"
    )

    # === 가격 정보 ===
    last_price: Optional[float] = Field(
        default=None,
        description="현재가"
    )
    open: Optional[float] = Field(
        default=None,
        description="시가"
    )
    high: Optional[float] = Field(
        default=None,
        description="고가"
    )
    low: Optional[float] = Field(
        default=None,
        description="저가"
    )
    close: Optional[float] = Field(
        default=None,
        description="종가 (전일)"
    )
    previous_close: Optional[float] = Field(
        default=None,
        description="전일 종가"
    )

    # === 변동 정보 ===
    change: Optional[float] = Field(
        default=None,
        description="등락폭"
    )
    change_percent: Optional[float] = Field(
        default=None,
        description="등락률 (%)"
    )

    # === 거래량 ===
    volume: Optional[int] = Field(
        default=None,
        description="거래량"
    )
    average_volume: Optional[int] = Field(
        default=None,
        description="평균 거래량"
    )

    # === 52주 최고/최저 ===
    week_52_high: Optional[float] = Field(
        default=None,
        description="52주 최고가"
    )
    week_52_low: Optional[float] = Field(
        default=None,
        description="52주 최저가"
    )

    # === 시가총액 ===
    market_cap: Optional[float] = Field(
        default=None,
        description="시가총액"
    )

    # === 시장 정보 ===
    exchange: Optional[str] = Field(
        default=None,
        description="거래소 (NYSE, NASDAQ 등)"
    )
    currency: Optional[str] = Field(
        default="USD",
        description="통화"
    )

    # === 시간 정보 ===
    last_updated: Optional[datetime] = Field(
        default=None,
        description="마지막 업데이트 시간"
    )
    is_market_open: Optional[bool] = Field(
        default=None,
        description="시장 개장 여부"
    )

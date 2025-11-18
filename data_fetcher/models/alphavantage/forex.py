"""AlphaVantage Forex Model (외환 데이터)"""
from datetime import date, datetime
from typing import Optional
from pydantic import Field
from data_fetcher.models.base import BaseQueryParams, BaseData


class ForexQueryParams(BaseQueryParams):
    """외환 데이터 조회 파라미터"""

    from_currency: str = Field(
        description="기준 통화 (예: USD, EUR, KRW)"
    )
    to_currency: str = Field(
        description="대상 통화 (예: USD, EUR, KRW)"
    )
    start_date: Optional[str] = Field(
        default=None,
        description="조회 시작일 (YYYY-MM-DD)"
    )
    end_date: Optional[str] = Field(
        default=None,
        description="조회 종료일 (YYYY-MM-DD)"
    )
    interval: str = Field(
        default="daily",
        description="데이터 간격 (daily, weekly, monthly)"
    )


class ForexData(BaseData):
    """외환 데이터"""

    from_currency: str = Field(description="기준 통화")
    to_currency: str = Field(description="대상 통화")
    date: date = Field(description="날짜")

    # 환율 데이터
    open: float = Field(description="시가")
    high: float = Field(description="고가")
    low: float = Field(description="저가")
    close: float = Field(description="종가")

    # 계산 필드
    daily_change: Optional[float] = Field(
        default=None,
        description="일일 변동 (종가 - 시가)"
    )
    daily_change_pct: Optional[float] = Field(
        default=None,
        description="일일 변동률 (%)"
    )
    volatility: Optional[float] = Field(
        default=None,
        description="변동성 (고가 - 저가)"
    )

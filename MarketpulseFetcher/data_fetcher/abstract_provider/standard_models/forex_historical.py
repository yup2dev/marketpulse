"""Standard Model: Forex Historical (외환 통화쌍 시계열)

통화쌍(from/to)의 OHLC 시계열 공통 인터페이스. 주식과 달리 symbol/volume이 없고
기준/대상 통화로 식별한다. 특정 provider는 이 클래스를 상속해 전용 필드를 추가한다.
"""
from datetime import date as date_type
from typing import Literal, Optional

from pydantic import Field

from data_fetcher.abstract_provider.abstract.data import BaseData
from data_fetcher.abstract_provider.abstract.query_params import BaseQueryParams


class ForexHistoricalQueryParams(BaseQueryParams):
    """외환 시계열 조회 표준 파라미터."""

    from_currency: str = Field(description="기준 통화 (예: USD, EUR, KRW)")
    to_currency: str = Field(description="대상 통화 (예: USD, EUR, KRW)")
    start_date: Optional[str] = Field(default=None, description="조회 시작일 (YYYY-MM-DD)")
    end_date: Optional[str] = Field(default=None, description="조회 종료일 (YYYY-MM-DD)")
    interval: Literal["daily", "weekly", "monthly"] = Field(default="daily", description="데이터 간격")


class ForexHistoricalData(BaseData):
    """외환 통화쌍 OHLC 시계열 표준 데이터."""

    from_currency: str = Field(description="기준 통화")
    to_currency: str = Field(description="대상 통화")
    date: date_type = Field(description="날짜")
    open: Optional[float] = Field(default=None, description="시가")
    high: Optional[float] = Field(default=None, description="고가")
    low: Optional[float] = Field(default=None, description="저가")
    close: Optional[float] = Field(default=None, description="종가")
    daily_change: Optional[float] = Field(default=None, description="일일 변동 (종가 - 시가)")
    daily_change_pct: Optional[float] = Field(default=None, description="일일 변동률 (%)")
    volatility: Optional[float] = Field(default=None, description="변동성 (고가 - 저가)")

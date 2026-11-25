"""FX Rate Standard Model — 통화쌍 하나의 환율 (기준일 이전 가장 최근 영업일).

rate = base_currency 1단위당 counter_currency (예: USD→KRW 1400.5 → 1 USD = 1400.5 KRW).
"""
from datetime import date as dateType
from typing import Optional

from pydantic import Field, field_validator

from data_fetcher.abstract_provider.abstract.data import BaseData
from data_fetcher.abstract_provider.abstract.query_params import BaseQueryParams


class FxRateQueryParams(BaseQueryParams):
    """FX Rate Query."""

    base: str = Field(default="USD", description="기준 통화 (예: USD)", min_length=3, max_length=3)
    quote: str = Field(default="KRW", description="상대 통화 (예: KRW)", min_length=3, max_length=3)
    date: Optional[dateType] = Field(default=None, description="이 날짜 이전 가장 최근 영업일 (기본: 최신)")

    @field_validator("base", "quote", mode="before")
    @classmethod
    def _upper(cls, v):
        return v.upper() if isinstance(v, str) else v


class FxRateData(BaseData):
    """FX Rate Data."""

    date: Optional[dateType] = Field(default=None, description="환율 기준일 (같은 통화면 없음)")
    base_currency: str = Field(description="기준 통화")
    counter_currency: str = Field(description="상대 통화")
    rate: float = Field(description="base_currency 1단위당 counter_currency")
    change_percent: Optional[float] = Field(default=None, description="전일 대비 (%)")
    inverted: bool = Field(default=False, description="적재된 역방향 쌍(1/rate)으로 계산했는지")

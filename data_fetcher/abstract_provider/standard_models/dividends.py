"""Standard Model: Dividends (배당)"""
from datetime import date as date_type
from typing import Optional

from pydantic import Field

from data_fetcher.abstract_provider.abstract.data import BaseData
from data_fetcher.abstract_provider.abstract.query_params import BaseQueryParams


class DividendsQueryParams(BaseQueryParams):
    symbol: str = Field(description="종목 코드")
    start_date: Optional[str] = Field(default=None, description="시작일 (YYYY-MM-DD)")
    end_date: Optional[str] = Field(default=None, description="종료일 (YYYY-MM-DD)")


class DividendData(BaseData):
    symbol: str = Field(description="종목 코드")
    date: date_type = Field(description="배당 지급일 (또는 기준일)")
    dividend: float = Field(description="주당 배당금")
    dividend_yield: Optional[float] = Field(default=None, description="배당 수익률 (%)")
    yoy_growth: Optional[float] = Field(default=None, description="전년 대비 배당 성장률 (%)")
    ex_dividend_date: Optional[date_type] = Field(default=None, description="배당락일")
    record_date: Optional[date_type] = Field(default=None, description="배당 기준일")
    payment_date: Optional[date_type] = Field(default=None, description="배당 지급일")
    declaration_date: Optional[date_type] = Field(default=None, description="배당 선언일")
    currency: Optional[str] = Field(default="USD", description="통화")

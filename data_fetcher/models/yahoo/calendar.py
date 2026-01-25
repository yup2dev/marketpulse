"""Yahoo Finance Calendar Model (회사 일정)"""
from typing import Optional
from datetime import date
from pydantic import Field
from data_fetcher.models.base import BaseQueryParams, BaseData


class CalendarQueryParams(BaseQueryParams):
    """회사 일정 조회 파라미터"""

    symbol: str = Field(
        description="종목 코드 (예: AAPL, MSFT)"
    )


class CalendarData(BaseData):
    """회사 일정 데이터"""

    symbol: str = Field(description="종목 코드")

    # 실적 발표
    earnings_date: Optional[date] = Field(default=None, description="실적 발표일")
    earnings_date_end: Optional[date] = Field(default=None, description="실적 발표일 (종료)")
    earnings_average: Optional[float] = Field(default=None, description="EPS 예상 평균")
    earnings_low: Optional[float] = Field(default=None, description="EPS 예상 최저")
    earnings_high: Optional[float] = Field(default=None, description="EPS 예상 최고")
    revenue_average: Optional[float] = Field(default=None, description="매출 예상 평균")
    revenue_low: Optional[float] = Field(default=None, description="매출 예상 최저")
    revenue_high: Optional[float] = Field(default=None, description="매출 예상 최고")

    # 배당
    ex_dividend_date: Optional[date] = Field(default=None, description="배당락일")
    dividend_date: Optional[date] = Field(default=None, description="배당 지급일")

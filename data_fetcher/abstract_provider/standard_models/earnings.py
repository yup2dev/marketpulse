"""Standard Model: Earnings (실적 발표)"""
from datetime import date as date_type, datetime
from typing import Optional

from pydantic import Field

from data_fetcher.abstract_provider.abstract.data import BaseData
from data_fetcher.abstract_provider.abstract.query_params import BaseQueryParams


class EarningsQueryParams(BaseQueryParams):
    symbol: str = Field(description="종목 코드")
    limit: Optional[int] = Field(default=10, description="최대 결과 수")
    fiscal_year: Optional[int] = Field(default=None, description="회계연도")
    fiscal_quarter: Optional[int] = Field(default=None, description="회계분기 (1-4)")


class EarningsData(BaseData):
    symbol: str = Field(description="종목 코드")
    fiscal_period: Optional[str] = Field(default=None, description="회계 기간 (예: FY2024, Q3 2024)")
    fiscal_year: Optional[int] = Field(default=None, description="회계연도")
    fiscal_quarter: Optional[int] = Field(default=None, description="회계분기")
    report_date: Optional[date_type] = Field(default=None, description="실적 발표일")
    period_end_date: Optional[date_type] = Field(default=None, description="회계 기간 종료일")

    # EPS
    eps_actual: Optional[float] = Field(default=None, description="실제 EPS")
    eps_estimated: Optional[float] = Field(default=None, description="예상 EPS")
    eps_surprise: Optional[float] = Field(default=None, description="EPS 어닝 서프라이즈")
    eps_surprise_percent: Optional[float] = Field(default=None, description="EPS 서프라이즈율 (%)")

    # 매출
    revenue_actual: Optional[float] = Field(default=None, description="실제 매출")
    revenue_estimated: Optional[float] = Field(default=None, description="예상 매출")
    revenue_surprise: Optional[float] = Field(default=None, description="매출 서프라이즈")
    revenue_surprise_percent: Optional[float] = Field(default=None, description="매출 서프라이즈율 (%)")

    # 손익
    net_income: Optional[float] = Field(default=None, description="당기순이익")
    operating_income: Optional[float] = Field(default=None, description="영업이익")
    gross_profit: Optional[float] = Field(default=None, description="매출총이익")
    ebitda: Optional[float] = Field(default=None, description="EBITDA")

    # 성장률
    revenue_growth_yoy: Optional[float] = Field(default=None, description="매출 전년 대비 성장률 (%)")
    earnings_growth_yoy: Optional[float] = Field(default=None, description="이익 전년 대비 성장률 (%)")

    # 컨퍼런스콜
    conference_call_datetime: Optional[datetime] = Field(default=None, description="실적 발표 컨퍼런스콜 일시")

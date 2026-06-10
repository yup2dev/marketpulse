from datetime import date as date_type
from typing import Optional
from pydantic import Field
from data_fetcher.models.base import BaseQueryParams, BaseData


class RegimeHistoryQueryParams(BaseQueryParams):
    start_date: Optional[date_type] = None
    end_date: Optional[date_type] = None


class RegimeHistoryData(BaseData):
    date: str = Field(description="날짜 (YYYY-MM-DD)")
    regime: str = Field(description="경제 레짐: goldilocks·reflation·stagflation·deflation")
    growth_score: float = Field(description="성장 점수 (-100 ~ 100)")
    inflation_score: float = Field(description="인플레이션 점수 (-100 ~ 100)")
    gdp_growth: float = Field(description="실질 GDP 성장률 (%)")
    cpi_yoy: float = Field(description="CPI 전년동기비 (%)")

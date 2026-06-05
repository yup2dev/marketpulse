from datetime import date as date_type
from typing import Optional
from pydantic import Field
from data_fetcher.models.base import BaseQueryParams, BaseData


class PhillipsCurveQueryParams(BaseQueryParams):
    start_date: Optional[date_type] = None
    end_date: Optional[date_type] = None


class PhillipsCurveData(BaseData):
    date: str = Field(description="날짜 (YYYY-MM-DD)")
    unemployment: float = Field(description="실업률 (%)")
    inflation: float = Field(description="CPI 전년동기비 (%)")

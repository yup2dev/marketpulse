from datetime import date as date_type
from typing import Optional
from pydantic import Field
from data_fetcher.models.base import BaseQueryParams, BaseData


class InflationMomentumQueryParams(BaseQueryParams):
    start_date: Optional[date_type] = None
    end_date: Optional[date_type] = None


class InflationMomentumData(BaseData):
    date: str = Field(description="날짜 (YYYY-MM-DD)")
    yoy_12m: Optional[float] = Field(None, description="전년동월비 CPI 변화율 (%)")
    yoy_6m: Optional[float] = Field(None, description="6개월 연율화 CPI 변화율 (%)")
    yoy_3m: Optional[float] = Field(None, description="3개월 연율화 CPI 변화율 (%)")

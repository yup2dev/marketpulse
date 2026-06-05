from datetime import date as date_type
from typing import Optional
from pydantic import Field
from data_fetcher.models.base import BaseQueryParams, BaseData


class InflationSectorQueryParams(BaseQueryParams):
    start_date: Optional[date_type] = None
    end_date: Optional[date_type] = None


class InflationSectorData(BaseData):
    date: str = Field(description="날짜 (YYYY-MM-DD)")
    headline: Optional[float] = Field(None, description="헤드라인 CPI YoY (%)")
    core: Optional[float] = Field(None, description="근원 CPI YoY (%)")
    food: Optional[float] = Field(None, description="식품 CPI YoY (%)")
    energy: Optional[float] = Field(None, description="에너지 CPI YoY (%)")
    shelter: Optional[float] = Field(None, description="주거 CPI YoY (%)")
    medical: Optional[float] = Field(None, description="의료 CPI YoY (%)")
    apparel: Optional[float] = Field(None, description="의류 CPI YoY (%)")
    vehicles: Optional[float] = Field(None, description="신차 CPI YoY (%)")

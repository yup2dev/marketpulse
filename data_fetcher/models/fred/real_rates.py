from datetime import date as date_type
from typing import Optional
from pydantic import Field
from data_fetcher.models.base import BaseQueryParams, BaseData


class RealRatesQueryParams(BaseQueryParams):
    start_date: Optional[date_type] = None
    end_date: Optional[date_type] = None


class RealRatesData(BaseData):
    date: str = Field(description="날짜 (YYYY-MM-DD)")
    nominal_10y: Optional[float] = Field(None, description="10Y 명목 국채 수익률 (%)")
    nominal_5y: Optional[float] = Field(None, description="5Y 명목 국채 수익률 (%)")
    real_10y: Optional[float] = Field(None, description="10Y TIPS 실질 수익률 (%)")
    real_5y: Optional[float] = Field(None, description="5Y TIPS 실질 수익률 (%)")
    breakeven_5y: Optional[float] = Field(None, description="5Y 손익분기 인플레이션 (%)")
    breakeven_10y: Optional[float] = Field(None, description="10Y 손익분기 인플레이션 (%)")

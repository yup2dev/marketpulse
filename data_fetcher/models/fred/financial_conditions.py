from datetime import date as date_type
from typing import Optional
from pydantic import Field
from data_fetcher.models.base import BaseQueryParams, BaseData


class FinancialConditionsHistoryQueryParams(BaseQueryParams):
    start_date: Optional[date_type] = None
    end_date: Optional[date_type] = None


class FinancialConditionsHistoryData(BaseData):
    date: str = Field(description="날짜 (YYYY-MM-DD)")
    value: float = Field(description="NFCI (0=역사적 평균, +=완화, -=긴축)")

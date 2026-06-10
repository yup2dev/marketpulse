from datetime import date as date_type
from typing import Optional
from pydantic import Field
from data_fetcher.models.base import BaseQueryParams, BaseData


class FedBalanceSheetQueryParams(BaseQueryParams):
    start_date: Optional[date_type] = None
    end_date: Optional[date_type] = None


class FedBalanceSheetData(BaseData):
    date: str = Field(description="날짜 (YYYY-MM-DD)")
    value: float = Field(description="연준 총자산 (Trillions USD)")

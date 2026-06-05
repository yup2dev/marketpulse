from datetime import date as date_type
from typing import Optional
from pydantic import Field
from data_fetcher.models.base import BaseQueryParams, BaseData


class JobsBreakdownQueryParams(BaseQueryParams):
    start_date: Optional[date_type] = None
    end_date: Optional[date_type] = None


class JobsBreakdownData(BaseData):
    date: str = Field(description="날짜 (YYYY-MM-DD)")
    private: float = Field(description="민간 고용 변화 (기준점 대비, 천 명)")
    government: float = Field(description="정부 고용 변화 (기준점 대비, 천 명)")
    private_level: float = Field(description="민간 고용 수준 (천 명)")
    government_level: float = Field(description="정부 고용 수준 (천 명)")

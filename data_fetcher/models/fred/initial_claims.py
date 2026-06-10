from datetime import date as date_type
from typing import Optional
from pydantic import Field
from data_fetcher.models.base import BaseQueryParams, BaseData


class InitialClaimsQueryParams(BaseQueryParams):
    start_date: Optional[date_type] = None
    end_date: Optional[date_type] = None


class InitialClaimsData(BaseData):
    date: str = Field(description="날짜 (YYYY-MM-DD)")
    claims: float = Field(description="신규 실업급여 청구건수 (천 명)")
    ma_4w: Optional[float] = Field(None, description="4주 이동평균 (천 명)")

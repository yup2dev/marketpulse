from datetime import date as date_type
from typing import Optional
from pydantic import Field
from data_fetcher.models.base import BaseQueryParams, BaseData


class PMIQueryParams(BaseQueryParams):
    start_date: Optional[date_type] = None
    end_date: Optional[date_type] = None


class PMIData(BaseData):
    date: str = Field(description="날짜 (YYYY-MM-DD)")
    cfnai: Optional[float] = Field(None, description="Chicago Fed CFNAI (>0 = 잠재성장 초과)")
    cfnai_ma3: Optional[float] = Field(None, description="CFNAI 3개월 이동평균")
    diff: Optional[float] = Field(None, description="CFNAI 확산지수 (>0 = 다수 지표 확장)")
    sahm: Optional[float] = Field(None, description="Sahm Rule 지수 (≥0.5 = 경기침체 신호)")

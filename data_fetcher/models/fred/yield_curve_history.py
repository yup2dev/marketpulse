from datetime import date as date_type
from typing import Optional
from pydantic import Field
from data_fetcher.models.base import BaseQueryParams, BaseData


class YieldCurveHistoryQueryParams(BaseQueryParams):
    start_date: Optional[date_type] = None
    end_date: Optional[date_type] = None


class YieldCurveHistoryData(BaseData):
    date: str = Field(description="날짜 (YYYY-MM-DD)")
    m3:  Optional[float] = Field(None, alias="3m",  description="3개월 수익률 (%)")
    m6:  Optional[float] = Field(None, alias="6m",  description="6개월 수익률 (%)")
    y1:  Optional[float] = Field(None, alias="1y",  description="1년 수익률 (%)")
    y2:  Optional[float] = Field(None, alias="2y",  description="2년 수익률 (%)")
    y5:  Optional[float] = Field(None, alias="5y",  description="5년 수익률 (%)")
    y10: Optional[float] = Field(None, alias="10y", description="10년 수익률 (%)")
    y30: Optional[float] = Field(None, alias="30y", description="30년 수익률 (%)")

    def model_dump(self, **kwargs):
        # alias key로 출력해 프론트엔드와 키 일치
        kwargs.setdefault("by_alias", True)
        return super().model_dump(**kwargs)

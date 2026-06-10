from datetime import date as date_type
from typing import Optional
from pydantic import Field
from data_fetcher.models.base import BaseQueryParams, BaseData


class SentimentHistoryQueryParams(BaseQueryParams):
    start_date: Optional[date_type] = None
    end_date: Optional[date_type] = None


class SentimentHistoryData(BaseData):
    date: str = Field(description="날짜 (YYYY-MM-DD)")
    vix: Optional[float] = Field(None, description="CBOE 변동성 지수 (VIX)")
    hy_spread: Optional[float] = Field(None, description="하이일드 스프레드 (bp)")
    fear_greed_score: Optional[float] = Field(None, description="공포-탐욕 지수 (0-100)")

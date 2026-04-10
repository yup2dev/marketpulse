"""Yahoo Finance Stock Splits Model"""
from pydantic import Field
from data_fetcher.models.base import BaseQueryParams, BaseData


class YFinanceSplitsQueryParams(BaseQueryParams):
    symbol: str = Field(description="종목 코드")
    limit: int = Field(default=20, description="반환할 최대 레코드 수")


class YFinanceSplitData(BaseData):
    """주식 분할 데이터"""
    date: str = Field(description="분할일 (YYYY-MM-DD)")
    ratio: float = Field(description="분할 비율")
    description: str = Field(description="분할 설명 (예: 4:1 split)")

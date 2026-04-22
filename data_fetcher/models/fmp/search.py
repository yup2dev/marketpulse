"""FMP Search Model (Pydantic)"""
from typing import Optional
from pydantic import Field
from data_fetcher.models.base import BaseQueryParams, BaseData


class FMPSearchQueryParams(BaseQueryParams):
    query: str = Field(description="검색어 (심볼 또는 회사명)")
    limit: int = Field(default=10, description="반환할 최대 결과 수")


class FMPSearchData(BaseData):
    """주식 검색 결과"""
    symbol: str
    name: str
    currency: Optional[str] = None
    stock_exchange: Optional[str] = None
    exchange_short_name: Optional[str] = None

    __alias_dict__ = {
        "stock_exchange": "stockExchange",
        "exchange_short_name": "exchangeShortName",
    }

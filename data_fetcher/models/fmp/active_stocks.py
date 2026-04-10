"""FMP Active Stocks Model (Pydantic)"""
from typing import Optional
from pydantic import Field
from data_fetcher.models.base import BaseQueryParams, BaseData


class FMPActiveStocksQueryParams(BaseQueryParams):
    type: str = Field(default="actives", description="'actives' | 'gainers' | 'losers'")


class FMPActiveStockData(BaseData):
    """활성 종목 데이터"""
    symbol: str
    name: str
    change: Optional[float] = None
    price: Optional[float] = None
    change_percentage: Optional[str] = None

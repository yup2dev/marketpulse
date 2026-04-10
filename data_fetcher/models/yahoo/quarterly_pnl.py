"""Yahoo Finance Quarterly P&L Model"""
from typing import Optional, List, Dict, Any
from pydantic import Field
from data_fetcher.models.base import BaseQueryParams, BaseData


class YFinanceQuarterlyPnLQueryParams(BaseQueryParams):
    symbol: str = Field(description="종목 코드")
    limit: int = Field(default=12, description="반환할 분기 수")


class YFinanceQuarterlyPeriodData(BaseData):
    """분기 손익 데이터"""
    date: str
    revenue: Optional[float] = None
    cogs: Optional[float] = None
    gross: Optional[float] = None
    op_income: Optional[float] = None
    net: Optional[float] = None
    rd: Optional[float] = None
    sga: Optional[float] = None
    gross_margin: Optional[float] = None
    op_margin: Optional[float] = None
    net_margin: Optional[float] = None


class YFinanceQuarterlyPnLData(BaseData):
    """분기 P&L 통합 데이터"""
    symbol: str
    history: List[YFinanceQuarterlyPeriodData] = Field(default_factory=list)
    latest: Dict[str, Any] = Field(default_factory=dict)
    yoy_revenue: Dict[str, float] = Field(default_factory=dict)

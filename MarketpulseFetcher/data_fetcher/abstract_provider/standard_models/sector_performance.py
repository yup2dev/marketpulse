"""Sector Performance Standard Model — 섹터별 묶음 (종목 수 · 시가총액 합 · 시총 상위 종목)."""
from typing import List, Optional

from pydantic import Field

from data_fetcher.abstract_provider.abstract.data import BaseData
from data_fetcher.abstract_provider.abstract.query_params import BaseQueryParams


class SectorPerformanceQueryParams(BaseQueryParams):
    top: int = Field(default=50, ge=1, le=500, description="섹터마다 시총 상위 몇 종목까지")


class SectorStock(BaseData):
    symbol: str
    name: Optional[str] = None
    sector: Optional[str] = None
    industry: Optional[str] = None
    market_cap: float = 0
    price: Optional[float] = None


class SectorPerformanceData(BaseData):
    sector: str = Field(description="섹터")
    count: int = Field(description="종목 수")
    total_market_cap: float = Field(description="시가총액 합")
    stocks: List[SectorStock] = Field(default_factory=list, description="시총 상위 종목")

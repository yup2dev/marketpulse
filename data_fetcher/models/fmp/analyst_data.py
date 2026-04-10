"""FMP Analyst Data Model"""
from typing import Optional, List, Dict, Any
from pydantic import Field
from data_fetcher.models.base import BaseQueryParams, BaseData


class FMPAnalystDataQueryParams(BaseQueryParams):
    symbol: str = Field(description="종목 코드")


class FMPAnalystItem(BaseData):
    """개별 애널리스트 레이팅"""
    name: str = ""
    rating: Optional[str] = None
    prev_rating: Optional[str] = None
    action: Optional[str] = None
    date: Optional[str] = None
    target_price: Optional[float] = None


class FMPAnalystDataData(BaseData):
    """애널리스트 종합 데이터"""
    symbol: str
    consensus_rating: str = "N/A"
    ratings: Dict[str, Any] = Field(default_factory=dict)
    price_target: Dict[str, Any] = Field(default_factory=dict)
    number_of_analysts: Optional[int] = None
    analysts: List[FMPAnalystItem] = Field(default_factory=list)

"""FMP Revenue Segments Model"""
from typing import Optional, List, Dict, Any
from pydantic import Field
from data_fetcher.models.base import BaseQueryParams, BaseData


class FMPRevenueSegmentsQueryParams(BaseQueryParams):
    symbol: str = Field(description="종목 코드")
    limit: int = Field(default=8, description="반환할 연도 수")


class FMPSegmentData(BaseData):
    """세그먼트 분류별 매출 데이터"""
    segments: List[str] = Field(default_factory=list)
    history: List[Dict[str, Any]] = Field(default_factory=list)
    latest: Dict[str, Any] = Field(default_factory=dict)
    yoy: Dict[str, Optional[float]] = Field(default_factory=dict)


class FMPRevenueSegmentsData(BaseData):
    """제품/지역별 매출 분류 통합 데이터"""
    symbol: str
    product: Optional[FMPSegmentData] = None
    geo: Optional[FMPSegmentData] = None
    has_product: bool = False
    has_geo: bool = False

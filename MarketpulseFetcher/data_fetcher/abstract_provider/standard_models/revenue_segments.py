"""Standard Model: Revenue Segments (제품/지역별 매출 분류)"""
from typing import Any, Dict, List, Optional

from pydantic import Field

from data_fetcher.abstract_provider.abstract.data import BaseData
from data_fetcher.abstract_provider.abstract.query_params import BaseQueryParams


class RevenueSegmentDetailData(BaseData):
    """단일 분류(제품 또는 지역)의 세그먼트 매출 데이터"""

    segments: List[str] = Field(default_factory=list, description="세그먼트 목록")
    history: List[Dict[str, Any]] = Field(default_factory=list, description="연도별 이력")
    latest: Dict[str, Any] = Field(default_factory=dict, description="최신 연도 요약")
    yoy: Dict[str, Optional[float]] = Field(
        default_factory=dict, description="전년 대비 증감률"
    )


class RevenueSegmentsQueryParams(BaseQueryParams):
    """매출 세그먼트 조회 표준 파라미터"""

    symbol: str = Field(description="종목 코드")
    limit: int = Field(default=8, description="반환할 연도 수")


class RevenueSegmentsData(BaseData):
    """제품/지역별 매출 분류 통합 표준 데이터"""

    symbol: str = Field(description="종목 코드")
    product: Optional[RevenueSegmentDetailData] = Field(default=None, description="제품별 분류")
    geo: Optional[RevenueSegmentDetailData] = Field(default=None, description="지역별 분류")
    has_product: bool = Field(default=False, description="제품 분류 존재 여부")
    has_geo: bool = Field(default=False, description="지역 분류 존재 여부")

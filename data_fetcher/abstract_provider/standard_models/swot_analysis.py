"""Standard Model: SWOT Analysis (강점/약점/기회/위협 분석)"""
from typing import List, Optional

from pydantic import Field

from data_fetcher.abstract_provider.abstract.data import BaseData
from data_fetcher.abstract_provider.abstract.query_params import BaseQueryParams


class SwotItem(BaseData):
    """SWOT 항목"""

    label: str = Field(description="항목 라벨")
    value: str = Field(description="항목 내용")
    type: str = Field(description="유형 ('positive' | 'negative')")


class SwotAnalysisQueryParams(BaseQueryParams):
    """SWOT 분석 조회 표준 파라미터"""

    symbol: str = Field(description="종목 코드")


class SwotAnalysisData(BaseData):
    """SWOT 분석 표준 데이터"""

    symbol: str = Field(description="종목 코드")
    strengths: List[SwotItem] = Field(default_factory=list, description="강점")
    weaknesses: List[SwotItem] = Field(default_factory=list, description="약점")
    opportunities: List[SwotItem] = Field(default_factory=list, description="기회")
    threats: List[SwotItem] = Field(default_factory=list, description="위협")
    ai_analysis: Optional[str] = Field(default=None, description="AI 분석 코멘트")

"""Yahoo Finance SWOT Analysis Model"""
from typing import Optional, List
from pydantic import Field
from data_fetcher.models.base import BaseQueryParams, BaseData


class YFinanceSWOTQueryParams(BaseQueryParams):
    symbol: str = Field(description="종목 코드")


class YFinanceSWOTItem(BaseData):
    """SWOT 항목"""
    label: str
    value: str
    type: str  # 'positive' | 'negative'


class YFinanceSWOTData(BaseData):
    """SWOT 분석 데이터"""
    symbol: str
    strengths: List[YFinanceSWOTItem] = Field(default_factory=list)
    weaknesses: List[YFinanceSWOTItem] = Field(default_factory=list)
    opportunities: List[YFinanceSWOTItem] = Field(default_factory=list)
    threats: List[YFinanceSWOTItem] = Field(default_factory=list)
    ai_analysis: Optional[str] = None

"""Yahoo Finance Moat Analysis Model"""
from typing import Optional, List
from pydantic import Field
from data_fetcher.models.base import BaseQueryParams, BaseData


class YFinanceMoatQueryParams(BaseQueryParams):
    symbol: str = Field(description="종목 코드")


class YFinanceMoatYearData(BaseData):
    """연도별 Moat 지표"""
    year: str
    roe: Optional[float] = None
    roic: Optional[float] = None
    gross_margin: Optional[float] = None
    op_margin: Optional[float] = None
    net_margin: Optional[float] = None
    fcf_margin: Optional[float] = None


class YFinanceMoatData(BaseData):
    """Moat 분석 데이터"""
    symbol: str
    history: List[YFinanceMoatYearData] = Field(default_factory=list)
    moat_score: int = 0
    moat_type: str = "None"

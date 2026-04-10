"""Yahoo Finance Investment Scorecard Model"""
from typing import Optional, Dict, Any
from pydantic import Field
from data_fetcher.models.base import BaseQueryParams, BaseData


class YFinanceScorecardQueryParams(BaseQueryParams):
    symbol: str = Field(description="종목 코드")


class YFinanceScorecardData(BaseData):
    """투자 스코어카드 데이터"""
    symbol: str
    overall_score: int = 0
    investment_grade: str = "N/A"
    categories: Dict[str, Any] = Field(default_factory=dict)
    outlook: Dict[str, Any] = Field(default_factory=dict)
    ai_report: Optional[str] = None

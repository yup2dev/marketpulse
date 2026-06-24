"""Standard Model: Investment Scorecard (투자 스코어카드)"""
from typing import Any, Dict, Optional

from pydantic import Field

from data_fetcher.abstract_provider.abstract.data import BaseData
from data_fetcher.abstract_provider.abstract.query_params import BaseQueryParams


class InvestmentScorecardQueryParams(BaseQueryParams):
    """투자 스코어카드 조회 표준 파라미터"""

    symbol: str = Field(description="종목 코드")


class InvestmentScorecardData(BaseData):
    """투자 스코어카드 표준 데이터"""

    symbol: str = Field(description="종목 코드")
    overall_score: int = Field(default=0, description="종합 점수")
    investment_grade: str = Field(default="N/A", description="투자 등급")
    categories: Dict[str, Any] = Field(default_factory=dict, description="카테고리별 평가")
    outlook: Dict[str, Any] = Field(default_factory=dict, description="전망")
    ai_report: Optional[str] = Field(default=None, description="AI 리포트")

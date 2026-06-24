"""Standard Model: Analyst Ratings (애널리스트 레이팅/컨센서스)

재무 추정치(analyst_estimates)와 달리, 애널리스트별 등급/액션과 컨센서스·목표주가를
집계한 래퍼의 공통 인터페이스.
"""
from typing import Any, Dict, List, Optional

from pydantic import Field

from data_fetcher.abstract_provider.abstract.data import BaseData
from data_fetcher.abstract_provider.abstract.query_params import BaseQueryParams


class AnalystRatingsQueryParams(BaseQueryParams):
    """애널리스트 레이팅 조회 표준 파라미터"""

    symbol: str = Field(description="종목 코드")


class AnalystRatingItem(BaseData):
    """개별 애널리스트 레이팅"""

    name: str = Field(default="", description="애널리스트/기관명")
    rating: Optional[str] = Field(default=None, description="현재 등급")
    prev_rating: Optional[str] = Field(default=None, description="이전 등급")
    action: Optional[str] = Field(default=None, description="액션 (upgrade/downgrade 등)")
    date: Optional[str] = Field(default=None, description="발표일")
    target_price: Optional[float] = Field(default=None, description="목표주가")


class AnalystRatingsData(BaseData):
    """애널리스트 레이팅 종합 표준 데이터"""

    symbol: str = Field(description="종목 코드")
    consensus_rating: str = Field(default="N/A", description="컨센서스 등급")
    ratings: Dict[str, Any] = Field(default_factory=dict, description="등급 분포")
    price_target: Dict[str, Any] = Field(default_factory=dict, description="목표주가 요약")
    number_of_analysts: Optional[int] = Field(default=None, description="애널리스트 수")
    analysts: List[AnalystRatingItem] = Field(default_factory=list, description="애널리스트별 레이팅")

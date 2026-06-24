"""Standard Model: Equity Estimates (애널리스트 추정치 집계)

목표주가/EPS/매출/성장 추정치를 종목 단위로 집계한 래퍼와 그 컴포넌트 모델의
공통 인터페이스. (재무 추정치 행 단위 모델 analyst_estimates 와 별개의 집계 shape)
"""
from typing import Any, Dict, Optional

from pydantic import Field

from data_fetcher.abstract_provider.abstract.data import BaseData
from data_fetcher.abstract_provider.abstract.query_params import BaseQueryParams


class EquityEstimatesQueryParams(BaseQueryParams):
    """애널리스트 추정치 조회 표준 파라미터"""

    symbol: str = Field(description="종목 코드 (예: AAPL, MSFT)")


class PriceTargetData(BaseData):
    """목표주가 데이터"""

    symbol: str = Field(description="종목 코드")
    current_price: Optional[float] = Field(default=None, description="현재가")
    target_high: Optional[float] = Field(default=None, description="목표가 최고")
    target_low: Optional[float] = Field(default=None, description="목표가 최저")
    target_mean: Optional[float] = Field(default=None, description="목표가 평균")
    target_median: Optional[float] = Field(default=None, description="목표가 중앙값")
    number_of_analysts: Optional[int] = Field(default=None, description="애널리스트 수")


class EarningsEstimateData(BaseData):
    """수익(EPS) 추정치 데이터"""

    symbol: str = Field(description="종목 코드")
    period: str = Field(description="기간 (0q, +1q, 0y, +1y)")
    avg: Optional[float] = Field(default=None, description="EPS 추정 평균")
    low: Optional[float] = Field(default=None, description="EPS 추정 최저")
    high: Optional[float] = Field(default=None, description="EPS 추정 최고")
    year_ago_eps: Optional[float] = Field(default=None, description="전년 동기 EPS")
    number_of_analysts: Optional[int] = Field(default=None, description="애널리스트 수")
    growth: Optional[float] = Field(default=None, description="성장률")


class RevenueEstimateData(BaseData):
    """매출 추정치 데이터"""

    symbol: str = Field(description="종목 코드")
    period: str = Field(description="기간 (0q, +1q, 0y, +1y)")
    avg: Optional[float] = Field(default=None, description="매출 추정 평균")
    low: Optional[float] = Field(default=None, description="매출 추정 최저")
    high: Optional[float] = Field(default=None, description="매출 추정 최고")
    year_ago_revenue: Optional[float] = Field(default=None, description="전년 동기 매출")
    number_of_analysts: Optional[int] = Field(default=None, description="애널리스트 수")
    growth: Optional[float] = Field(default=None, description="성장률")


class GrowthEstimateData(BaseData):
    """성장 추정치 데이터"""

    symbol: str = Field(description="종목 코드")
    current_quarter: Optional[float] = Field(default=None, description="현재 분기 성장률")
    next_quarter: Optional[float] = Field(default=None, description="다음 분기 성장률")
    current_year: Optional[float] = Field(default=None, description="현재 연도 성장률")
    next_year: Optional[float] = Field(default=None, description="다음 연도 성장률")
    next_5_years: Optional[float] = Field(default=None, description="향후 5년 연평균 성장률")
    past_5_years: Optional[float] = Field(default=None, description="과거 5년 연평균 성장률")


class EquityEstimatesData(BaseData):
    """통합 추정치 표준 데이터"""

    symbol: str = Field(description="종목 코드")
    eps: Dict[str, Any] = Field(default_factory=dict, description="EPS 추정치")
    revenue: Dict[str, Any] = Field(default_factory=dict, description="매출 추정치")
    price_target: Dict[str, Any] = Field(default_factory=dict, description="목표주가")
    recommendations: Dict[str, Any] = Field(default_factory=dict, description="컨센서스 레이팅")
    revisions: Dict[str, Any] = Field(default_factory=dict, description="추정치 수정 이력")

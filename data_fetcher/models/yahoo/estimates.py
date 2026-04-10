"""Yahoo Finance Estimates Model (애널리스트 추정치)"""
from typing import Optional, List, Dict, Any
from pydantic import Field
from data_fetcher.models.base import BaseQueryParams, BaseData


class YFinanceEstimatesQueryParams(BaseQueryParams):
    """애널리스트 추정치 조회 파라미터"""

    symbol: str = Field(description="종목 코드 (예: AAPL, MSFT)")


class YFinancePriceTargetData(BaseData):
    """목표주가 데이터"""

    symbol: str = Field(description="종목 코드")
    current_price: Optional[float] = Field(default=None, description="현재가")
    target_high: Optional[float] = Field(default=None, description="목표가 최고")
    target_low: Optional[float] = Field(default=None, description="목표가 최저")
    target_mean: Optional[float] = Field(default=None, description="목표가 평균")
    target_median: Optional[float] = Field(default=None, description="목표가 중앙값")
    number_of_analysts: Optional[int] = Field(default=None, description="애널리스트 수")


class YFinanceEarningsEstimateData(BaseData):
    """수익 추정치 데이터"""

    symbol: str = Field(description="종목 코드")
    period: str = Field(description="기간 (0q, +1q, 0y, +1y)")
    avg: Optional[float] = Field(default=None, description="EPS 추정 평균")
    low: Optional[float] = Field(default=None, description="EPS 추정 최저")
    high: Optional[float] = Field(default=None, description="EPS 추정 최고")
    year_ago_eps: Optional[float] = Field(default=None, description="전년 동기 EPS")
    number_of_analysts: Optional[int] = Field(default=None, description="애널리스트 수")
    growth: Optional[float] = Field(default=None, description="성장률")


class YFinanceRevenueEstimateData(BaseData):
    """매출 추정치 데이터"""

    symbol: str = Field(description="종목 코드")
    period: str = Field(description="기간 (0q, +1q, 0y, +1y)")
    avg: Optional[float] = Field(default=None, description="매출 추정 평균")
    low: Optional[float] = Field(default=None, description="매출 추정 최저")
    high: Optional[float] = Field(default=None, description="매출 추정 최고")
    year_ago_revenue: Optional[float] = Field(default=None, description="전년 동기 매출")
    number_of_analysts: Optional[int] = Field(default=None, description="애널리스트 수")
    growth: Optional[float] = Field(default=None, description="성장률")


class YFinanceGrowthEstimateData(BaseData):
    """성장 추정치 데이터"""

    symbol: str = Field(description="종목 코드")
    current_quarter: Optional[float] = Field(default=None, description="현재 분기 성장률")
    next_quarter: Optional[float] = Field(default=None, description="다음 분기 성장률")
    current_year: Optional[float] = Field(default=None, description="현재 연도 성장률")
    next_year: Optional[float] = Field(default=None, description="다음 연도 성장률")
    next_5_years: Optional[float] = Field(default=None, description="향후 5년 연평균 성장률")
    past_5_years: Optional[float] = Field(default=None, description="과거 5년 연평균 성장률")


class YFinanceEstimatesData(BaseData):
    """통합 추정치 데이터"""

    symbol: str = Field(description="종목 코드")

    # EPS 추정치: {period_key: {estimate, low, high, year_ago, num_analysts, growth}}
    eps: Dict[str, Any] = Field(default_factory=dict)

    # 매출 추정치: {period_key: {...}}
    revenue: Dict[str, Any] = Field(default_factory=dict)

    # 목표주가
    price_target: Dict[str, Any] = Field(default_factory=dict)

    # 애널리스트 컨센서스 레이팅
    recommendations: Dict[str, Any] = Field(default_factory=dict)

    # EPS 수정 이력
    revisions: Dict[str, Any] = Field(default_factory=dict)

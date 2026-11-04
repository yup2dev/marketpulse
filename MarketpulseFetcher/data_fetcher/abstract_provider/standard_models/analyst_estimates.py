"""Standard Model: Analyst Estimates (애널리스트 추정치)"""
from datetime import date as date_type
from typing import Literal, Optional

from pydantic import Field

from data_fetcher.abstract_provider.abstract.data import BaseData
from data_fetcher.abstract_provider.abstract.query_params import BaseQueryParams


class AnalystEstimatesQueryParams(BaseQueryParams):
    """애널리스트 추정치 조회 표준 파라미터"""

    symbol: str = Field(description="종목 코드")
    period: Optional[Literal["annual", "quarterly"]] = Field(
        default="annual", description="보고 주기"
    )
    limit: Optional[int] = Field(default=10, description="최대 결과 수")


class AnalystEstimatesData(BaseData):
    """애널리스트 추정치 표준 데이터"""

    symbol: str = Field(description="종목 코드")
    date: date_type = Field(description="추정치 날짜")

    # 매출 추정치
    estimated_revenue_low: Optional[float] = Field(default=None, description="매출 추정 하한")
    estimated_revenue_high: Optional[float] = Field(default=None, description="매출 추정 상한")
    estimated_revenue_avg: Optional[float] = Field(default=None, description="매출 추정 평균")
    number_analyst_estimated_revenue: Optional[int] = Field(default=None, description="매출 추정 애널리스트 수")

    # EPS 추정치
    estimated_eps_low: Optional[float] = Field(default=None, description="EPS 추정 하한")
    estimated_eps_high: Optional[float] = Field(default=None, description="EPS 추정 상한")
    estimated_eps_avg: Optional[float] = Field(default=None, description="EPS 추정 평균")
    number_analyst_estimated_eps: Optional[int] = Field(default=None, description="EPS 추정 애널리스트 수")

    # EBITDA 추정치
    estimated_ebitda_low: Optional[float] = Field(default=None, description="EBITDA 추정 하한")
    estimated_ebitda_high: Optional[float] = Field(default=None, description="EBITDA 추정 상한")
    estimated_ebitda_avg: Optional[float] = Field(default=None, description="EBITDA 추정 평균")

    # 순이익 추정치
    estimated_net_income_low: Optional[float] = Field(default=None, description="순이익 추정 하한")
    estimated_net_income_high: Optional[float] = Field(default=None, description="순이익 추정 상한")
    estimated_net_income_avg: Optional[float] = Field(default=None, description="순이익 추정 평균")

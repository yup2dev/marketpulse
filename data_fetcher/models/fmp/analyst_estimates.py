"""FMP Analyst Estimates Model"""
from datetime import date as date_type
from typing import Optional
from pydantic import Field
from data_fetcher.models.base import BaseQueryParams, BaseData


class AnalystEstimatesQueryParams(BaseQueryParams):
    """애널리스트 추정치 조회 파라미터"""

    symbol: str = Field(
        description="종목 심볼 (예: AAPL, TSLA)"
    )
    period: Optional[str] = Field(
        default="annual",
        description="기간 (annual: 연간, quarterly: 분기)"
    )
    limit: Optional[int] = Field(
        default=10,
        description="최대 결과 수"
    )
    page: Optional[int] = Field(
        default=0,
        description="페이지 번호"
    )


class AnalystEstimatesData(BaseData):
    """애널리스트 추정치 데이터"""

    symbol: str = Field(
        description="종목 심볼"
    )
    date: date_type = Field(
        description="추정치 날짜"
    )

    # === 매출 추정치 ===
    estimated_revenue_low: Optional[float] = Field(
        default=None,
        description="매출 추정치 하한"
    )
    estimated_revenue_high: Optional[float] = Field(
        default=None,
        description="매출 추정치 상한"
    )
    estimated_revenue_avg: Optional[float] = Field(
        default=None,
        description="매출 추정치 평균"
    )
    number_analyst_estimated_revenue: Optional[int] = Field(
        default=None,
        description="매출 추정 애널리스트 수"
    )

    # === EPS 추정치 ===
    estimated_eps_low: Optional[float] = Field(
        default=None,
        description="EPS 추정치 하한"
    )
    estimated_eps_high: Optional[float] = Field(
        default=None,
        description="EPS 추정치 상한"
    )
    estimated_eps_avg: Optional[float] = Field(
        default=None,
        description="EPS 추정치 평균"
    )
    number_analyst_estimated_eps: Optional[int] = Field(
        default=None,
        description="EPS 추정 애널리스트 수"
    )

    # === EBITDA 추정치 ===
    estimated_ebitda_low: Optional[float] = Field(
        default=None,
        description="EBITDA 추정치 하한"
    )
    estimated_ebitda_high: Optional[float] = Field(
        default=None,
        description="EBITDA 추정치 상한"
    )
    estimated_ebitda_avg: Optional[float] = Field(
        default=None,
        description="EBITDA 추정치 평균"
    )
    number_analyst_estimated_ebitda: Optional[int] = Field(
        default=None,
        description="EBITDA 추정 애널리스트 수"
    )

    # === EBIT 추정치 ===
    estimated_ebit_low: Optional[float] = Field(
        default=None,
        description="EBIT 추정치 하한"
    )
    estimated_ebit_high: Optional[float] = Field(
        default=None,
        description="EBIT 추정치 상한"
    )
    estimated_ebit_avg: Optional[float] = Field(
        default=None,
        description="EBIT 추정치 평균"
    )
    number_analyst_estimated_ebit: Optional[int] = Field(
        default=None,
        description="EBIT 추정 애널리스트 수"
    )

    # === 순이익 추정치 ===
    estimated_net_income_low: Optional[float] = Field(
        default=None,
        description="순이익 추정치 하한"
    )
    estimated_net_income_high: Optional[float] = Field(
        default=None,
        description="순이익 추정치 상한"
    )
    estimated_net_income_avg: Optional[float] = Field(
        default=None,
        description="순이익 추정치 평균"
    )
    number_analyst_estimated_net_income: Optional[int] = Field(
        default=None,
        description="순이익 추정 애널리스트 수"
    )

    # === SGA 비용 추정치 ===
    estimated_sga_expense_low: Optional[float] = Field(
        default=None,
        description="판매관리비 추정치 하한"
    )
    estimated_sga_expense_high: Optional[float] = Field(
        default=None,
        description="판매관리비 추정치 상한"
    )
    estimated_sga_expense_avg: Optional[float] = Field(
        default=None,
        description="판매관리비 추정치 평균"
    )
    number_analyst_estimated_sga_expense: Optional[int] = Field(
        default=None,
        description="판매관리비 추정 애널리스트 수"
    )
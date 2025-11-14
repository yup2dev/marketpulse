"""Income Statement Standard Model"""
from datetime import date as date_type
from typing import Optional
from pydantic import Field
from app.models.standard_models.base import BaseQueryParams, BaseData


class IncomeStatementQueryParams(BaseQueryParams):
    """손익계산서 조회 파라미터"""

    symbol: str = Field(
        description="종목 코드"
    )
    period: str = Field(
        default="annual",
        description="기간 (annual, quarterly)"
    )
    limit: int = Field(
        default=4,
        description="조회할 기간 수"
    )


class IncomeStatementData(BaseData):
    """손익계산서 데이터"""

    symbol: str = Field(
        description="종목 코드"
    )
    period_ending: date_type = Field(
        description="회계기간 종료일"
    )
    fiscal_period: Optional[str] = Field(
        default=None,
        description="회계 기간"
    )

    # === 매출 (Revenue) ===
    revenue: Optional[float] = Field(
        default=None,
        description="총 매출"
    )
    cost_of_revenue: Optional[float] = Field(
        default=None,
        description="매출원가"
    )
    gross_profit: Optional[float] = Field(
        default=None,
        description="매출총이익"
    )

    # === 운영비용 (Operating Expenses) ===
    operating_expenses: Optional[float] = Field(
        default=None,
        description="영업비용"
    )
    research_and_development: Optional[float] = Field(
        default=None,
        description="연구개발비"
    )
    selling_general_administrative: Optional[float] = Field(
        default=None,
        description="판매관리비"
    )
    depreciation_amortization: Optional[float] = Field(
        default=None,
        description="감가상각비"
    )

    # === 영업이익 (Operating Income) ===
    operating_income: Optional[float] = Field(
        default=None,
        description="영업이익"
    )
    ebitda: Optional[float] = Field(
        default=None,
        description="EBITDA (이자, 세금, 감가상각 전 이익)"
    )
    ebit: Optional[float] = Field(
        default=None,
        description="EBIT (이자, 세금 전 이익)"
    )

    # === 영업외 손익 ===
    interest_income: Optional[float] = Field(
        default=None,
        description="이자수익"
    )
    interest_expense: Optional[float] = Field(
        default=None,
        description="이자비용"
    )
    other_income: Optional[float] = Field(
        default=None,
        description="기타수익"
    )
    other_expense: Optional[float] = Field(
        default=None,
        description="기타비용"
    )

    # === 법인세 전 이익 ===
    income_before_tax: Optional[float] = Field(
        default=None,
        description="법인세 차감 전 순이익"
    )
    income_tax_expense: Optional[float] = Field(
        default=None,
        description="법인세 비용"
    )

    # === 순이익 (Net Income) ===
    net_income: Optional[float] = Field(
        default=None,
        description="당기순이익"
    )
    net_income_continuing: Optional[float] = Field(
        default=None,
        description="계속사업 순이익"
    )
    net_income_discontinued: Optional[float] = Field(
        default=None,
        description="중단사업 순이익"
    )

    # === 주당 지표 (Per Share) ===
    eps_basic: Optional[float] = Field(
        default=None,
        description="기본 주당순이익 (EPS)"
    )
    eps_diluted: Optional[float] = Field(
        default=None,
        description="희석 주당순이익"
    )
    weighted_average_shares: Optional[float] = Field(
        default=None,
        description="가중평균 발행주식수"
    )
    weighted_average_shares_diluted: Optional[float] = Field(
        default=None,
        description="희석 가중평균 발행주식수"
    )

    # === 이익률 (Margins) ===
    gross_margin: Optional[float] = Field(
        default=None,
        description="매출총이익률 (%)"
    )
    operating_margin: Optional[float] = Field(
        default=None,
        description="영업이익률 (%)"
    )
    net_margin: Optional[float] = Field(
        default=None,
        description="순이익률 (%)"
    )

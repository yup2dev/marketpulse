"""Balance Sheet Standard Model"""
from datetime import date as date_type
from typing import Optional
from pydantic import Field
from app.models.standard_models.base import BaseQueryParams, BaseData


class BalanceSheetQueryParams(BaseQueryParams):
    """대차대조표 조회 파라미터"""

    symbol: str = Field(
        description="종목 코드 (예: AAPL, MSFT)"
    )
    period: str = Field(
        default="annual",
        description="기간 (annual, quarterly)"
    )
    limit: int = Field(
        default=4,
        description="조회할 기간 수"
    )


class BalanceSheetData(BaseData):
    """대차대조표 데이터"""

    symbol: str = Field(
        description="종목 코드"
    )
    period_ending: date_type = Field(
        description="회계기간 종료일"
    )
    fiscal_period: Optional[str] = Field(
        default=None,
        description="회계 기간 (FY, Q1, Q2, Q3, Q4)"
    )

    # === 자산 (Assets) ===
    total_assets: Optional[float] = Field(
        default=None,
        description="총 자산"
    )
    current_assets: Optional[float] = Field(
        default=None,
        description="유동 자산"
    )
    cash_and_equivalents: Optional[float] = Field(
        default=None,
        description="현금 및 현금성 자산"
    )
    short_term_investments: Optional[float] = Field(
        default=None,
        description="단기 투자"
    )
    accounts_receivable: Optional[float] = Field(
        default=None,
        description="매출채권"
    )
    inventory: Optional[float] = Field(
        default=None,
        description="재고자산"
    )
    non_current_assets: Optional[float] = Field(
        default=None,
        description="비유동 자산"
    )
    property_plant_equipment: Optional[float] = Field(
        default=None,
        description="유형자산 (PP&E)"
    )
    intangible_assets: Optional[float] = Field(
        default=None,
        description="무형자산"
    )
    goodwill: Optional[float] = Field(
        default=None,
        description="영업권"
    )

    # === 부채 (Liabilities) ===
    total_liabilities: Optional[float] = Field(
        default=None,
        description="총 부채"
    )
    current_liabilities: Optional[float] = Field(
        default=None,
        description="유동 부채"
    )
    accounts_payable: Optional[float] = Field(
        default=None,
        description="매입채무"
    )
    short_term_debt: Optional[float] = Field(
        default=None,
        description="단기 차입금"
    )
    non_current_liabilities: Optional[float] = Field(
        default=None,
        description="비유동 부채"
    )
    long_term_debt: Optional[float] = Field(
        default=None,
        description="장기 차입금"
    )
    total_debt: Optional[float] = Field(
        default=None,
        description="총 차입금"
    )

    # === 자본 (Equity) ===
    total_equity: Optional[float] = Field(
        default=None,
        description="총 자본"
    )
    common_stock: Optional[float] = Field(
        default=None,
        description="보통주 자본금"
    )
    retained_earnings: Optional[float] = Field(
        default=None,
        description="이익잉여금"
    )
    treasury_stock: Optional[float] = Field(
        default=None,
        description="자기주식"
    )

    # === 계산된 지표 ===
    working_capital: Optional[float] = Field(
        default=None,
        description="운전자본 (유동자산 - 유동부채)"
    )
    book_value_per_share: Optional[float] = Field(
        default=None,
        description="주당 순자산"
    )

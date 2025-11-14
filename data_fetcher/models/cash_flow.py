"""Cash Flow Statement Standard Model"""
from datetime import date as date_type
from typing import Optional
from pydantic import Field
from app.models.standard_models.base import BaseQueryParams, BaseData


class CashFlowQueryParams(BaseQueryParams):
    """현금흐름표 조회 파라미터"""

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


class CashFlowData(BaseData):
    """현금흐름표 데이터"""

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

    # === 영업활동 현금흐름 (Operating Activities) ===
    operating_cash_flow: Optional[float] = Field(
        default=None,
        description="영업활동 현금흐름"
    )
    net_income: Optional[float] = Field(
        default=None,
        description="당기순이익"
    )
    depreciation_amortization: Optional[float] = Field(
        default=None,
        description="감가상각비"
    )
    stock_based_compensation: Optional[float] = Field(
        default=None,
        description="주식기반보상"
    )
    deferred_income_tax: Optional[float] = Field(
        default=None,
        description="이연법인세"
    )
    change_in_working_capital: Optional[float] = Field(
        default=None,
        description="운전자본 변동"
    )
    change_in_receivables: Optional[float] = Field(
        default=None,
        description="매출채권 변동"
    )
    change_in_inventory: Optional[float] = Field(
        default=None,
        description="재고자산 변동"
    )
    change_in_payables: Optional[float] = Field(
        default=None,
        description="매입채무 변동"
    )

    # === 투자활동 현금흐름 (Investing Activities) ===
    investing_cash_flow: Optional[float] = Field(
        default=None,
        description="투자활동 현금흐름"
    )
    capital_expenditure: Optional[float] = Field(
        default=None,
        description="자본적 지출 (CapEx)"
    )
    acquisitions: Optional[float] = Field(
        default=None,
        description="인수합병"
    )
    purchase_of_investments: Optional[float] = Field(
        default=None,
        description="투자자산 매입"
    )
    sale_of_investments: Optional[float] = Field(
        default=None,
        description="투자자산 매각"
    )
    purchase_of_ppe: Optional[float] = Field(
        default=None,
        description="유형자산 매입"
    )

    # === 재무활동 현금흐름 (Financing Activities) ===
    financing_cash_flow: Optional[float] = Field(
        default=None,
        description="재무활동 현금흐름"
    )
    dividends_paid: Optional[float] = Field(
        default=None,
        description="배당금 지급"
    )
    stock_repurchase: Optional[float] = Field(
        default=None,
        description="자사주 매입"
    )
    debt_issuance: Optional[float] = Field(
        default=None,
        description="차입금 발행"
    )
    debt_repayment: Optional[float] = Field(
        default=None,
        description="차입금 상환"
    )
    common_stock_issued: Optional[float] = Field(
        default=None,
        description="주식 발행"
    )

    # === 현금 증감 ===
    net_change_in_cash: Optional[float] = Field(
        default=None,
        description="현금 및 현금성자산 순증감"
    )
    beginning_cash: Optional[float] = Field(
        default=None,
        description="기초 현금"
    )
    ending_cash: Optional[float] = Field(
        default=None,
        description="기말 현금"
    )

    # === 자유 현금흐름 (Free Cash Flow) ===
    free_cash_flow: Optional[float] = Field(
        default=None,
        description="잉여현금흐름 (OCF - CapEx)"
    )

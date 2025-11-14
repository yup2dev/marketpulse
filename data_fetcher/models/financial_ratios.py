"""Financial Ratios Standard Model (재무비율)"""
from datetime import date as date_type
from typing import Optional
from pydantic import Field
from app.models.standard_models.base import BaseQueryParams, BaseData


class FinancialRatiosQueryParams(BaseQueryParams):
    """재무비율 조회 파라미터"""

    symbol: str = Field(
        description="종목 코드"
    )
    period: str = Field(
        default="annual",
        description="기간 (annual, quarterly, ttm)"
    )


class FinancialRatiosData(BaseData):
    """재무비율 데이터"""

    symbol: str = Field(
        description="종목 코드"
    )
    period_ending: Optional[date_type] = Field(
        default=None,
        description="회계기간 종료일"
    )

    # === 밸류에이션 비율 (Valuation Ratios) ===
    pe_ratio: Optional[float] = Field(
        default=None,
        description="주가수익비율 (P/E Ratio)"
    )
    forward_pe: Optional[float] = Field(
        default=None,
        description="선행 P/E"
    )
    peg_ratio: Optional[float] = Field(
        default=None,
        description="PEG 비율"
    )
    price_to_book: Optional[float] = Field(
        default=None,
        description="주가순자산비율 (P/B Ratio)"
    )
    price_to_sales: Optional[float] = Field(
        default=None,
        description="주가매출비율 (P/S Ratio)"
    )
    ev_to_revenue: Optional[float] = Field(
        default=None,
        description="EV/Revenue"
    )
    ev_to_ebitda: Optional[float] = Field(
        default=None,
        description="EV/EBITDA"
    )
    enterprise_value: Optional[float] = Field(
        default=None,
        description="기업가치 (EV)"
    )

    # === 수익성 비율 (Profitability Ratios) ===
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
    ebitda_margin: Optional[float] = Field(
        default=None,
        description="EBITDA 마진 (%)"
    )
    return_on_assets: Optional[float] = Field(
        default=None,
        description="총자산이익률 (ROA, %)"
    )
    return_on_equity: Optional[float] = Field(
        default=None,
        description="자기자본이익률 (ROE, %)"
    )
    return_on_invested_capital: Optional[float] = Field(
        default=None,
        description="투하자본이익률 (ROIC, %)"
    )

    # === 유동성 비율 (Liquidity Ratios) ===
    current_ratio: Optional[float] = Field(
        default=None,
        description="유동비율"
    )
    quick_ratio: Optional[float] = Field(
        default=None,
        description="당좌비율"
    )
    cash_ratio: Optional[float] = Field(
        default=None,
        description="현금비율"
    )
    operating_cash_flow_ratio: Optional[float] = Field(
        default=None,
        description="영업현금흐름비율"
    )

    # === 레버리지 비율 (Leverage Ratios) ===
    debt_to_equity: Optional[float] = Field(
        default=None,
        description="부채자본비율 (D/E Ratio)"
    )
    debt_to_assets: Optional[float] = Field(
        default=None,
        description="부채비율"
    )
    total_debt_ratio: Optional[float] = Field(
        default=None,
        description="차입금의존도"
    )
    interest_coverage: Optional[float] = Field(
        default=None,
        description="이자보상배율"
    )
    debt_service_coverage: Optional[float] = Field(
        default=None,
        description="부채상환배율"
    )

    # === 효율성 비율 (Efficiency Ratios) ===
    asset_turnover: Optional[float] = Field(
        default=None,
        description="총자산회전율"
    )
    inventory_turnover: Optional[float] = Field(
        default=None,
        description="재고자산회전율"
    )
    receivables_turnover: Optional[float] = Field(
        default=None,
        description="매출채권회전율"
    )
    days_sales_outstanding: Optional[float] = Field(
        default=None,
        description="매출채권회수기간 (일)"
    )
    days_inventory_outstanding: Optional[float] = Field(
        default=None,
        description="재고자산보유기간 (일)"
    )
    cash_conversion_cycle: Optional[float] = Field(
        default=None,
        description="현금전환주기 (일)"
    )

    # === 주당 지표 (Per Share Metrics) ===
    earnings_per_share: Optional[float] = Field(
        default=None,
        description="주당순이익 (EPS)"
    )
    book_value_per_share: Optional[float] = Field(
        default=None,
        description="주당순자산 (BVPS)"
    )
    revenue_per_share: Optional[float] = Field(
        default=None,
        description="주당매출"
    )
    free_cash_flow_per_share: Optional[float] = Field(
        default=None,
        description="주당잉여현금흐름"
    )

    # === 성장률 (Growth Rates) ===
    revenue_growth: Optional[float] = Field(
        default=None,
        description="매출 성장률 (%, YoY)"
    )
    earnings_growth: Optional[float] = Field(
        default=None,
        description="이익 성장률 (%, YoY)"
    )
    eps_growth: Optional[float] = Field(
        default=None,
        description="EPS 성장률 (%, YoY)"
    )

    # === 배당 관련 (Dividend Metrics) ===
    dividend_yield: Optional[float] = Field(
        default=None,
        description="배당수익률 (%)"
    )
    dividend_payout_ratio: Optional[float] = Field(
        default=None,
        description="배당성향 (%)"
    )
    dividend_per_share: Optional[float] = Field(
        default=None,
        description="주당배당금 (DPS)"
    )

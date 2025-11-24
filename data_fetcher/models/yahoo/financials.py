"""Yahoo Finance Financials Model (재무제표)"""
from typing import Optional
from datetime import datetime
from pydantic import Field
from data_fetcher.models.base import BaseQueryParams, BaseData


class FinancialsQueryParams(BaseQueryParams):
    """재무제표 조회 파라미터"""

    symbol: str = Field(
        description="종목 코드 (예: AAPL, MSFT)"
    )
    freq: str = Field(
        default="annual",
        description="보고 주기 ('quarterly' 또는 'annual')"
    )


class FinancialsData(BaseData):
    """재무제표 데이터"""

    # 기본 정보
    symbol: str = Field(description="종목 코드")
    as_of_date: Optional[datetime] = Field(default=None, description="재무제표 기준일")

    # Income Statement (손익계산서)
    total_revenue: Optional[float] = Field(default=None, description="총 매출")
    cost_of_revenue: Optional[float] = Field(default=None, description="매출원가")
    gross_profit: Optional[float] = Field(default=None, description="매출총이익")
    operating_expense: Optional[float] = Field(default=None, description="영업비용")
    operating_income: Optional[float] = Field(default=None, description="영업이익")
    net_income: Optional[float] = Field(default=None, description="순이익")
    ebitda: Optional[float] = Field(default=None, description="EBITDA")
    basic_eps: Optional[float] = Field(default=None, description="기본 주당순이익")
    diluted_eps: Optional[float] = Field(default=None, description="희석 주당순이익")

    # Balance Sheet (재무상태표)
    total_assets: Optional[float] = Field(default=None, description="총 자산")
    current_assets: Optional[float] = Field(default=None, description="유동 자산")
    cash: Optional[float] = Field(default=None, description="현금 및 현금성 자산")
    total_liabilities_net_minority_interest: Optional[float] = Field(default=None, description="총 부채")
    current_liabilities: Optional[float] = Field(default=None, description="유동 부채")
    stockholders_equity: Optional[float] = Field(default=None, description="자본")
    total_debt: Optional[float] = Field(default=None, description="총 부채")

    # Cash Flow Statement (현금흐름표)
    operating_cash_flow: Optional[float] = Field(default=None, description="영업활동 현금흐름")
    investing_cash_flow: Optional[float] = Field(default=None, description="투자활동 현금흐름")
    financing_cash_flow: Optional[float] = Field(default=None, description="재무활동 현금흐름")
    free_cash_flow: Optional[float] = Field(default=None, description="잉여현금흐름")
    capital_expenditure: Optional[float] = Field(default=None, description="자본적 지출")

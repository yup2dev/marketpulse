"""Standard Model: Financials (재무제표 통합 — 손익+재무상태+현금흐름)

Yahoo Finance처럼 세 재무제표를 단일 응답으로 반환하는 provider를 위한 표준 모델.
개별 제표가 필요하면 income_statement / balance_sheet / cash_flow 표준 모델을 사용한다.
"""
from datetime import date as date_type
from typing import Literal, Optional

from pydantic import Field

from data_fetcher.abstract_provider.abstract.data import BaseData
from data_fetcher.abstract_provider.abstract.query_params import BaseQueryParams


class FinancialsQueryParams(BaseQueryParams):
    symbol: str = Field(description="종목 코드")
    period: Optional[Literal["annual", "quarterly"]] = Field(
        default="annual", description="보고 주기"
    )


class FinancialsData(BaseData):
    symbol: str = Field(description="종목 코드")
    date: date_type = Field(description="재무제표 기준일")
    period: Optional[str] = Field(default=None, description="보고 기간 (annual / quarterly)")

    # ── 손익계산서 ─────────────────────────────────────────────────────
    revenue: Optional[float] = Field(default=None, description="매출액")
    cost_of_revenue: Optional[float] = Field(default=None, description="매출원가")
    gross_profit: Optional[float] = Field(default=None, description="매출총이익")
    operating_expenses: Optional[float] = Field(default=None, description="영업비용")
    operating_income: Optional[float] = Field(default=None, description="영업이익")
    net_income: Optional[float] = Field(default=None, description="당기순이익")
    ebitda: Optional[float] = Field(default=None, description="EBITDA")
    eps: Optional[float] = Field(default=None, description="기본 EPS")
    eps_diluted: Optional[float] = Field(default=None, description="희석 EPS")

    # ── 재무상태표 ─────────────────────────────────────────────────────
    total_assets: Optional[float] = Field(default=None, description="총 자산")
    current_assets: Optional[float] = Field(default=None, description="유동 자산")
    cash: Optional[float] = Field(default=None, description="현금 및 현금성 자산")
    total_liabilities: Optional[float] = Field(default=None, description="총 부채")
    current_liabilities: Optional[float] = Field(default=None, description="유동 부채")
    stockholders_equity: Optional[float] = Field(default=None, description="자본 총계")
    total_debt: Optional[float] = Field(default=None, description="총 차입금")

    # ── 현금흐름표 ─────────────────────────────────────────────────────
    operating_cash_flow: Optional[float] = Field(default=None, description="영업활동 현금흐름")
    investing_cash_flow: Optional[float] = Field(default=None, description="투자활동 현금흐름")
    financing_cash_flow: Optional[float] = Field(default=None, description="재무활동 현금흐름")
    free_cash_flow: Optional[float] = Field(default=None, description="잉여현금흐름")
    capital_expenditure: Optional[float] = Field(default=None, description="자본적 지출")

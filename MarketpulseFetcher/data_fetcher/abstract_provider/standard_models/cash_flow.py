"""Standard Model: Cash Flow Statement (현금흐름표)"""
from datetime import date as date_type
from typing import Literal, Optional

from pydantic import Field

from data_fetcher.abstract_provider.abstract.data import BaseData
from data_fetcher.abstract_provider.abstract.query_params import BaseQueryParams


class CashFlowQueryParams(BaseQueryParams):
    symbol: str = Field(description="종목 코드")
    period: Optional[Literal["annual", "quarterly"]] = Field(
        default="annual", description="보고 주기"
    )
    limit: Optional[int] = Field(default=5, description="최대 결과 수")


class CashFlowData(BaseData):
    # symbol/date 는 일부 provider(SEC XBRL 등)가 period_ending 기반이라 Optional.
    symbol: Optional[str] = Field(default=None, description="종목 코드")
    date: Optional[date_type] = Field(default=None, description="기준일")
    period: Optional[str] = Field(default=None, description="보고 기간")

    operating_cash_flow: Optional[float] = Field(default=None, description="영업활동 현금흐름")
    investing_cash_flow: Optional[float] = Field(default=None, description="투자활동 현금흐름")
    financing_cash_flow: Optional[float] = Field(default=None, description="재무활동 현금흐름")
    free_cash_flow: Optional[float] = Field(default=None, description="잉여현금흐름")
    capital_expenditure: Optional[float] = Field(default=None, description="자본적 지출")
    net_change_in_cash: Optional[float] = Field(default=None, description="현금 순증감")
    depreciation_and_amortization: Optional[float] = Field(default=None, description="감가상각비")
    stock_based_compensation: Optional[float] = Field(default=None, description="주식보상비용")
    net_income: Optional[float] = Field(default=None, description="당기순이익 (현금흐름 기준)")

"""Standard Model: Balance Sheet (재무상태표)"""
from datetime import date as date_type
from typing import Literal, Optional

from pydantic import Field

from data_fetcher.abstract_provider.abstract.data import BaseData
from data_fetcher.abstract_provider.abstract.query_params import BaseQueryParams


class BalanceSheetQueryParams(BaseQueryParams):
    symbol: str = Field(description="종목 코드")
    period: Optional[Literal["annual", "quarterly"]] = Field(
        default="annual", description="보고 주기"
    )
    limit: Optional[int] = Field(default=5, description="최대 결과 수")


class BalanceSheetData(BaseData):
    # symbol/date 는 일부 provider(SEC XBRL 등)가 period_ending 기반이라 Optional.
    symbol: Optional[str] = Field(default=None, description="종목 코드")
    date: Optional[date_type] = Field(default=None, description="기준일")
    period: Optional[str] = Field(default=None, description="보고 기간")

    # 자산
    total_assets: Optional[float] = Field(default=None, description="총 자산")
    current_assets: Optional[float] = Field(default=None, description="유동 자산")
    cash: Optional[float] = Field(default=None, description="현금 및 현금성 자산")
    short_term_investments: Optional[float] = Field(default=None, description="단기 투자")
    net_receivables: Optional[float] = Field(default=None, description="순 매출채권")
    inventory: Optional[float] = Field(default=None, description="재고자산")
    other_current_assets: Optional[float] = Field(default=None, description="기타 유동 자산")
    non_current_assets: Optional[float] = Field(default=None, description="비유동 자산")
    property_plant_equipment: Optional[float] = Field(default=None, description="유형자산")
    goodwill: Optional[float] = Field(default=None, description="영업권")
    intangible_assets: Optional[float] = Field(default=None, description="무형자산")
    long_term_investments: Optional[float] = Field(default=None, description="장기 투자")

    # 부채
    total_liabilities: Optional[float] = Field(default=None, description="총 부채")
    current_liabilities: Optional[float] = Field(default=None, description="유동 부채")
    short_term_debt: Optional[float] = Field(default=None, description="단기 차입금")
    accounts_payable: Optional[float] = Field(default=None, description="매입채무")
    other_current_liabilities: Optional[float] = Field(default=None, description="기타 유동 부채")
    long_term_debt: Optional[float] = Field(default=None, description="장기 차입금")
    total_debt: Optional[float] = Field(default=None, description="총 차입금")

    # 자본
    stockholders_equity: Optional[float] = Field(default=None, description="자본 총계")
    retained_earnings: Optional[float] = Field(default=None, description="이익잉여금")
    common_stock: Optional[float] = Field(default=None, description="보통주 자본금")

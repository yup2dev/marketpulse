"""Equity Screener Standard Model — 재무 · 규모 조건으로 종목 고르기.

조건은 모두 선택 — 비우면 그 조건으로 거르지 않는다. 값이 없는 종목은 그 조건을 건 경우에만 빠진다.
roe · roa · profit_margin 은 % 값 (15 = 15%).
"""
from typing import Optional

from pydantic import Field

from data_fetcher.abstract_provider.abstract.data import BaseData
from data_fetcher.abstract_provider.abstract.query_params import BaseQueryParams

RANGE_FIELDS = (
    "market_cap", "beta", "pe_ratio", "pb_ratio", "roe", "roa", "profit_margin",
    "debt_to_equity", "current_ratio", "quick_ratio",
)


class EquityScreenerQueryParams(BaseQueryParams):
    market: Optional[str] = Field(default=None, description="domestic = 원화 종목, overseas = 그 외 (다른 값은 거르지 않는다)")
    sector: Optional[str] = Field(default=None, description="섹터 (쉼표로 여러 개, 대소문자 무시)")
    industry: Optional[str] = Field(default=None, description="업종")
    exchange: Optional[str] = Field(default=None, description="거래소")
    market_cap_min: Optional[float] = None
    market_cap_max: Optional[float] = None
    beta_min: Optional[float] = None
    beta_max: Optional[float] = None
    pe_ratio_min: Optional[float] = None
    pe_ratio_max: Optional[float] = None
    pb_ratio_min: Optional[float] = None
    pb_ratio_max: Optional[float] = None
    roe_min: Optional[float] = None
    roe_max: Optional[float] = None
    roa_min: Optional[float] = None
    roa_max: Optional[float] = None
    profit_margin_min: Optional[float] = None
    profit_margin_max: Optional[float] = None
    debt_to_equity_min: Optional[float] = None
    debt_to_equity_max: Optional[float] = None
    current_ratio_min: Optional[float] = None
    current_ratio_max: Optional[float] = None
    quick_ratio_min: Optional[float] = None
    quick_ratio_max: Optional[float] = None
    limit: Optional[int] = Field(default=None, ge=1, description="최대 종목 수")


class EquityScreenerData(BaseData):
    symbol: str = Field(description="종목 코드 (원시 코드 — KR 은 접미사 없는 숫자)")
    name: Optional[str] = Field(default=None, description="종목명")
    currency: Optional[str] = Field(default=None, description="통화")
    sector: Optional[str] = Field(default=None, description="섹터")
    industry: Optional[str] = Field(default=None, description="업종")
    exchange: Optional[str] = Field(default=None, description="거래소")
    market_cap: Optional[float] = Field(default=None, description="시가총액")
    beta: Optional[float] = Field(default=None, description="베타")
    pe_ratio: Optional[float] = Field(default=None, description="PER")
    pb_ratio: Optional[float] = Field(default=None, description="PBR")
    roe: Optional[float] = Field(default=None, description="ROE (%)")
    roa: Optional[float] = Field(default=None, description="ROA (%)")
    profit_margin: Optional[float] = Field(default=None, description="순이익률 (%)")
    debt_to_equity: Optional[float] = Field(default=None, description="부채비율 D/E")
    current_ratio: Optional[float] = Field(default=None, description="유동비율")
    quick_ratio: Optional[float] = Field(default=None, description="당좌비율")

"""Yahoo Finance Key Metrics Model"""
from typing import Optional
from pydantic import Field
from data_fetcher.models.base import BaseQueryParams, BaseData


class YFinanceKeyMetricsQueryParams(BaseQueryParams):
    symbol: str = Field(description="종목 코드 (예: AAPL)")


class YFinanceKeyMetricsData(BaseData):
    """핵심 재무 지표 데이터"""

    symbol: str

    # Valuation
    pe_ratio: Optional[float] = None
    forward_pe: Optional[float] = None
    peg_ratio: Optional[float] = None
    ps_ratio: Optional[float] = None
    pb_ratio: Optional[float] = None
    ev_ebitda: Optional[float] = None
    ev_revenue: Optional[float] = None
    price_to_fcf: Optional[float] = None

    # Profitability
    gross_margin: Optional[float] = None
    operating_margin: Optional[float] = None
    net_margin: Optional[float] = None
    roe: Optional[float] = None
    roa: Optional[float] = None

    # Liquidity & Leverage
    current_ratio: Optional[float] = None
    quick_ratio: Optional[float] = None
    debt_to_equity: Optional[float] = None

    # Cash Flow
    operating_cash_flow: Optional[float] = None
    free_cash_flow: Optional[float] = None

    # Per Share
    eps_trailing: Optional[float] = None
    eps_forward: Optional[float] = None
    book_value: Optional[float] = None
    revenue_per_share: Optional[float] = None

    # Dividend
    dividend_yield: Optional[float] = None
    payout_ratio: Optional[float] = None

    # Growth
    revenue_growth: Optional[float] = None
    earnings_growth: Optional[float] = None
    earnings_quarterly_growth: Optional[float] = None

    # Market Data
    market_cap: Optional[float] = None
    enterprise_value: Optional[float] = None
    beta: Optional[float] = None
    week_52_high: Optional[float] = None
    week_52_low: Optional[float] = None
    ma_50_day: Optional[float] = None
    ma_200_day: Optional[float] = None

    # Share Statistics
    shares_outstanding: Optional[float] = None
    float_shares: Optional[float] = None
    short_ratio: Optional[float] = None
    short_percent_of_float: Optional[float] = None

    # Efficiency
    interest_coverage: Optional[float] = None
    asset_turnover: Optional[float] = None
    inventory_turnover: Optional[float] = None

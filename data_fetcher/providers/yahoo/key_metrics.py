"""Yahoo Finance Key Metrics Model"""
from typing import Optional
from pydantic import Field
from data_fetcher.abstract_provider.standard_models import KeyMetricsQueryParams, KeyMetricsData


class YFinanceKeyMetricsQueryParams(KeyMetricsQueryParams):
    pass


class YFinanceKeyMetricsData(KeyMetricsData):
    pass

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

    __alias_dict__ = {
        "pe_ratio": "trailingPE",
        "forward_pe": "forwardPE",
        "peg_ratio": "pegRatio",
        "ps_ratio": "priceToSalesTrailing12Months",
        "pb_ratio": "priceToBook",
        "ev_ebitda": "enterpriseToEbitda",
        "ev_revenue": "enterpriseToRevenue",
        "price_to_fcf": "priceToFreeCashflow",
        "gross_margin": "grossMargins",
        "operating_margin": "operatingMargins",
        "net_margin": "profitMargins",
        "roe": "returnOnEquity",
        "roa": "returnOnAssets",
        "current_ratio": "currentRatio",
        "quick_ratio": "quickRatio",
        "debt_to_equity": "debtToEquity",
        "operating_cash_flow": "operatingCashflow",
        "free_cash_flow": "freeCashflow",
        "eps_trailing": "trailingEps",
        "eps_forward": "forwardEps",
        "book_value": "bookValue",
        "revenue_per_share": "revenuePerShare",
        "dividend_yield": "dividendYield",
        "payout_ratio": "payoutRatio",
        "revenue_growth": "revenueGrowth",
        "earnings_growth": "earningsGrowth",
        "earnings_quarterly_growth": "earningsQuarterlyGrowth",
        "market_cap": "marketCap",
        "enterprise_value": "enterpriseValue",
        "week_52_high": "fiftyTwoWeekHigh",
        "week_52_low": "fiftyTwoWeekLow",
        "ma_50_day": "fiftyDayAverage",
        "ma_200_day": "twoHundredDayAverage",
        "shares_outstanding": "sharesOutstanding",
        "float_shares": "floatShares",
        "short_ratio": "shortRatio",
        "short_percent_of_float": "shortPercentOfFloat",
        "interest_coverage": "interestCoverage",
        "asset_turnover": "assetTurnover",
        "inventory_turnover": "inventoryTurnover",
    }


"""Yahoo Finance Key Metrics Fetcher"""
import logging
from typing import Any, Dict, List, Optional
import yfinance as yf

from data_fetcher.abstract_provider.abstract.fetcher import Fetcher

log = logging.getLogger(__name__)


class YFinanceKeyMetricsFetcher(Fetcher[YFinanceKeyMetricsQueryParams, YFinanceKeyMetricsData]):

    @staticmethod
    def transform_query(params: Dict[str, Any]) -> YFinanceKeyMetricsQueryParams:
        return YFinanceKeyMetricsQueryParams(**params)

    @staticmethod
    def extract_data(
        query: YFinanceKeyMetricsQueryParams,
        credentials: Optional[Dict[str, str]] = None,
        **kwargs: Any,
    ) -> Dict[str, Any]:
        ticker = yf.Ticker(query.symbol)
        return ticker.info

    @staticmethod
    def transform_data(
        query: YFinanceKeyMetricsQueryParams,
        data: Dict[str, Any],
        **kwargs: Any,
    ) -> List[YFinanceKeyMetricsData]:
        return [YFinanceKeyMetricsData.model_validate({**(data or {}), "symbol": query.symbol})]

"""Yahoo Finance Key Metrics Fetcher"""
import logging
from typing import Any, Dict, List, Optional
import yfinance as yf

from data_fetcher.fetchers.base import Fetcher
from data_fetcher.models.yahoo.key_metrics import YFinanceKeyMetricsQueryParams, YFinanceKeyMetricsData

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
        info = data or {}
        return [YFinanceKeyMetricsData(
            symbol=query.symbol,
            pe_ratio=info.get('trailingPE'),
            forward_pe=info.get('forwardPE'),
            peg_ratio=info.get('pegRatio'),
            ps_ratio=info.get('priceToSalesTrailing12Months'),
            pb_ratio=info.get('priceToBook'),
            ev_ebitda=info.get('enterpriseToEbitda'),
            ev_revenue=info.get('enterpriseToRevenue'),
            price_to_fcf=info.get('priceToFreeCashflow') or None,
            gross_margin=info.get('grossMargins'),
            operating_margin=info.get('operatingMargins'),
            net_margin=info.get('profitMargins'),
            roe=info.get('returnOnEquity'),
            roa=info.get('returnOnAssets'),
            current_ratio=info.get('currentRatio'),
            quick_ratio=info.get('quickRatio'),
            debt_to_equity=info.get('debtToEquity'),
            operating_cash_flow=info.get('operatingCashflow'),
            free_cash_flow=info.get('freeCashflow'),
            eps_trailing=info.get('trailingEps'),
            eps_forward=info.get('forwardEps'),
            book_value=info.get('bookValue'),
            revenue_per_share=info.get('revenuePerShare'),
            dividend_yield=info.get('dividendYield'),
            payout_ratio=info.get('payoutRatio'),
            revenue_growth=info.get('revenueGrowth'),
            earnings_growth=info.get('earningsGrowth'),
            earnings_quarterly_growth=info.get('earningsQuarterlyGrowth'),
            market_cap=info.get('marketCap'),
            enterprise_value=info.get('enterpriseValue'),
            beta=info.get('beta'),
            week_52_high=info.get('fiftyTwoWeekHigh'),
            week_52_low=info.get('fiftyTwoWeekLow'),
            ma_50_day=info.get('fiftyDayAverage'),
            ma_200_day=info.get('twoHundredDayAverage'),
            shares_outstanding=info.get('sharesOutstanding'),
            float_shares=info.get('floatShares'),
            short_ratio=info.get('shortRatio'),
            short_percent_of_float=info.get('shortPercentOfFloat'),
            interest_coverage=info.get('interestCoverage') or None,
            asset_turnover=info.get('assetTurnover') or None,
            inventory_turnover=info.get('inventoryTurnover') or None,
        )]

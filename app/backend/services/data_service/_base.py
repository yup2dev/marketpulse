"""DataServiceBase — provider executor registration and shared utilities."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent.parent))

# ── Fetchers ───────────────────────────────────────────────────────────────────
from data_fetcher.fetchers.yahoo.stock_price import YFinanceStockPriceFetcher
from data_fetcher.fetchers.yahoo.company_info import YFinanceCompanyInfoFetcher
from data_fetcher.fetchers.yahoo.financials import YFinanceFinancialsFetcher
from data_fetcher.fetchers.yahoo.dividends import YFinanceDividendsFetcher
from data_fetcher.fetchers.yahoo.balance_sheet import YFinanceBalanceSheetFetcher
from data_fetcher.fetchers.yahoo.insider_trading import (
    YFinanceInsiderHoldersFetcher,
    YFinanceInsiderTradingSummaryFetcher,
)
from data_fetcher.fetchers.yahoo.key_metrics import YFinanceKeyMetricsFetcher
from data_fetcher.fetchers.yahoo.quarterly_pnl import YFinanceQuarterlyPnLFetcher
from data_fetcher.fetchers.yahoo.holders import YFinanceHoldersFetcher
from data_fetcher.fetchers.yahoo.calendar import YFinanceCalendarFetcher
from data_fetcher.fetchers.yahoo.splits import YFinanceSplitsFetcher
from data_fetcher.fetchers.yahoo.filings import YFinanceFilingsFetcher
from data_fetcher.fetchers.yahoo.estimates import YFinanceEstimatesFetcher
from data_fetcher.fetchers.yahoo.management import YFinanceManagementFetcher
from data_fetcher.fetchers.yahoo.moat import YFinanceMoatFetcher
from data_fetcher.fetchers.yahoo.swot import YFinanceSWOTFetcher
from data_fetcher.fetchers.yahoo.scorecard import YFinanceScorecardFetcher
from data_fetcher.fetchers.polygon.earnings import PolygonEarningsFetcher
from data_fetcher.fetchers.polygon.news import PolygonNewsFetcher
from data_fetcher.fetchers.polygon.sentiment import PolygonStockSentimentFetcher
from data_fetcher.fetchers.social.sentiment import SocialSentimentFetcher
from data_fetcher.fetchers.fmp.search import FMPSearchFetcher
from data_fetcher.fetchers.fmp.active_stocks import FMPActiveStocksFetcher
from data_fetcher.fetchers.fmp.revenue_segments import FMPRevenueSegmentsFetcher
from data_fetcher.fetchers.fmp.analyst_data import FMPAnalystDataFetcher
from data_fetcher.fetchers.fred.gdp import FREDGDPFetcher
from data_fetcher.fetchers.fred.unemployment import FREDUnemploymentFetcher
from data_fetcher.fetchers.fred.cpi import FREDCPIFetcher
from data_fetcher.fetchers.fred.interest_rate import FREDInterestRateFetcher
from data_fetcher.fetchers.fred.retail_sales import FREDRetailSalesFetcher
from data_fetcher.fetchers.fred.consumer_sentiment import FREDConsumerSentimentFetcher
from data_fetcher.fetchers.fred.nonfarm_payroll import FREDNonfarmPayrollFetcher
from data_fetcher.fetchers.fred.housing_starts import FREDHousingStartsFetcher
from data_fetcher.fetchers.fred.industrial_production import FREDIndustrialProductionFetcher

# ── QueryParams ────────────────────────────────────────────────────────────────
from data_fetcher.models.yahoo.stock_price import YFinanceStockPriceQueryParams
from data_fetcher.models.yahoo.company_info import YFinanceCompanyInfoQueryParams
from data_fetcher.models.yahoo.key_metrics import YFinanceKeyMetricsQueryParams
from data_fetcher.models.yahoo.financials import YFinanceFinancialsQueryParams
from data_fetcher.models.yahoo.balance_sheet import YFinanceBalanceSheetQueryParams
from data_fetcher.models.yahoo.quarterly_pnl import YFinanceQuarterlyPnLQueryParams
from data_fetcher.models.yahoo.dividends import YFinanceDividendsQueryParams
from data_fetcher.models.yahoo.splits import YFinanceSplitsQueryParams
from data_fetcher.models.yahoo.filings import YFinanceFilingsQueryParams
from data_fetcher.models.yahoo.estimates import YFinanceEstimatesQueryParams
from data_fetcher.models.yahoo.management import YFinanceManagementQueryParams
from data_fetcher.models.yahoo.holders import YFinanceHoldersQueryParams
from data_fetcher.models.yahoo.calendar import YFinanceCalendarQueryParams
from data_fetcher.models.yahoo.moat import YFinanceMoatQueryParams
from data_fetcher.models.yahoo.swot import YFinanceSWOTQueryParams
from data_fetcher.models.yahoo.scorecard import YFinanceScorecardQueryParams
from data_fetcher.models.yahoo.insider_trading import YFinanceInsiderTradingQueryParams
from data_fetcher.models.polygon.news import NewsQueryParams
from data_fetcher.models.polygon.earnings import EarningsQueryParams
from data_fetcher.models.polygon.sentiment import PolygonStockSentimentQueryParams
from data_fetcher.models.social.sentiment import SocialSentimentQueryParams
from data_fetcher.models.fmp.search import FMPSearchQueryParams
from data_fetcher.models.fmp.active_stocks import FMPActiveStocksQueryParams
from data_fetcher.models.fmp.revenue_segments import FMPRevenueSegmentsQueryParams
from data_fetcher.models.fmp.analyst_data import FMPAnalystDataQueryParams
from data_fetcher.models.fred.gdp import GDPQueryParams
from data_fetcher.models.fred.unemployment import UnemploymentQueryParams
from data_fetcher.models.fred.cpi import CPIQueryParams
from data_fetcher.models.fred.interest_rate import InterestRateQueryParams
from data_fetcher.models.fred.retail_sales import RetailSalesQueryParams
from data_fetcher.models.fred.consumer_sentiment import ConsumerSentimentQueryParams
from data_fetcher.models.fred.nonfarm_payroll import NonfarmPayrollQueryParams
from data_fetcher.models.fred.housing_starts import HousingStartsQueryParams
from data_fetcher.models.fred.industrial_production import IndustrialProductionQueryParams

from .executor import ProviderExecutor


# YFinanceInsiderTradingQueryParams is shared by two fetchers → subclass to distinguish
class YFinanceInsiderHoldersQueryParams(YFinanceInsiderTradingQueryParams):
    """QueryParams for the insider holders roster fetcher."""


class DataServiceBase:
    """Provider executor registration and shared utilities."""

    SYMBOL_MAPPING = {
        'KOSPI200.KS': '^KS200',
        'KOSPI200':    '^KS200',
        'KOSPI.KS':    '^KS11',
        'KOSPI':       '^KS11',
        'KOSDAQ.KS':   '^KQ11',
        'KOSDAQ':      '^KQ11',
    }

    def __init__(self):
        self.yfinance = ProviderExecutor({
            YFinanceStockPriceQueryParams:    YFinanceStockPriceFetcher,
            YFinanceCompanyInfoQueryParams:   YFinanceCompanyInfoFetcher,
            YFinanceKeyMetricsQueryParams:    YFinanceKeyMetricsFetcher,
            YFinanceFinancialsQueryParams:    YFinanceFinancialsFetcher,
            YFinanceBalanceSheetQueryParams:  YFinanceBalanceSheetFetcher,
            YFinanceQuarterlyPnLQueryParams:  YFinanceQuarterlyPnLFetcher,
            YFinanceDividendsQueryParams:     YFinanceDividendsFetcher,
            YFinanceSplitsQueryParams:        YFinanceSplitsFetcher,
            YFinanceFilingsQueryParams:       YFinanceFilingsFetcher,
            YFinanceEstimatesQueryParams:     YFinanceEstimatesFetcher,
            YFinanceManagementQueryParams:    YFinanceManagementFetcher,
            YFinanceHoldersQueryParams:       YFinanceHoldersFetcher,
            YFinanceCalendarQueryParams:      YFinanceCalendarFetcher,
            YFinanceMoatQueryParams:          YFinanceMoatFetcher,
            YFinanceSWOTQueryParams:          YFinanceSWOTFetcher,
            YFinanceScorecardQueryParams:     YFinanceScorecardFetcher,
            YFinanceInsiderTradingQueryParams: YFinanceInsiderTradingSummaryFetcher,
            YFinanceInsiderHoldersQueryParams: YFinanceInsiderHoldersFetcher,
        })

        self.polygon = ProviderExecutor({
            NewsQueryParams:                  PolygonNewsFetcher,
            EarningsQueryParams:              PolygonEarningsFetcher,
            PolygonStockSentimentQueryParams: PolygonStockSentimentFetcher,
        })

        self.fmp = ProviderExecutor({
            FMPSearchQueryParams:          FMPSearchFetcher,
            FMPActiveStocksQueryParams:    FMPActiveStocksFetcher,
            FMPRevenueSegmentsQueryParams: FMPRevenueSegmentsFetcher,
            FMPAnalystDataQueryParams:     FMPAnalystDataFetcher,
        })

        self.fred = ProviderExecutor({
            GDPQueryParams:                  FREDGDPFetcher,
            UnemploymentQueryParams:         FREDUnemploymentFetcher,
            CPIQueryParams:                  FREDCPIFetcher,
            InterestRateQueryParams:         FREDInterestRateFetcher,
            RetailSalesQueryParams:          FREDRetailSalesFetcher,
            ConsumerSentimentQueryParams:    FREDConsumerSentimentFetcher,
            NonfarmPayrollQueryParams:       FREDNonfarmPayrollFetcher,
            HousingStartsQueryParams:        FREDHousingStartsFetcher,
            IndustrialProductionQueryParams: FREDIndustrialProductionFetcher,
        })

        self.social = ProviderExecutor({
            SocialSentimentQueryParams: SocialSentimentFetcher,
        })

    def _map_symbol(self, symbol: str) -> str:
        return self.SYMBOL_MAPPING.get(symbol.upper(), symbol)

    def _get_default_interval(self, period: str = None) -> str:
        return {
            '1d': '5m', '5d': '30m', '1mo': '1h',
            '3mo': '1d', '6mo': '1d', '1y': '1d',
            '2y': '1wk', '5y': '1wk', '10y': '1mo', 'max': '1mo',
        }.get(period or '', '1d')

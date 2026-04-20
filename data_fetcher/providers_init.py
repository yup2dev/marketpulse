"""
Provider Initialization

Automatically registers all providers and their fetchers.
This file should be imported to activate all providers.
"""
import logging

from data_fetcher.provider import Provider, ProviderRegistry
from data_fetcher.utils.registry import FetcherRegistry

# Import all fetchers
from data_fetcher.fetchers.fred.gdp import FREDGDPFetcher
from data_fetcher.fetchers.fred.cpi import FREDCPIFetcher
from data_fetcher.fetchers.fred.unemployment import FREDUnemploymentFetcher
from data_fetcher.fetchers.fred.interest_rate import FREDInterestRateFetcher
from data_fetcher.fetchers.fred.employment import FREDEmploymentFetcher
from data_fetcher.fetchers.fred.industrial_production import FREDIndustrialProductionFetcher
from data_fetcher.fetchers.fred.consumer_sentiment import FREDConsumerSentimentFetcher
from data_fetcher.fetchers.fred.housing_starts import FREDHousingStartsFetcher
from data_fetcher.fetchers.fred.retail_sales import FREDRetailSalesFetcher
from data_fetcher.fetchers.fred.nonfarm_payroll import FREDNonfarmPayrollFetcher

from data_fetcher.fetchers.yahoo.stock_price import YFinanceStockPriceFetcher
from data_fetcher.fetchers.yahoo.dividends import YFinanceDividendsFetcher
from data_fetcher.fetchers.yahoo.company_info import YFinanceCompanyInfoFetcher
from data_fetcher.fetchers.yahoo.financials import YFinanceFinancialsFetcher
from data_fetcher.fetchers.yahoo.balance_sheet import YFinanceBalanceSheetFetcher
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
from data_fetcher.fetchers.yahoo.insider_trading import (
    YFinanceInsiderTradingFetcher,
    YFinanceInsiderHoldersFetcher,
    YFinanceInsiderTradingSummaryFetcher,
)

from data_fetcher.fetchers.alphavantage.quote import AlphaVantageQuoteFetcher
from data_fetcher.fetchers.alphavantage.timeseries import AlphaVantageTimeseriesFetcher
from data_fetcher.fetchers.alphavantage.forex import AlphaVantageForexFetcher

from data_fetcher.fetchers.fmp.quote import FMPQuoteFetcher
from data_fetcher.fetchers.fmp.company_profile import FMPCompanyProfileFetcher
from data_fetcher.fetchers.fmp.income_statement import FMPIncomeStatementFetcher
from data_fetcher.fetchers.fmp.analyst_estimates import FMPAnalystEstimatesFetcher
from data_fetcher.fetchers.fmp.analyst_recommendations import FMPAnalystRecommendationsFetcher
from data_fetcher.fetchers.fmp.search import FMPSearchFetcher
from data_fetcher.fetchers.fmp.most_actives import FMPMostActivesFetcher
from data_fetcher.fetchers.fmp.gainers import FMPGainersFetcher
from data_fetcher.fetchers.fmp.losers import FMPLosersFetcher
from data_fetcher.fetchers.bond.bond_prices import FMPBondPricesFetcher

from data_fetcher.fetchers.polygon.news import PolygonNewsFetcher
from data_fetcher.fetchers.polygon.earnings import PolygonEarningsFetcher
from data_fetcher.fetchers.polygon.insider_trading import PolygonInsiderTradingFetcher
from data_fetcher.fetchers.polygon.sentiment import PolygonStockSentimentFetcher

from data_fetcher.fetchers.fmp.analyst_data import FMPAnalystDataFetcher
from data_fetcher.fetchers.fmp.revenue_segments import FMPRevenueSegmentsFetcher

from data_fetcher.fetchers.social.sentiment import SocialSentimentFetcher
from data_fetcher.fetchers.database.index_constituents import DBIndexConstituentsFetcher
from data_fetcher.fetchers.whalewisdom.institutional_holdings import WhaleWisdomFetcher

log = logging.getLogger(__name__)


# ==================== FRED Provider ====================

fred_provider = Provider(
    name="fred",
    description="Federal Reserve Economic Data (FRED)",
    website="https://fred.stlouisfed.org",
    credentials=["api_key"],
    fetcher_dict={
        "gdp": FREDGDPFetcher,
        "cpi": FREDCPIFetcher,
        "unemployment": FREDUnemploymentFetcher,
        "interest_rate": FREDInterestRateFetcher,
        "employment": FREDEmploymentFetcher,
        "industrial_production": FREDIndustrialProductionFetcher,
        "consumer_sentiment": FREDConsumerSentimentFetcher,
        "housing_starts": FREDHousingStartsFetcher,
        "retail_sales": FREDRetailSalesFetcher,
        "nonfarm_payroll": FREDNonfarmPayrollFetcher,
    },
    metadata={
        "rate_limit": "120 requests/minute",
        "data_coverage": "US economic data",
    }
)


# ==================== Yahoo Provider ====================

yahoo_provider = Provider(
    name="yahoo",
    description="Yahoo Finance",
    website="https://finance.yahoo.com",
    credentials=[],  # No API key required
    fetcher_dict={
        "stock_price": YFinanceStockPriceFetcher,
        "dividends": YFinanceDividendsFetcher,
        "company_info": YFinanceCompanyInfoFetcher,
        "financials": YFinanceFinancialsFetcher,
        "balance_sheet": YFinanceBalanceSheetFetcher,
        "key_metrics": YFinanceKeyMetricsFetcher,
        "quarterly_pnl": YFinanceQuarterlyPnLFetcher,
        "holders": YFinanceHoldersFetcher,
        "calendar": YFinanceCalendarFetcher,
        "splits": YFinanceSplitsFetcher,
        "filings": YFinanceFilingsFetcher,
        "estimates": YFinanceEstimatesFetcher,
        "management": YFinanceManagementFetcher,
        "moat": YFinanceMoatFetcher,
        "swot": YFinanceSWOTFetcher,
        "scorecard": YFinanceScorecardFetcher,
        "insider_trading": YFinanceInsiderTradingFetcher,
        "insider_trading_summary": YFinanceInsiderTradingSummaryFetcher,
        "insider_holders": YFinanceInsiderHoldersFetcher,
    },
    metadata={
        "rate_limit": "2000 requests/hour",
        "data_coverage": "Global stock market data",
    }
)


# ==================== AlphaVantage Provider ====================

alphavantage_provider = Provider(
    name="alphavantage",
    description="Alpha Vantage Financial Data API",
    website="https://www.alphavantage.co",
    credentials=["api_key"],
    fetcher_dict={
        "quote": AlphaVantageQuoteFetcher,
        "timeseries": AlphaVantageTimeseriesFetcher,
        "forex": AlphaVantageForexFetcher,
    },
    metadata={
        "rate_limit": "5 requests/minute (free tier)",
        "data_coverage": "Global stock market and economic data",
    }
)


# ==================== FMP Provider ====================

fmp_provider = Provider(
    name="fmp",
    description="Financial Modeling Prep API",
    website="https://financialmodelingprep.com",
    credentials=["api_key"],
    fetcher_dict={
        "quote": FMPQuoteFetcher,
        "company_profile": FMPCompanyProfileFetcher,
        "income_statement": FMPIncomeStatementFetcher,
        "analyst_estimates": FMPAnalystEstimatesFetcher,
        "analyst_recommendations": FMPAnalystRecommendationsFetcher,
        "analyst_data": FMPAnalystDataFetcher,
        "revenue_segments": FMPRevenueSegmentsFetcher,
        "search": FMPSearchFetcher,
        "most_actives": FMPMostActivesFetcher,
        "gainers": FMPGainersFetcher,
        "losers": FMPLosersFetcher,
        "bond_prices": FMPBondPricesFetcher,
    },
    metadata={
        "rate_limit": "250 requests/day (free tier), 750/min (premium)",
        "data_coverage": "Global financial data, company fundamentals, analyst data",
    }
)


# ==================== Polygon Provider ====================

polygon_provider = Provider(
    name="polygon",
    description="Polygon.io Market Data API",
    website="https://polygon.io",
    credentials=["api_key"],
    fetcher_dict={
        "news": PolygonNewsFetcher,
        "earnings": PolygonEarningsFetcher,
        "insider_trading": PolygonInsiderTradingFetcher,
        "sentiment": PolygonStockSentimentFetcher,
    },
    metadata={
        "rate_limit": "5 requests/minute (free tier)",
        "data_coverage": "US stock market data, news, options",
    }
)


# ==================== Social Provider ====================

social_provider = Provider(
    name="social",
    description="Social Sentiment (Reddit, StockTwits)",
    credentials=[],
    fetcher_dict={
        "sentiment": SocialSentimentFetcher,
    },
)


# ==================== Database Provider ====================

db_provider = Provider(
    name="db",
    description="Local SQLite Database",
    credentials=[],
    fetcher_dict={
        "index_constituents": DBIndexConstituentsFetcher,
    },
)


# ==================== WhaleWisdom Provider ====================

whalewisdom_provider = Provider(
    name="whalewisdom",
    description="WhaleWisdom Institutional Holdings (SEC EDGAR 13F)",
    credentials=[],
    fetcher_dict={
        "institutional_holdings": WhaleWisdomFetcher,
    },
)


# ==================== Provider Registration ====================

def register_all_providers():
    """모든 Provider 등록"""
    ProviderRegistry.register(fred_provider)
    ProviderRegistry.register(yahoo_provider)
    ProviderRegistry.register(alphavantage_provider)
    ProviderRegistry.register(fmp_provider)
    ProviderRegistry.register(polygon_provider)
    ProviderRegistry.register(social_provider)
    ProviderRegistry.register(db_provider)
    ProviderRegistry.register(whalewisdom_provider)

    log.info(f"Registered {len(ProviderRegistry.list())} providers")


def register_all_fetchers():
    """모든 Fetcher를 FetcherRegistry에 등록"""

    # FRED fetchers
    for category, fetcher in fred_provider.fetcher_dict.items():
        FetcherRegistry.register(
            category=category,
            provider="fred",
            description=f"FRED {category.upper()} data"
        )(fetcher)

    # Yahoo fetchers
    for category, fetcher in yahoo_provider.fetcher_dict.items():
        FetcherRegistry.register(
            category=category,
            provider="yahoo",
            description=f"Yahoo {category.upper()} data"
        )(fetcher)

    # AlphaVantage fetchers
    for category, fetcher in alphavantage_provider.fetcher_dict.items():
        FetcherRegistry.register(
            category=category,
            provider="alphavantage",
            description=f"AlphaVantage {category.upper()} data"
        )(fetcher)

    # FMP fetchers
    for category, fetcher in fmp_provider.fetcher_dict.items():
        FetcherRegistry.register(
            category=category,
            provider="fmp",
            description=f"FMP {category.upper()} data"
        )(fetcher)

    # Polygon fetchers
    for category, fetcher in polygon_provider.fetcher_dict.items():
        FetcherRegistry.register(
            category=category,
            provider="polygon",
            description=f"Polygon {category.upper()} data"
        )(fetcher)

    # Social fetchers
    for category, fetcher in social_provider.fetcher_dict.items():
        FetcherRegistry.register(
            category=category,
            provider="social",
            description=f"Social {category.upper()} data"
        )(fetcher)

    # Database fetchers
    for category, fetcher in db_provider.fetcher_dict.items():
        FetcherRegistry.register(
            category=category,
            provider="db",
            description=f"DB {category.upper()} data"
        )(fetcher)

    # WhaleWisdom fetchers
    for category, fetcher in whalewisdom_provider.fetcher_dict.items():
        FetcherRegistry.register(
            category=category,
            provider="whalewisdom",
            description=f"WhaleWisdom {category.upper()} data"
        )(fetcher)

    log.info(f"Registered {len(FetcherRegistry.list_categories())} fetcher categories")


# Auto-register on import
register_all_providers()
register_all_fetchers()

log.info("Data Fetcher initialization complete")

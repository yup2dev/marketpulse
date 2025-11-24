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

from data_fetcher.fetchers.yahoo.stock_price import YahooStockPriceFetcher
from data_fetcher.fetchers.yahoo.dividends import YahooDividendsFetcher
from data_fetcher.fetchers.yahoo.company_info import YahooCompanyInfoFetcher

from data_fetcher.fetchers.alphavantage.quote import AlphaVantageQuoteFetcher
from data_fetcher.fetchers.alphavantage.timeseries import AlphaVantageTimeseriesFetcher

from data_fetcher.fetchers.fmp.quote import FMPQuoteFetcher
from data_fetcher.fetchers.fmp.company_profile import FMPCompanyProfileFetcher
from data_fetcher.fetchers.fmp.income_statement import FMPIncomeStatementFetcher
from data_fetcher.fetchers.fmp.analyst_estimates import FMPAnalystEstimatesFetcher
from data_fetcher.fetchers.fmp.analyst_recommendations import FMPAnalystRecommendationsFetcher

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
        "stock_price": YahooStockPriceFetcher,
        "dividends": YahooDividendsFetcher,
        "company_info": YahooCompanyInfoFetcher,
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
    },
    metadata={
        "rate_limit": "250 requests/day (free tier), 750/min (premium)",
        "data_coverage": "Global financial data, company fundamentals, analyst data",
    }
)


# ==================== Provider Registration ====================

def register_all_providers():
    """모든 Provider 등록"""
    ProviderRegistry.register(fred_provider)
    ProviderRegistry.register(yahoo_provider)
    ProviderRegistry.register(alphavantage_provider)
    ProviderRegistry.register(fmp_provider)

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

    log.info(f"Registered {len(FetcherRegistry.list_categories())} fetcher categories")


# Auto-register on import
register_all_providers()
register_all_fetchers()

log.info("Data Fetcher initialization complete")

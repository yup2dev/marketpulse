"""Alpha Vantage Provider"""
from data_fetcher.abstract_provider.abstract.provider import Provider
from data_fetcher.providers.alphavantage.models.equity_quote import (
    AlphaVantageEquityQuoteQueryParams,
    AlphaVantageEquityQuoteData,
    AlphaVantageQuoteFetcher,
    AlphaVantageTimeseriesFetcher,
)
from data_fetcher.providers.alphavantage.models.company_overview import (
    CompanyOverviewQueryParams,
    CompanyOverviewData,
    AlphaVantageCompanyOverviewFetcher,
)
from data_fetcher.providers.alphavantage.models.crypto import (
    CryptoQueryParams,
    CryptoData,
    AlphaVantageCryptoFetcher,
)
from data_fetcher.providers.alphavantage.models.forex_rates import AlphaVantageForexRatesFetcher
from data_fetcher.providers.alphavantage.models.forex import (
    ForexQueryParams,
    ForexData,
    AlphaVantageForexFetcher,
)

__all__ = [
    'AlphaVantageEquityQuoteQueryParams',
    'AlphaVantageEquityQuoteData',
    'AlphaVantageQuoteFetcher',
    'AlphaVantageTimeseriesFetcher',
    'CompanyOverviewQueryParams',
    'CompanyOverviewData',
    'AlphaVantageCompanyOverviewFetcher',
    'CryptoQueryParams',
    'CryptoData',
    'AlphaVantageCryptoFetcher',
    'ForexQueryParams',
    'ForexData',
    'AlphaVantageForexFetcher',
]


alphavantage_provider = Provider(
    name="alphavantage",
    description="Alpha Vantage Financial Data API",
    website="https://www.alphavantage.co",
    credentials=["api_key"],
    fetcher_dict={
        "quote": AlphaVantageQuoteFetcher,
        "timeseries": AlphaVantageTimeseriesFetcher,
        "forex": AlphaVantageForexFetcher,
        "forex_rates": AlphaVantageForexRatesFetcher,
        # yahoo와 같은 model 키 — standard CompanyProfile 공유로 provider 셀렉터 전환 가능
        "company_info": AlphaVantageCompanyOverviewFetcher,
        "crypto": AlphaVantageCryptoFetcher,
    },
    metadata={
        "rate_limit": "5 requests/minute (free tier)",
        "data_coverage": "Global stock market and economic data",
    }
)

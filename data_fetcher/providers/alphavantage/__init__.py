"""Alpha Vantage Provider"""
from data_fetcher.providers.alphavantage.equity_quote import (
    AlphaVantageEquityQuoteQueryParams,
    AlphaVantageEquityQuoteData,
    AlphaVantageQuoteFetcher,
    AlphaVantageTimeseriesFetcher,
)
from data_fetcher.providers.alphavantage.company_overview import (
    CompanyOverviewQueryParams,
    CompanyOverviewData,
    AlphaVantageCompanyOverviewFetcher,
)
from data_fetcher.providers.alphavantage.crypto import (
    CryptoQueryParams,
    CryptoData,
    AlphaVantageCryptoFetcher,
)
from data_fetcher.providers.alphavantage.forex import (
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

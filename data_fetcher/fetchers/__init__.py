"""Data Fetchers Module

This module provides fetchers for various financial data sources:
- Yahoo Finance (short interest, stock data)
- AlphaVantage (equity quotes, time series)
- FRED (economic indicators)

All FRED fetchers use the FredSeriesFetcher dependency for common API logic.
"""
from data_fetcher.fetchers.base import Fetcher

# FRED Common
from data_fetcher.fetchers.fred.series import FredSeriesFetcher

# AlphaVantage
from data_fetcher.fetchers.alphavantage.quote import AlphaVantageQuoteFetcher
from data_fetcher.fetchers.alphavantage.timeseries import AlphaVantageTimeseriesFetcher

# FRED Economic Indicators
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

__all__ = [
    # Base
    'Fetcher',
    'FredSeriesFetcher',

    # AlphaVantage
    'AlphaVantageQuoteFetcher',
    'AlphaVantageTimeseriesFetcher',

    # FRED Economic Indicators
    'FREDGDPFetcher',
    'FREDCPIFetcher',
    'FREDUnemploymentFetcher',
    'FREDInterestRateFetcher',
    'FREDEmploymentFetcher',
    'FREDIndustrialProductionFetcher',
    'FREDConsumerSentimentFetcher',
    'FREDHousingStartsFetcher',
    'FREDRetailSalesFetcher',
    'FREDNonfarmPayrollFetcher',
]

"""FRED API Fetchers for Economic Data"""
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

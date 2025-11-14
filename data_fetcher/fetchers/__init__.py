"""Data Fetchers Module"""
from data_fetcher.fetchers.base import Fetcher
from data_fetcher.fetchers.yahoo.short_interest import YahooShortInterestFetcher
from data_fetcher.fetchers.fred.gdp import FREDGDPFetcher
from data_fetcher.fetchers.fred.cpi import FREDCPIFetcher
from data_fetcher.fetchers.fred.unemployment import FREDUnemploymentFetcher

__all__ = [
    'Fetcher',
    'YahooShortInterestFetcher',
    'FREDGDPFetcher',
    'FREDCPIFetcher',
    'FREDUnemploymentFetcher',
]

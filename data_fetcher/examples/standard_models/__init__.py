"""
Standard Models for Data Fetcher

Provides standard interfaces that all providers must implement.
Inspired by OpenBB Platform's standard models pattern.
"""
from data_fetcher.examples.standard_models.economic import (
    GDPQueryParams,
    GDPData,
    CPIQueryParams,
    CPIData,
    UnemploymentQueryParams,
    UnemploymentData,
    InterestRateQueryParams,
    InterestRateData,
    EmploymentQueryParams,
    EmploymentData,
)
from data_fetcher.examples.standard_models.market import (
    QuoteQueryParams,
    QuoteData,
    TimeseriesQueryParams,
    TimeseriesData,
)

__all__ = [
    # Economic indicators
    'GDPQueryParams',
    'GDPData',
    'CPIQueryParams',
    'CPIData',
    'UnemploymentQueryParams',
    'UnemploymentData',
    'InterestRateQueryParams',
    'InterestRateData',
    'EmploymentQueryParams',
    'EmploymentData',

    # Market data
    'QuoteQueryParams',
    'QuoteData',
    'TimeseriesQueryParams',
    'TimeseriesData',
]

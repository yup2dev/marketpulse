"""
Standard Models

OpenBB standard_models 구조를 참고한 표준화된 데이터 모델
각 금융 데이터 유형에 대해 일관된 인터페이스를 제공합니다.

Provider별로 구조화:
- fred: FRED 경제 지표
- yahoo: Yahoo Finance 주식 데이터
- alphavantage: AlphaVantage API 데이터
"""

# Base Classes
from data_fetcher.models.base import BaseQueryParams, BaseData

# FRED Economic Indicators
from data_fetcher.models.fred import (
    GDPQueryParams, GDPData, GDPRealData, GDPNominalData, GDPPerCapitaData,
    CPIQueryParams, CPIData, CoreCPIData,
    UnemploymentQueryParams, UnemploymentData,
    InterestRateQueryParams, InterestRateData,
    EmploymentQueryParams, EmploymentData,
    InflationRateQueryParams, InflationRateData,
    IndustrialProductionQueryParams, IndustrialProductionData,
    ConsumerSentimentQueryParams, ConsumerSentimentData,
    HousingStartsQueryParams, HousingStartsData,
    RetailSalesQueryParams, RetailSalesData,
    NonfarmPayrollQueryParams, NonfarmPayrollData,
)

# Yahoo Finance
from data_fetcher.models.yahoo import (
    ShortInterestQueryParams, ShortInterestData, ShortInterestHistoricalData,
)

# AlphaVantage
from data_fetcher.models.alphavantage import (
    EquityQuoteQueryParams, EquityQuoteData,
    TechnicalIndicatorQueryParams,
    SMAData, EMAData, RSIData, MACDData,
    BollingerBandsData, ATRData, ADXData, StochasticData,
)

__all__ = [
    # Base Classes
    'BaseQueryParams',
    'BaseData',

    # FRED Economic Indicators
    'GDPQueryParams', 'GDPData', 'GDPRealData', 'GDPNominalData', 'GDPPerCapitaData',
    'CPIQueryParams', 'CPIData', 'CoreCPIData',
    'UnemploymentQueryParams', 'UnemploymentData',
    'InterestRateQueryParams', 'InterestRateData',
    'EmploymentQueryParams', 'EmploymentData',
    'InflationRateQueryParams', 'InflationRateData',
    'IndustrialProductionQueryParams', 'IndustrialProductionData',
    'ConsumerSentimentQueryParams', 'ConsumerSentimentData',
    'HousingStartsQueryParams', 'HousingStartsData',
    'RetailSalesQueryParams', 'RetailSalesData',
    'NonfarmPayrollQueryParams', 'NonfarmPayrollData',

    # Yahoo Finance
    'ShortInterestQueryParams', 'ShortInterestData', 'ShortInterestHistoricalData',

    # AlphaVantage
    'EquityQuoteQueryParams', 'EquityQuoteData',
    'TechnicalIndicatorQueryParams',
    'SMAData', 'EMAData', 'RSIData', 'MACDData',
    'BollingerBandsData', 'ATRData', 'ADXData', 'StochasticData',
]

"""
Standard Models

OpenBB standard_models 구조를 참고한 표준화된 데이터 모델
각 금융 데이터 유형에 대해 일관된 인터페이스를 제공합니다.
"""

# Base Classes
from data_fetcher.models.base import BaseQueryParams, BaseData

# Economic Indicators (FRED)
from data_fetcher.models.gdp import GDPQueryParams, GDPData, GDPRealData, GDPNominalData, GDPPerCapitaData
from data_fetcher.models.cpi import CPIQueryParams, CPIData, CoreCPIData
from data_fetcher.models.unemployment import UnemploymentQueryParams, UnemploymentData
from data_fetcher.models.interest_rate import InterestRateQueryParams, InterestRateData
from data_fetcher.models.employment import EmploymentQueryParams, EmploymentData
from data_fetcher.models.inflation import InflationRateQueryParams, InflationRateData
from data_fetcher.models.industrial_production import IndustrialProductionQueryParams, IndustrialProductionData
from data_fetcher.models.consumer_sentiment import ConsumerSentimentQueryParams, ConsumerSentimentData
from data_fetcher.models.housing_starts import HousingStartsQueryParams, HousingStartsData
from data_fetcher.models.retail_sales import RetailSalesQueryParams, RetailSalesData
from data_fetcher.models.nonfarm_payroll import NonfarmPayrollQueryParams, NonfarmPayrollData

# Equity Data
from data_fetcher.models.equity_quote import EquityQuoteQueryParams, EquityQuoteData
from data_fetcher.models.short_interest import ShortInterestQueryParams, ShortInterestData, ShortInterestHistoricalData

# Technical Indicators
from data_fetcher.models.technical_indicators import (
    TechnicalIndicatorQueryParams,
    SMAData, EMAData, RSIData, MACDData,
    BollingerBandsData, ATRData, ADXData, StochasticData
)

__all__ = [
    # Base Classes
    'BaseQueryParams',
    'BaseData',

    # Economic Indicators
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

    # Equity Data
    'EquityQuoteQueryParams', 'EquityQuoteData',
    'ShortInterestQueryParams', 'ShortInterestData', 'ShortInterestHistoricalData',

    # Technical Indicators
    'TechnicalIndicatorQueryParams',
    'SMAData', 'EMAData', 'RSIData', 'MACDData',
    'BollingerBandsData', 'ATRData', 'ADXData', 'StochasticData',
]

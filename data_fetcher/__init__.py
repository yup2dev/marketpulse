"""
Data Fetcher

API 데이터 수집 라이브러리 (Yahoo Finance, FRED, Alpha Vantage)
"""

from data_fetcher.router import get_data_router, DataRouter
from data_fetcher.models import *

__version__ = "0.1.0"

__all__ = [
    'get_data_router',
    'DataRouter',
]

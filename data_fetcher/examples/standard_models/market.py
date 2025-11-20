"""
Standard Market Data Models

Defines standard interfaces for market data that all providers must follow.
"""
from datetime import date, datetime
from typing import Optional
from pydantic import BaseModel, Field


# ==================== Base Classes ====================

class MarketQueryParams(BaseModel):
    """시장 데이터 조회 기본 파라미터"""
    symbol: str


class MarketData(BaseModel):
    """시장 데이터 기본 모델"""
    symbol: str
    date: date


# ==================== Quote ====================

class QuoteQueryParams(MarketQueryParams):
    """
    주식 시세 조회 파라미터 (표준)
    """
    pass


class QuoteData(MarketData):
    """
    주식 시세 데이터 (표준)

    모든 Quote provider는 최소한 이 필드들을 제공해야 함
    """
    open: Optional[float] = None
    high: Optional[float] = None
    low: Optional[float] = None
    close: Optional[float] = None
    volume: Optional[int] = None
    price: Optional[float] = None
    change: Optional[float] = None
    change_percent: Optional[float] = None


# ==================== Timeseries ====================

class TimeseriesQueryParams(MarketQueryParams):
    """
    시계열 데이터 조회 파라미터 (표준)
    """
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    interval: str = "daily"


class TimeseriesData(MarketData):
    """
    시계열 데이터 (표준)
    """
    open: float
    high: float
    low: float
    close: float
    volume: int
    adjusted_close: Optional[float] = None

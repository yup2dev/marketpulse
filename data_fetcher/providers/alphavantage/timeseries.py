"""Alpha Vantage Technical Indicators (Timeseries) — QueryParams + Data + Fetcher

Re-exports AlphaVantageTimeseriesFetcher from equity_quote for backwards compatibility
and keeps the technical indicator models from the original models/technical_indicators.py.
"""
from datetime import date as date_type
from typing import Optional
from pydantic import Field

from data_fetcher.abstract_provider.abstract import BaseQueryParams, BaseData
from data_fetcher.providers.alphavantage.equity_quote import AlphaVantageTimeseriesFetcher  # noqa: F401


# ── Technical Indicator Models (kept for reference) ───────────────────────────

class TechnicalIndicatorQueryParams(BaseQueryParams):
    """기술적 지표 조회 파라미터"""
    symbol: str = Field(description="종목 코드 (예: AAPL, MSFT)")
    indicator: str = Field(description="기술 지표 (SMA, EMA, RSI, MACD, BB, ATR 등)")
    time_period: Optional[int] = Field(default=14, description="시간 기간")
    interval: Optional[str] = Field(default="daily", description="시간 간격")
    series_type: Optional[str] = Field(default="close", description="계산 기준")


class SMAData(BaseData):
    symbol: str
    date: date_type
    value: float
    time_period: int = 20


class EMAData(BaseData):
    symbol: str
    date: date_type
    value: float
    time_period: int = 20


class RSIData(BaseData):
    symbol: str
    date: date_type
    value: float
    time_period: int = 14


class MACDData(BaseData):
    symbol: str
    date: date_type
    macd: float
    macd_signal: Optional[float] = None
    macd_histogram: Optional[float] = None


class BollingerBandsData(BaseData):
    symbol: str
    date: date_type
    upper_band: float
    middle_band: float
    lower_band: float
    time_period: int = 20


class ATRData(BaseData):
    symbol: str
    date: date_type
    value: float
    time_period: int = 14


class ADXData(BaseData):
    symbol: str
    date: date_type
    value: float
    time_period: int = 14


class StochasticData(BaseData):
    symbol: str
    date: date_type
    k_percent: float
    d_percent: Optional[float] = None
    time_period: int = 14

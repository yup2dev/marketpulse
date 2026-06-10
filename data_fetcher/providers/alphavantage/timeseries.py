"""Alpha Vantage Technical Indicators (Timeseries) — QueryParams + Data + Fetcher

Re-exports AlphaVantageTimeseriesFetcher from equity_quote for backwards compatibility
and keeps the technical indicator models from the original models/technical_indicators.py.
"""
from datetime import date as date_type
from typing import Optional
from pydantic import Field

from data_fetcher.abstract_provider.standard_models import (
    TechnicalIndicatorQueryParams,
    TechnicalIndicatorData,
    MACDData as _StdMACDData,
    BollingerBandsData as _StdBollingerBandsData,
)
from data_fetcher.providers.alphavantage.equity_quote import AlphaVantageTimeseriesFetcher  # noqa: F401


# ── Provider 클래스 (표준 모델 상속) ──────────────────────────────────────────

class SMAData(TechnicalIndicatorData):
    pass

class EMAData(TechnicalIndicatorData):
    pass

class RSIData(TechnicalIndicatorData):
    pass

class MACDData(_StdMACDData):
    macd_signal: Optional[float] = Field(default=None, description="시그널 선")
    macd_histogram: Optional[float] = Field(default=None, description="히스토그램")

class BollingerBandsData(_StdBollingerBandsData):
    pass

class ATRData(TechnicalIndicatorData):
    pass

class ADXData(TechnicalIndicatorData):
    pass

class StochasticData(TechnicalIndicatorData):
    k_percent: Optional[float] = Field(default=None, description="%K")
    d_percent: Optional[float] = Field(default=None, description="%D")

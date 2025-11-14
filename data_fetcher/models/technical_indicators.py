"""Technical Indicators Standard Model (기술적 지표)"""
from datetime import datetime, date as date_type
from typing import Optional
from pydantic import Field
from data_fetcher.models.base import BaseQueryParams, BaseData


class TechnicalIndicatorQueryParams(BaseQueryParams):
    """기술적 지표 조회 파라미터"""

    symbol: str = Field(
        description="종목 코드 (예: AAPL, MSFT)"
    )
    indicator: str = Field(
        description="기술 지표 (SMA, EMA, RSI, MACD, BB, ATR 등)"
    )
    time_period: Optional[int] = Field(
        default=14,
        description="시간 기간"
    )
    interval: Optional[str] = Field(
        default="daily",
        description="시간 간격 (1min, 5min, 15min, 30min, 60min, daily, weekly, monthly)"
    )
    series_type: Optional[str] = Field(
        default="close",
        description="계산 기준 (close, open, high, low)"
    )


class SMAData(BaseData):
    """Simple Moving Average (단순 이동평균)"""

    symbol: str = Field(
        description="종목 코드"
    )
    date: date_type = Field(
        description="날짜"
    )
    value: float = Field(
        description="SMA 값"
    )
    time_period: int = Field(
        default=20,
        description="시간 기간"
    )


class EMAData(BaseData):
    """Exponential Moving Average (지수 이동평균)"""

    symbol: str = Field(
        description="종목 코드"
    )
    date: date_type = Field(
        description="날짜"
    )
    value: float = Field(
        description="EMA 값"
    )
    time_period: int = Field(
        default=20,
        description="시간 기간"
    )


class RSIData(BaseData):
    """Relative Strength Index (상대강도지수)"""

    symbol: str = Field(
        description="종목 코드"
    )
    date: date_type = Field(
        description="날짜"
    )
    value: float = Field(
        description="RSI 값 (0-100)"
    )
    time_period: int = Field(
        default=14,
        description="시간 기간"
    )


class MACDData(BaseData):
    """Moving Average Convergence Divergence (MACD)"""

    symbol: str = Field(
        description="종목 코드"
    )
    date: date_type = Field(
        description="날짜"
    )
    macd: float = Field(
        description="MACD 선"
    )
    macd_signal: Optional[float] = Field(
        default=None,
        description="MACD Signal 선"
    )
    macd_histogram: Optional[float] = Field(
        default=None,
        description="MACD Histogram"
    )


class BollingerBandsData(BaseData):
    """Bollinger Bands (볼린저 밴드)"""

    symbol: str = Field(
        description="종목 코드"
    )
    date: date_type = Field(
        description="날짜"
    )
    upper_band: float = Field(
        description="상단 밴드"
    )
    middle_band: float = Field(
        description="중간값 (SMA)"
    )
    lower_band: float = Field(
        description="하단 밴드"
    )
    time_period: int = Field(
        default=20,
        description="시간 기간"
    )


class ATRData(BaseData):
    """Average True Range (평균 참 범위)"""

    symbol: str = Field(
        description="종목 코드"
    )
    date: date_type = Field(
        description="날짜"
    )
    value: float = Field(
        description="ATR 값"
    )
    time_period: int = Field(
        default=14,
        description="시간 기간"
    )


class ADXData(BaseData):
    """Average Directional Index (평균방향지수)"""

    symbol: str = Field(
        description="종목 코드"
    )
    date: date_type = Field(
        description="날짜"
    )
    value: float = Field(
        description="ADX 값 (0-100)"
    )
    time_period: int = Field(
        default=14,
        description="시간 기간"
    )


class StochasticData(BaseData):
    """Stochastic Oscillator (스토캐스틱)"""

    symbol: str = Field(
        description="종목 코드"
    )
    date: date_type = Field(
        description="날짜"
    )
    k_percent: float = Field(
        description="%K 값 (0-100)"
    )
    d_percent: Optional[float] = Field(
        default=None,
        description="%D 값 (0-100)"
    )
    time_period: int = Field(
        default=14,
        description="시간 기간"
    )

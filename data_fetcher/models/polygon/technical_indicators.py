"""Polygon.io Technical Indicators Model"""
from datetime import date as date_type
from typing import Optional
from pydantic import Field
from data_fetcher.models.base import BaseQueryParams, BaseData


class TechnicalIndicatorsQueryParams(BaseQueryParams):
    """기술적 지표 조회 파라미터"""

    ticker: str = Field(
        description="종목 티커 (예: AAPL, TSLA)"
    )
    indicator: str = Field(
        description="지표 유형 (sma, ema, rsi, macd)"
    )
    timespan: Optional[str] = Field(
        default="day",
        description="시간 단위 (minute, hour, day, week, month)"
    )
    adjusted: Optional[bool] = Field(
        default=True,
        description="조정 여부 (주식 분할 등)"
    )
    window: Optional[int] = Field(
        default=None,
        description="이동평균 기간 (SMA/EMA용)"
    )
    series_type: Optional[str] = Field(
        default="close",
        description="사용할 가격 유형 (close, open, high, low)"
    )
    timestamp_gte: Optional[str] = Field(
        default=None,
        description="타임스탬프 >= (YYYY-MM-DD)"
    )
    timestamp_lte: Optional[str] = Field(
        default=None,
        description="타임스탬프 <= (YYYY-MM-DD)"
    )
    limit: Optional[int] = Field(
        default=100,
        description="최대 결과 수"
    )


class SMAData(BaseData):
    """Simple Moving Average (단순이동평균)"""

    ticker: str = Field(description="종목 티커")
    timestamp: date_type = Field(description="날짜")
    value: float = Field(description="SMA 값")
    window: int = Field(description="이동평균 기간")


class EMAData(BaseData):
    """Exponential Moving Average (지수이동평균)"""

    ticker: str = Field(description="종목 티커")
    timestamp: date_type = Field(description="날짜")
    value: float = Field(description="EMA 값")
    window: int = Field(description="이동평균 기간")


class RSIData(BaseData):
    """Relative Strength Index (상대강도지수)"""

    ticker: str = Field(description="종목 티커")
    timestamp: date_type = Field(description="날짜")
    value: float = Field(description="RSI 값 (0-100)")


class MACDData(BaseData):
    """Moving Average Convergence Divergence (MACD)"""

    ticker: str = Field(description="종목 티커")
    timestamp: date_type = Field(description="날짜")
    macd: Optional[float] = Field(
        default=None,
        description="MACD 값"
    )
    signal: Optional[float] = Field(
        default=None,
        description="Signal 라인"
    )
    histogram: Optional[float] = Field(
        default=None,
        description="히스토그램 (MACD - Signal)"
    )


class BollingerBandsData(BaseData):
    """Bollinger Bands (볼린저 밴드)"""

    ticker: str = Field(description="종목 티커")
    timestamp: date_type = Field(description="날짜")
    upper_band: Optional[float] = Field(
        default=None,
        description="상단 밴드"
    )
    middle_band: Optional[float] = Field(
        default=None,
        description="중간 밴드 (SMA)"
    )
    lower_band: Optional[float] = Field(
        default=None,
        description="하단 밴드"
    )


class TechnicalIndicatorsData(BaseData):
    """통합 기술적 지표 데이터"""

    ticker: str = Field(description="종목 티커")
    timestamp: date_type = Field(description="날짜")

    # === 이동평균 ===
    sma_20: Optional[float] = Field(default=None, description="20일 단순이동평균")
    sma_50: Optional[float] = Field(default=None, description="50일 단순이동평균")
    sma_200: Optional[float] = Field(default=None, description="200일 단순이동평균")
    ema_12: Optional[float] = Field(default=None, description="12일 지수이동평균")
    ema_26: Optional[float] = Field(default=None, description="26일 지수이동평균")

    # === 모멘텀 지표 ===
    rsi_14: Optional[float] = Field(default=None, description="14일 RSI")
    macd: Optional[float] = Field(default=None, description="MACD 값")
    macd_signal: Optional[float] = Field(default=None, description="MACD Signal")
    macd_histogram: Optional[float] = Field(default=None, description="MACD 히스토그램")

    # === 변동성 지표 ===
    bollinger_upper: Optional[float] = Field(default=None, description="볼린저 밴드 상단")
    bollinger_middle: Optional[float] = Field(default=None, description="볼린저 밴드 중간")
    bollinger_lower: Optional[float] = Field(default=None, description="볼린저 밴드 하단")

    # === 거래량 지표 ===
    volume_sma_20: Optional[float] = Field(default=None, description="20일 거래량 이동평균")

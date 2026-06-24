"""Standard Model: Technical Indicators (기술적 지표)"""
from datetime import date as date_type
from typing import Optional

from pydantic import Field

from data_fetcher.abstract_provider.abstract.data import BaseData
from data_fetcher.abstract_provider.abstract.query_params import BaseQueryParams


class TechnicalIndicatorQueryParams(BaseQueryParams):
    """기술적 지표 조회 표준 파라미터"""

    symbol: str = Field(description="종목 코드")
    indicator: str = Field(description="지표 유형 (SMA, EMA, RSI, MACD, BB, ATR 등)")
    time_period: Optional[int] = Field(default=14, description="계산 기간")
    interval: Optional[str] = Field(default="daily", description="데이터 간격")
    series_type: Optional[str] = Field(default="close", description="계산 기준 가격 (open/high/low/close)")


class TechnicalIndicatorData(BaseData):
    """기술적 지표 표준 데이터 (단일 값 지표용)"""

    symbol: str = Field(description="종목 코드")
    date: date_type = Field(description="날짜")
    indicator: str = Field(description="지표 유형")
    value: Optional[float] = Field(default=None, description="지표 값")
    time_period: Optional[int] = Field(default=None, description="계산 기간")


class MACDData(BaseData):
    """MACD 지표 (복합 값)"""

    symbol: str = Field(description="종목 코드")
    date: date_type = Field(description="날짜")
    macd: Optional[float] = Field(default=None, description="MACD 선")
    signal: Optional[float] = Field(default=None, description="시그널 선")
    histogram: Optional[float] = Field(default=None, description="히스토그램")


class BollingerBandsData(BaseData):
    """볼린저 밴드"""

    symbol: str = Field(description="종목 코드")
    date: date_type = Field(description="날짜")
    upper_band: Optional[float] = Field(default=None, description="상단 밴드")
    middle_band: Optional[float] = Field(default=None, description="중간 밴드 (SMA)")
    lower_band: Optional[float] = Field(default=None, description="하단 밴드")


class TechnicalIndicatorsWideData(BaseData):
    """통합 기술적 지표 데이터 (wide — 1행=1일자, 지표별 컬럼)."""

    ticker: str = Field(description="종목 티커")
    timestamp: date_type = Field(description="날짜")

    # 이동평균
    sma_20: Optional[float] = Field(default=None, description="20일 단순이동평균")
    sma_50: Optional[float] = Field(default=None, description="50일 단순이동평균")
    sma_200: Optional[float] = Field(default=None, description="200일 단순이동평균")
    ema_12: Optional[float] = Field(default=None, description="12일 지수이동평균")
    ema_26: Optional[float] = Field(default=None, description="26일 지수이동평균")

    # 모멘텀
    rsi_14: Optional[float] = Field(default=None, description="14일 RSI")
    macd: Optional[float] = Field(default=None, description="MACD 값")
    macd_signal: Optional[float] = Field(default=None, description="MACD Signal")
    macd_histogram: Optional[float] = Field(default=None, description="MACD 히스토그램")

    # 변동성
    bollinger_upper: Optional[float] = Field(default=None, description="볼린저 밴드 상단")
    bollinger_middle: Optional[float] = Field(default=None, description="볼린저 밴드 중간")
    bollinger_lower: Optional[float] = Field(default=None, description="볼린저 밴드 하단")

    # 거래량
    volume_sma_20: Optional[float] = Field(default=None, description="20일 거래량 이동평균")

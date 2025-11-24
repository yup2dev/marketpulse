"""FMP Stock Quote Model"""
from datetime import datetime
from typing import Optional
from pydantic import Field
from data_fetcher.models.base import BaseQueryParams, BaseData


class QuoteQueryParams(BaseQueryParams):
    """주식 시세 조회 파라미터"""

    symbol: str = Field(
        description="종목 심볼 (예: AAPL, TSLA)"
    )


class QuoteData(BaseData):
    """주식 시세 데이터"""

    symbol: str = Field(
        description="종목 심볼"
    )
    name: Optional[str] = Field(
        default=None,
        description="회사명"
    )
    price: Optional[float] = Field(
        default=None,
        description="현재 가격"
    )
    change: Optional[float] = Field(
        default=None,
        description="가격 변동"
    )
    change_percent: Optional[float] = Field(
        default=None,
        description="가격 변동률 (%)"
    )
    day_low: Optional[float] = Field(
        default=None,
        description="당일 저가"
    )
    day_high: Optional[float] = Field(
        default=None,
        description="당일 고가"
    )
    year_low: Optional[float] = Field(
        default=None,
        description="52주 저가"
    )
    year_high: Optional[float] = Field(
        default=None,
        description="52주 고가"
    )
    market_cap: Optional[float] = Field(
        default=None,
        description="시가총액"
    )
    price_avg_50: Optional[float] = Field(
        default=None,
        description="50일 이동평균"
    )
    price_avg_200: Optional[float] = Field(
        default=None,
        description="200일 이동평균"
    )
    volume: Optional[int] = Field(
        default=None,
        description="거래량"
    )
    avg_volume: Optional[int] = Field(
        default=None,
        description="평균 거래량"
    )
    exchange: Optional[str] = Field(
        default=None,
        description="거래소"
    )
    open: Optional[float] = Field(
        default=None,
        description="시가"
    )
    previous_close: Optional[float] = Field(
        default=None,
        description="전일 종가"
    )
    eps: Optional[float] = Field(
        default=None,
        description="주당순이익 (EPS)"
    )
    pe: Optional[float] = Field(
        default=None,
        description="주가수익비율 (P/E)"
    )
    earnings_announcement: Optional[datetime] = Field(
        default=None,
        description="실적 발표 예정일"
    )
    shares_outstanding: Optional[int] = Field(
        default=None,
        description="발행주식수"
    )
    timestamp: Optional[int] = Field(
        default=None,
        description="타임스탬프"
    )
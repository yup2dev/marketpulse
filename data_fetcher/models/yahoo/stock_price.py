"""Yahoo Finance Stock Price Model (주가 데이터)"""
from datetime import date as date_type
from typing import Optional
from pydantic import Field
from data_fetcher.models.base import BaseQueryParams, BaseData


class StockPriceQueryParams(BaseQueryParams):
    """주가 데이터 조회 파라미터"""

    symbol: str = Field(
        description="종목 코드 (예: AAPL, TSLA, MSFT)"
    )
    start_date: Optional[str] = Field(
        default=None,
        description="조회 시작일 (YYYY-MM-DD)"
    )
    end_date: Optional[str] = Field(
        default=None,
        description="조회 종료일 (YYYY-MM-DD)"
    )
    interval: str = Field(
        default="1d",
        description="데이터 간격 (1d, 1wk, 1mo)"
    )


class StockPriceData(BaseData):
    """주가 데이터"""

    symbol: str = Field(description="종목 코드")
    date: date_type = Field(description="날짜")

    # OHLCV 데이터
    open: float = Field(description="시가")
    high: float = Field(description="고가")
    low: float = Field(description="저가")
    close: float = Field(description="종가")
    adj_close: Optional[float] = Field(default=None, description="조정 종가")
    volume: int = Field(description="거래량")

    # 계산 필드
    daily_return: Optional[float] = Field(
        default=None,
        description="일일 수익률 (%)"
    )
    price_change: Optional[float] = Field(
        default=None,
        description="가격 변동 (종가 - 시가)"
    )
    price_change_pct: Optional[float] = Field(
        default=None,
        description="가격 변동률 (%)"
    )

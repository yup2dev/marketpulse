from typing import Optional
from pydantic import Field
from data_fetcher.models.base import BaseQueryParams, BaseData


# 한국 시장 종목 코드 → Yahoo Finance 티커 매핑
SYMBOL_ALIASES: dict[str, str] = {
    'KOSPI200.KS': '^KS200',
    'KOSPI200':    '^KS200',
    'KOSPI.KS':    '^KS11',
    'KOSPI':       '^KS11',
    'KOSDAQ.KS':   '^KQ11',
    'KOSDAQ':      '^KQ11',
}


class StockQuoteQueryParams(BaseQueryParams):
    symbol: str = Field(description="종목 코드 (AAPL, KOSPI 등)")


class StockQuoteData(BaseData):
    symbol: str = Field(description="종목 코드")
    price: float = Field(description="현재가 (최신 종가)")
    change: Optional[float] = Field(None, description="전일 대비 변동액")
    change_percent: Optional[float] = Field(None, description="전일 대비 변동률 (%)")
    volume: Optional[int] = Field(None, description="거래량")
    open: Optional[float] = Field(None, description="시가")
    high: Optional[float] = Field(None, description="고가")
    low: Optional[float] = Field(None, description="저가")
    timestamp: Optional[str] = Field(None, description="기준 날짜/시간")

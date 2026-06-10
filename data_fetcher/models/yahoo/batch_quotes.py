"""Yahoo Finance Batch Quotes — QueryParams & Data models."""
from __future__ import annotations

from typing import List, Literal
from pydantic import BaseModel, Field


class YFinanceBatchQuotesQueryParams(BaseModel):
    symbols: List[str]
    period: str = '5d'
    mode: Literal['live', 'period'] = 'live'
    # live  → current price vs previous day close  (등락률)
    # period → current price vs period-start close (기간 변동률)
    chunk_size: int = 20
    max_workers: int = 15


class YFinanceBatchQuoteData(BaseModel):
    symbol: str
    price: float
    change: float
    change_percent: float
    volume: int

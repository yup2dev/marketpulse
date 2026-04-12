"""Polygon 시장 데이터 서비스 (실적, 뉴스, 심리)."""
from typing import List, Optional

from data_fetcher.query_executor import QueryExecutor
from data_fetcher.fetchers.base import AnnotatedResult
from data_fetcher.models.polygon.earnings import EarningsData
from data_fetcher.models.polygon.news import NewsData
from data_fetcher.models.polygon.sentiment import PolygonStockSentimentData


def _unwrap(raw):
    return raw.result if isinstance(raw, AnnotatedResult) else raw


def _first(raw):
    result = _unwrap(raw)
    return result[0] if result else None


async def get_earnings(symbol: str, limit: int = 8) -> List[EarningsData]:
    raw = await QueryExecutor.fetch("polygon", "earnings", {"ticker": symbol, "limit": limit})
    return _unwrap(raw)


async def get_news(
    symbol: Optional[str] = None,
    limit: int = 10,
) -> List[NewsData]:
    params = {"limit": limit}
    if symbol:
        params["ticker"] = symbol
    raw = await QueryExecutor.fetch("polygon", "news", params)
    return _unwrap(raw)[:limit]


async def get_stock_sentiment(symbol: str) -> Optional[PolygonStockSentimentData]:
    return _first(await QueryExecutor.fetch("polygon", "sentiment", {"ticker": symbol}))

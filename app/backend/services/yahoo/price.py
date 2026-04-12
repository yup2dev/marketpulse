"""Yahoo Finance 주가 / 오더북 서비스."""
import asyncio
from typing import Any, Dict, List, Optional

from data_fetcher.query_executor import QueryExecutor
from data_fetcher.fetchers.base import AnnotatedResult
from data_fetcher.fetchers.polygon.orderbook import fetch_stock_orderbook
from data_fetcher.models.yahoo.stock_price import YFinanceStockPriceData

_SYMBOL_MAPPING = {
    'KOSPI200.KS': '^KS200',
    'KOSPI200':    '^KS200',
    'KOSPI.KS':    '^KS11',
    'KOSPI':       '^KS11',
    'KOSDAQ.KS':   '^KQ11',
    'KOSDAQ':      '^KQ11',
}


def _map_symbol(symbol: str) -> str:
    return _SYMBOL_MAPPING.get(symbol.upper(), symbol)


def _default_interval(period: Optional[str]) -> str:
    return {
        '1d': '5m', '5d': '30m', '1mo': '1h',
        '3mo': '1d', '6mo': '1d', '1y': '1d',
        '2y': '1wk', '5y': '1wk', '10y': '1mo', 'max': '1mo',
    }.get(period or '', '1d')


async def get_stock_quote(symbol: str) -> Dict[str, Any]:
    """최신 주가 조회."""
    raw = await QueryExecutor.fetch(
        provider="yahoo",
        model="stock_price",
        params={"symbol": _map_symbol(symbol), "interval": "1d", "period": "5d"},
    )
    prices: List[YFinanceStockPriceData] = raw.result if isinstance(raw, AnnotatedResult) else raw
    if prices:
        latest = prices[-1]
        return {
            'symbol': symbol,
            'price': latest.close,
            'change': latest.price_change,
            'change_percent': latest.price_change_pct,
            'volume': latest.volume,
            'timestamp': latest.date,
            'high': latest.high,
            'low': latest.low,
            'open': latest.open,
        }
    return {}


async def get_stock_history(
    symbol: str,
    period: Optional[str] = None,
    interval: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
) -> List[YFinanceStockPriceData]:
    """주가 이력 조회."""
    if not interval:
        interval = _default_interval(period)
    mapped = _map_symbol(symbol)
    if start_date and end_date:
        params: Dict = {"symbol": mapped, "interval": interval,
                        "start_date": start_date, "end_date": end_date}
    else:
        params = {"symbol": mapped, "interval": interval, "period": period or "1mo"}
    raw = await QueryExecutor.fetch(provider="yahoo", model="stock_price", params=params)
    return raw.result if isinstance(raw, AnnotatedResult) else raw


async def get_stock_orderbook(symbol: str) -> dict:
    """Polygon NBBO 기반 오더북 조회."""
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, fetch_stock_orderbook, symbol)

"""FMP 시장 데이터 서비스 (애널리스트, 세그먼트, 검색)."""
from typing import Any, Dict, List, Optional

from data_fetcher.query_executor import QueryExecutor
from data_fetcher.fetchers.base import AnnotatedResult
from data_fetcher.models.fmp.analyst_data import FMPAnalystDataData
from data_fetcher.models.fmp.revenue_segments import FMPRevenueSegmentsData
from data_fetcher.models.fmp.search import FMPSearchData


def _unwrap(raw):
    return raw.result if isinstance(raw, AnnotatedResult) else raw


def _first(raw):
    result = _unwrap(raw)
    return result[0] if result else None


async def get_analyst_data(symbol: str) -> Optional[FMPAnalystDataData]:
    return _first(await QueryExecutor.fetch("fmp", "analyst_data", {"symbol": symbol}))


async def get_revenue_segments(
    symbol: str,
    limit: int = 8,
) -> Optional[FMPRevenueSegmentsData]:
    return _first(await QueryExecutor.fetch(
        "fmp", "revenue_segments", {"symbol": symbol, "limit": limit}
    ))


async def search_stocks(query: str, limit: int = 10) -> List[Dict[str, Any]]:
    raw = await QueryExecutor.fetch("fmp", "search", {"query": query, "limit": limit})
    results: List[FMPSearchData] = _unwrap(raw)
    if results:
        return [
            {
                'symbol': r.symbol,
                'name': r.name,
                'exchange': r.exchange_short_name or r.stock_exchange,
                'currency': r.currency,
            }
            for r in results
        ]
    # Fallback: 활성 종목에서 필터링
    raw_active = await QueryExecutor.fetch("fmp", "active_stocks", {})
    actives = _unwrap(raw_active)
    if actives:
        q = query.upper()
        return [
            {'symbol': a.symbol, 'name': a.name, 'exchange': 'NASDAQ', 'currency': 'USD'}
            for a in actives
            if q in (a.symbol or '').upper() or q in (a.name or '').upper()
        ][:limit]
    return []

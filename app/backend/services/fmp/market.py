"""FMP 시장 데이터 서비스 (애널리스트, 세그먼트, 검색)."""
from typing import Any, Dict, List, Optional

from data_fetcher.query_executor import QueryExecutor
from data_fetcher.models.fmp.analyst_data import FMPAnalystDataData
from data_fetcher.models.fmp.revenue_segments import FMPRevenueSegmentsData
from data_fetcher.models.fmp.search import FMPSearchData
from app.backend.core.cache import cached
from app.backend.services._base import unwrap as _unwrap, first as _first


@cached(ttl=1800)
async def get_analyst_data(symbol: str) -> Optional[FMPAnalystDataData]:
    return _first(await QueryExecutor.fetch("fmp", "analyst_data", {"symbol": symbol}))


@cached(ttl=3600)
async def get_revenue_segments(
    symbol: str,
    limit: int = 8,
) -> Optional[FMPRevenueSegmentsData]:
    return _first(await QueryExecutor.fetch(
        "fmp", "revenue_segments", {"symbol": symbol, "limit": limit}
    ))


async def search_stocks(query: str, limit: int = 10) -> List[Dict[str, Any]]:
    # 1. FMP search API 시도
    try:
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
    except Exception:
        pass

    # 2. 인메모리 심볼 캐시에서 검색 (FMP free tier 제한 우회)
    try:
        from app.backend.services.symbol_cache import get_symbol_cache
        sc = get_symbol_cache()
        await sc.ensure_loaded()
        hits = sc.search(query, limit=limit)
        if hits:
            return [
                {'symbol': h['symbol'], 'name': h.get('name', ''), 'exchange': h.get('exchange', ''), 'currency': 'USD'}
                for h in hits
            ]
    except Exception:
        pass

    return []

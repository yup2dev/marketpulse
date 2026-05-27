"""
Redis 캐싱 기반 종목 리스트 서비스.

- 서버 시작 시 DB에서 로드 → Redis에 캐싱 (TTL 1h)
- WebSocket 연결 시 캐시 우선 조회, miss 시 DB fallback + 재캐싱
- 1시간마다 백그라운드 갱신
- Redis 연결 실패 시 인메모리 캐시로 자동 대체 (core/cache.py 보장)

데이터 조회: db Provider → DBStockListFetcher (architecture.md Fetcher 파이프라인 준수)
  fallback: 정적 유니버스 (Fetcher 완전 실패 시)
"""
import asyncio
import logging
from typing import List, Dict

from app.backend.core.cache import cache

log = logging.getLogger(__name__)

CACHE_KEY = "stocks:all"
CACHE_TTL = 3600        # 1시간
REFRESH_INTERVAL = 3600  # 백그라운드 갱신 주기 (1시간)


# ── DB 조회 (Fetcher 파이프라인 경유) ────────────────────────────────────────

async def _load_from_db() -> List[Dict]:
    """
    DBStockListFetcher(db Provider)를 통해 종목 목록 조회.
    아키텍처 규칙: DB 접근은 db Provider → Fetcher 파이프라인을 경유해야 한다.
    Fetcher 실패 시 정적 fallback 유니버스로 대체.
    """
    try:
        from data_fetcher.query_executor import QueryExecutor
        from data_fetcher.fetchers.base import AnnotatedResult

        raw = await QueryExecutor.fetch(
            provider="db",
            model="stock_list",
            params={"active_only": True},
        )
        items = raw.result if isinstance(raw, AnnotatedResult) else raw
        if items:
            result = [
                item.model_dump() if hasattr(item, "model_dump") else dict(item)
                for item in items
            ]
            log.info("[StockList] Loaded %d stocks via DBStockListFetcher", len(result))
            return result
    except Exception as exc:
        log.warning("[StockList] DBStockListFetcher failed: %s", exc)

    # 최종 fallback — Fetcher 완전 실패 시
    from app.backend.services.ranking_service import _FALLBACK_UNIVERSE
    log.warning("[StockList] Using static fallback universe (%d symbols)", len(_FALLBACK_UNIVERSE))
    return [
        {
            "ticker_cd": sym,
            "ticker_nm": sym,
            "asset_type": "stock",
            "curr": "USD",
            "sector": "",
            "industry": "",
            "exchange": "",
            "is_active": True,
        }
        for sym in _FALLBACK_UNIVERSE
    ]


# ── 공개 API ──────────────────────────────────────────────────────────────────

async def get_stock_list() -> List[Dict]:
    """캐시 우선 조회. MISS 시 Fetcher를 통해 DB 조회 후 재캐싱."""
    data = await cache.get(CACHE_KEY)
    if data is not None:
        log.debug("[StockList] Cache HIT (%d stocks)", len(data))
        return data

    log.info("[StockList] Cache MISS — querying DB via Fetcher")
    data = await _load_from_db()
    if data:
        await cache.set(CACHE_KEY, data, CACHE_TTL)
    return data or []


async def refresh_cache() -> int:
    """Fetcher를 통해 DB에서 새로 로드해 캐시 교체. 종목 수 반환."""
    data = await _load_from_db()
    if data:
        await cache.set(CACHE_KEY, data, CACHE_TTL)
        log.info("[StockList] Cache refreshed: %d stocks (TTL %ds)", len(data), CACHE_TTL)
    return len(data) if data else 0


# ── 백그라운드 루프 ───────────────────────────────────────────────────────────

async def stock_list_warmup_loop(interval: int = REFRESH_INTERVAL):
    """1시간마다 종목 리스트 캐시를 백그라운드 갱신한다."""
    while True:
        await asyncio.sleep(interval)
        try:
            count = await refresh_cache()
            log.info("[StockList] Background refresh complete: %d stocks", count)
        except asyncio.CancelledError:
            break
        except Exception as exc:
            log.warning("[StockList] Background refresh failed: %s", exc)

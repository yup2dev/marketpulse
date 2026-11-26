"""yahoo 묶음 시세 — 캐시 + single-flight (스크리너 · 랭킹 · 웹소켓 시세가 같이 쓴다).

데이터 접근 모듈이다 (provider 이름을 안다). 조회는 실행 계층(ServerExecutor)으로 — yahoo 가 로컬 전용이면
사용자 PC Fetcher 로 가고, Fetcher 가 없으면 빈 결과.
"""
import asyncio
import logging
from typing import Dict, List, Optional

from app.backend.core.execution import RemoteUnavailableError, ServerExecutor

log = logging.getLogger(__name__)

_quote_locks: Dict[str, asyncio.Lock] = {}


async def cached_quotes(
    cache_key: str,
    symbols: List[str],
    ttl: int,
    period: str = '5d',
    mode: str = 'live',
    snapshot_key: Optional[str] = None,
    snapshot_ttl: int = 0,
) -> Dict[str, Dict]:
    """
    캐시 + single-flight + YFinanceBatchQuotesFetcher.
    동일 cache_key에 대한 동시 요청은 한 번의 다운로드만 수행하고 결과를 공유한다.

    snapshot_key/snapshot_ttl을 주면, 다운로드 성공 시 핫 캐시(ttl)와 별도로
    장기 스냅샷 키에도 같은 결과를 저장한다(stale-while-revalidate 폴백용).
    """
    from app.backend.core.cache import cache

    hit = await cache.get(cache_key)
    if hit is not None:
        return hit

    lock = _quote_locks.setdefault(cache_key, asyncio.Lock())
    async with lock:
        hit = await cache.get(cache_key)
        if hit is not None:
            return hit
        try:
            raw = await ServerExecutor.fetch(
                provider='yahoo',
                model='batch_quotes',
                params={'symbols': symbols, 'period': period, 'mode': mode},
            )
        except asyncio.CancelledError:
            return {}
        except RemoteUnavailableError:
            # yahoo는 fetcher 필수(서버 차단) — 워커 없으면 시세 없음(예상된 상황). 스팸 방지로 debug.
            log.debug("[quotes] yahoo unavailable — Fetcher 미실행")
            return {}
        except Exception as e:
            log.warning(f"[quotes] download failed: {e}")
            return {}

        result: Dict[str, Dict] = {}
        for item in (raw or []):
            if hasattr(item, 'symbol'):
                result[item.symbol] = {
                    'price':          item.price,
                    'change':         item.change,
                    'change_percent': item.change_percent,
                    'volume':         item.volume,
                }
            elif isinstance(item, dict):
                result[item['symbol']] = {k: item[k] for k in ('price', 'change', 'change_percent', 'volume')}

        if result:
            await cache.set(cache_key, result, ttl)
            if snapshot_key and snapshot_ttl > 0:
                await cache.set(snapshot_key, result, snapshot_ttl)
        return result

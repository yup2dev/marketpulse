"""
공통 서비스 유틸리티

모든 서비스 파일에서 공유하는 헬퍼 함수 모음.
QueryExecutor 결과(AnnotatedResult 또는 raw)를 일관되게 처리합니다.
"""
import asyncio
import logging
from typing import Any, Dict, List, Optional, TypeVar

from data_fetcher.fetchers.base import AnnotatedResult
from data_fetcher.query_executor import QueryExecutor

log = logging.getLogger(__name__)


_quote_locks: Dict[str, asyncio.Lock] = {}


async def cached_quotes(
    cache_key: str,
    symbols: List[str],
    ttl: int,
    period: str = '5d',
    mode: str = 'live',
) -> Dict[str, Dict]:
    """
    캐시 + single-flight + YFinanceBatchQuotesFetcher.
    동일 cache_key에 대한 동시 요청은 한 번의 다운로드만 수행하고 결과를 공유한다.
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
            raw = await QueryExecutor.fetch(
                provider='yahoo',
                model='batch_quotes',
                params={'symbols': symbols, 'period': period, 'mode': mode},
            )
        except asyncio.CancelledError:
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
        return result


T = TypeVar("T")


def unwrap(raw: Any) -> Any:
    """AnnotatedResult 또는 raw 데이터에서 결과 리스트를 추출합니다."""
    return raw.result if isinstance(raw, AnnotatedResult) else raw


def first(raw: Any) -> Optional[Any]:
    """첫 번째 항목을 반환합니다. 비어 있으면 None."""
    result = unwrap(raw)
    return result[0] if result else None


def limit_results(raw: Any, n: int) -> List[Any]:
    """결과를 최대 n개로 제한합니다."""
    return unwrap(raw)[:n]

"""
공통 서비스 유틸리티

모든 서비스 파일에서 공유하는 헬퍼 함수 모음.
QueryExecutor 결과(AnnotatedResult 또는 raw)를 일관되게 처리합니다.
"""
import asyncio
import logging
from typing import Any, Dict, List, Optional, TypeVar

from data_fetcher.abstract_provider.abstract.fetcher import AnnotatedResult
from data_fetcher.query_executor import QueryExecutor

log = logging.getLogger(__name__)


_quote_locks: Dict[str, asyncio.Lock] = {}


_KR_SUFFIX = {'KOSPI': '.KS', 'KOSDAQ': '.KQ'}


def to_quote_symbol(ticker_cd: str, exchange: str = '', curr: str = '') -> str:
    """DB의 원시 종목코드를 시세 조회(yfinance) 표준 심볼로 정규화.

    KR 종목은 DB에 접미사 없는 숫자 코드(예: '279570')로 저장되지만, yfinance는
    거래소별 접미사(.KS=KOSPI, .KQ=KOSDAQ)가 있어야 시세를 반환한다.
    """
    code = (ticker_cd or '').strip()
    if not code or '.' in code:
        return code
    if curr == 'KRW' or (exchange or '').upper() in _KR_SUFFIX:
        return code + _KR_SUFFIX.get((exchange or '').upper(), '.KS')
    return code


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
            if snapshot_key and snapshot_ttl > 0:
                await cache.set(snapshot_key, result, snapshot_ttl)
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

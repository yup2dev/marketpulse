"""
공통 서비스 유틸리티

모든 서비스 파일에서 공유하는 헬퍼 함수 모음.
QueryExecutor 결과(AnnotatedResult 또는 raw)를 일관되게 처리합니다.
"""
import asyncio
import concurrent.futures as _cf
import contextlib
import logging
from typing import Any, Dict, List, Optional, TypeVar

from data_fetcher.fetchers.base import AnnotatedResult

log = logging.getLogger(__name__)


@contextlib.contextmanager
def suppress_yfinance_logs():
    """yfinance 다운로드 중 상장폐지 종목 등의 WARNING 로그를 억제한다."""
    yf_loggers = [
        logging.getLogger(n)
        for n in ('yfinance', 'yfinance.base', 'yfinance.multi',
                  'yfinance.utils', 'yfinance.scrapers.history')
    ]
    old_levels = [lg.level for lg in yf_loggers]
    for lg in yf_loggers:
        lg.setLevel(logging.CRITICAL)
    try:
        yield
    finally:
        for lg, lv in zip(yf_loggers, old_levels):
            lg.setLevel(lv)


# ── 배치 시세 다운로드 (청크 동시 실행) ────────────────────────────────────────
#
# yf.download은 종목 수에 거의 선형으로 느려진다(300개 ≈ 92s). 작은 청크로 쪼개
# 동시 실행하면 300개 ≈ 28s로 단축된다. period='2d' → 전일 종가 대비 등락률.

def download_quotes_chunked(
    symbols: List[str],
    period: str = '2d',
    chunk_size: int = 20,
    max_workers: int = 15,
) -> Dict[str, Dict]:
    """
    종목 리스트를 청크 단위로 동시 다운로드.
    Returns: {sym: {price, change, change_percent, volume}}
    (동기 함수 — asyncio.to_thread로 호출할 것)
    """
    import pandas as pd
    import yfinance as yf

    symbols = [s for s in symbols if s]
    if not symbols:
        return {}

    def _dl(chunk):
        # 청크별 실패 격리 — 한 청크의 레이트리밋이 전체를 날리지 않도록.
        try:
            data = yf.download(
                tickers=chunk, period=period, interval='1d',
                auto_adjust=True, progress=False, threads=False,
            )
        except Exception:
            data = pd.DataFrame()
        return chunk, data

    chunks = [symbols[i:i + chunk_size] for i in range(0, len(symbols), chunk_size)]
    out: Dict[str, Dict] = {}

    # 로그 억제는 전체 동시 실행을 한 번만 감싼다.
    # (청크마다 감싸면 스레드 간 전역 로거 레벨 저장/복원이 경쟁 상태에 빠진다)
    with suppress_yfinance_logs(), _cf.ThreadPoolExecutor(max_workers=max_workers) as ex:
        for chunk, data in ex.map(_dl, chunks):
            if data is None or getattr(data, 'empty', True):
                continue
            is_multi = isinstance(data.columns, pd.MultiIndex)
            for sym in chunk:
                try:
                    close  = data['Close'][sym].dropna()  if is_multi else data['Close'].dropna()
                    volume = data['Volume'][sym].dropna() if is_multi else data['Volume'].dropna()
                    if close.empty:
                        continue
                    price = float(close.iloc[-1])
                    prev  = float(close.iloc[-2]) if len(close) > 1 else price
                    chg   = ((price - prev) / prev * 100) if prev else 0.0
                    vol   = int(volume.iloc[-1]) if not volume.empty else 0
                    out[sym] = {
                        'price':          round(price, 4),
                        'change':         round(price - prev, 4),
                        'change_percent': round(chg, 4),
                        'volume':         vol,
                    }
                except Exception:
                    continue

    return out


_quote_locks: Dict[str, asyncio.Lock] = {}


async def cached_quotes(cache_key: str, symbols: List[str], ttl: int, period: str = '2d') -> Dict[str, Dict]:
    """
    캐시 + single-flight + 청크 다운로드.
    동일 cache_key에 대한 동시 요청은 한 번의 다운로드만 수행하고 결과를 공유한다.
    """
    from app.backend.core.cache import cache

    hit = await cache.get(cache_key)
    if hit is not None:
        return hit

    lock = _quote_locks.setdefault(cache_key, asyncio.Lock())
    async with lock:
        hit = await cache.get(cache_key)        # 락 획득 후 재확인 (선행 요청이 채웠을 수 있음)
        if hit is not None:
            return hit
        try:
            result = await asyncio.to_thread(download_quotes_chunked, symbols, period)
        except asyncio.CancelledError:
            return {}
        except Exception as e:
            log.warning(f"[quotes] download failed: {e}")
            return {}
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

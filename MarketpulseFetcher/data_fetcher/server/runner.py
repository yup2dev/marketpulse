"""PC Fetcher 의 조회 한 번 — 순수 QueryExecutor + 이 PC 의 키 + 작은 TTL 캐시.

웹 서버가 로컬 전용 조회를 넘기면(웹소켓 워커 · REST /fetch) 여기서 실행한다. 키는 keystore 가 환경 변수로
올려 둔 값을 순수 실행기가 읽는다. 캐시는 ttl 을 명시한 요청만 (서버 실행 계층이 이미 캐시하므로 보통 0).
"""
import json
from typing import Any, Dict, Optional

from data_fetcher.query_executor import QueryExecutor
from data_fetcher.server.cache import MemoryCache

_executor = QueryExecutor()
_cache = MemoryCache()


async def run(provider: str, model: str, params: Optional[Dict[str, Any]] = None, ttl: Optional[int] = None) -> Any:
    params = dict(params or {})
    if not ttl or ttl <= 0:
        return await _executor.execute(provider, model, params)
    key = f"{provider}:{model}:{json.dumps(params, sort_keys=True, default=str)}"
    hit = await _cache.get(key)
    if hit is not None:
        return hit
    result = await _executor.execute(provider, model, params)
    if result is not None:
        await _cache.set(key, result, ttl)
    return result

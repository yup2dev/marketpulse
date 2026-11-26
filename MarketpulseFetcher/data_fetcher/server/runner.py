"""PC Fetcher 의 조회 한 번 — 순수 QueryExecutor + 이 PC 의 키 + 작은 TTL 캐시.

웹 서버가 로컬 실행 조회를 넘기면(웹소켓 워커 · REST /fetch) 여기서 실행한다. 키는 keystore 가 환경 변수로
올려 둔 값을 순수 실행기가 읽는다. 캐시는 ttl 을 명시한 요청만 (서버 실행 계층이 이미 캐시하므로 보통 0).

PC Fetcher 는 target="local" fetcher 만 실행한다. 서버 fetcher(target="server")는 exe 에 코드가 들어 있어도
실행하지 않는다 — 실행 위치는 fetcher 가 선언하고, 서버에서 돌 조회가 사용자 PC 로 새지 않게 여기서 한 번 더 막는다.
"""
import json
from typing import Any, Dict, List, Optional, Tuple

from data_fetcher.query_executor import QueryExecutor, QueryExecutorError
from data_fetcher.utils.provider_errors import EmptyDataError
from data_fetcher.server.cache import MemoryCache

_executor = QueryExecutor()
_cache = MemoryCache()


def local_fetchers() -> List[Tuple[str, str]]:
    """이 PC Fetcher 가 실행하는 (provider, model) — target="local" 인 등록 fetcher."""
    import data_fetcher.providers_init  # noqa: F401 — 등록 보장
    from data_fetcher.abstract_provider.abstract.provider import ProviderRegistry

    return sorted((name, model)
                  for name, prov in ProviderRegistry.get_all().items()
                  for model, fetcher in prov.fetcher_dict.items()
                  if getattr(fetcher, "target", "server") == "local")


def _ensure_local(provider: str, model: str) -> None:
    fetcher = _executor.get_fetcher(_executor.get_provider(provider), model)
    if getattr(fetcher, "target", "server") != "local":
        raise QueryExecutorError(
            f"'{provider}/{model}' 는 서버에서 실행하는 fetcher(target='server')라 PC Fetcher 가 실행하지 않습니다")


async def run(provider: str, model: str, params: Optional[Dict[str, Any]] = None, ttl: Optional[int] = None) -> Any:
    """조회 결과. 결과가 비면(EmptyDataError) 빈 목록 — 오류로 보내면 서버에서 '조회 실패'가 된다."""
    _ensure_local(provider, model)
    try:
        return await _run(provider, model, params, ttl)
    except EmptyDataError:
        return []


async def _run(provider: str, model: str, params: Optional[Dict[str, Any]], ttl: Optional[int]) -> Any:
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

"""ServerExecutor — 웹 서버의 조회 실행 한 곳. fetcher 패키지의 QueryExecutor(순수 실행)를 감싼다.

    [1] 캐시 — Fresh HIT 즉시 / Stale HIT 즉시 + 백그라운드 갱신(SWR) / MISS 는 single-flight 로 한 번만
    [2] 실행 위치 — routes.is_local(provider, model) (fetcher target, data_model_routes 는 긴급 전환만)
          local   로그인 사용자의 PC Fetcher 로 위임 (transport). 위임할 수 없으면 RemoteUnavailableError(503) —
                  서버 실행으로 넘기지 않는다. 받은 행은 fetcher 의 data_type 으로 재검증한다 (revalidate.py)
          server  서버에서 직접: 사용자 키(키 필요 provider) → 서킷브레이커 → QueryExecutor().execute
    [3] 결과 캐시 저장 (value: TTL×2, freshness flag: TTL)

app 계층(app.backend.platform)의 Query 는 ProviderInterface.create_executor() 로 이 객체를 받는다 (OpenBB 의 executor 자리).
commands · 서비스 · 웹소켓 라우트도 같은 곳(ServerExecutor.fetch)을 부른다 — 어디서 도는지는 여기서만 안다.

위임 transport 가 없으면(FETCHER_REMOTE_ENABLED=False — 개발 PC 한 대에서 서버 · Fetcher 를 같이 돌릴 때) 모두 서버에서 실행.
"""
import asyncio
import json
import logging
from typing import Any, Callable, Dict, List, Optional, Protocol, Union, runtime_checkable

from data_fetcher.abstract_provider.abstract.fetcher import AnnotatedResult
from data_fetcher.query_executor import QueryExecutor, QueryExecutorError

from app.backend.core.execution import routes
from app.backend.core.execution.circuit_breaker import CircuitBreakerOpen, get_circuit_breaker
from app.backend.core.execution.context import current_user_id, record_execution
from app.backend.core.execution.errors import MissingCredentialsError, RemoteUnavailableError
from app.backend.core.execution.revalidate import revalidate
from app.backend.core.execution.ttl import DEFAULT_TTL

log = logging.getLogger(__name__)


@runtime_checkable
class CacheProtocol(Protocol):
    async def get(self, key: str) -> Optional[Any]: ...
    async def set(self, key: str, value: Any, ttl: int) -> None: ...


@runtime_checkable
class RemoteTransport(Protocol):
    """로컬 전용 조회를 사용자 PC Fetcher 로 넘기는 통로 (fetcher_ws_transport · fetcher_client)."""
    async def fetch(self, provider: str, model: str, params: Dict[str, Any],
                    credentials: Optional[Dict[str, str]] = None, **kwargs: Any) -> Any: ...


class ServerExecutor:
    _cache: Optional[CacheProtocol] = None
    _ttl_map: Dict[str, int] = dict(DEFAULT_TTL)
    _remote: Optional[RemoteTransport] = None
    _credential_resolver: Optional[Callable[[str, str], Optional[Dict[str, str]]]] = None
    _cache_local_results: bool = True        # 로컬 전용(Y) 결과도 서버 캐시에 둘지 — 정해지면 설정으로
    _executor = QueryExecutor()
    _inflight: Dict[str, asyncio.Lock] = {}
    _swr_pending: set = set()
    _SWR_STALE_FACTOR: int = 2

    # ── 설정 ──────────────────────────────────────────────────────────────────

    @classmethod
    def configure(
        cls,
        cache: Optional[CacheProtocol] = None,
        ttl_map: Optional[Dict[str, int]] = None,
        remote: Optional[RemoteTransport] = None,
        credential_resolver: Optional[Callable[[str, str], Optional[Dict[str, str]]]] = None,
        cache_local_results: Optional[bool] = None,
    ) -> None:
        if cache is not None:
            cls._cache = cache
        if ttl_map:
            cls._ttl_map.update(ttl_map)
        if remote is not None:
            cls._remote = remote
        if credential_resolver is not None:
            cls._credential_resolver = staticmethod(credential_resolver)
        if cache_local_results is not None:
            cls._cache_local_results = cache_local_results
        log.info("[exec] configured: cache=%s remote=%s resolver=%s",
                 type(cls._cache).__name__ if cls._cache else None,
                 type(cls._remote).__name__ if cls._remote else "none (모두 서버 실행)",
                 "yes" if cls._credential_resolver else "no")

    # ── app 계층(Query) 이 부르는 자리 — OpenBB QueryExecutor.execute 와 같은 모양 ──

    async def execute(self, provider_name: str, model_name: str, params: Dict[str, Any],
                      credentials: Optional[Dict[str, str]] = None, **kwargs: Any) -> Any:
        if credentials is not None:
            kwargs["credentials"] = credentials
        return await type(self).fetch(provider=provider_name, model=model_name, params=params, **kwargs)

    # ── 실행 위치 ─────────────────────────────────────────────────────────────

    @classmethod
    def runs_locally(cls, provider: str, model: str) -> bool:
        """이 조회를 사용자 PC Fetcher 로 넘기는가 (위임 통로가 있을 때만)."""
        return cls._remote is not None and routes.is_local(provider, model)

    @classmethod
    async def _upstream(cls, provider: str, model: str, params: Dict[str, Any],
                        credentials: Optional[Dict[str, str]], **kwargs: Any) -> Any:
        user_id = current_user_id.get()

        if cls.runs_locally(provider, model):
            if not user_id:
                raise RemoteUnavailableError(
                    f"'{provider}' 데이터는 로그인 후 데스크톱 Fetcher로 조회됩니다. 로그인하고 Fetcher를 실행하세요.")
            raw = await cls._remote.fetch(provider, model, params, credentials, **kwargs)
            return revalidate(provider, model, raw)       # JSON 으로 잃은 타입 복원 — 서버 실행과 같은 Data 타입

        # 서버 실행 — 키 필요 provider 는 요청 사용자의 키 (없으면 운영자 키로 넘기지 않고 오류),
        # 요청이 없으면(배경 작업) 운영자 키(env — 순수 실행기가 읽는다)
        if credentials is None and user_id and cls._credential_resolver is not None:
            prov = cls._executor.get_provider(provider)
            if prov.credentials:
                credentials = cls._credential_resolver(provider, user_id)
                if not credentials:
                    raise MissingCredentialsError(provider)

        async with get_circuit_breaker(provider):
            return await cls._executor.execute(provider, model, params, credentials, **kwargs)

    # ── 캐시 ──────────────────────────────────────────────────────────────────

    @classmethod
    async def invalidate_provider(cls, provider: str) -> int:
        """provider 의 캐시 전부 무효화 — 원천이 바뀐 걸 알 때 (예: 배치 적재가 끝난 db provider). 지운 수."""
        invalidate = getattr(cls._cache, "invalidate_prefix", None)
        if invalidate is None:
            return 0
        return await invalidate(f"qe:{provider}:")

    @classmethod
    def _cache_key(cls, provider: str, model: str, params: Dict[str, Any]) -> str:
        return f"qe:{provider}:{model}:{json.dumps(params, sort_keys=True, default=str)}"

    @classmethod
    def _ttl(cls, provider: str, model: str, ttl: Optional[int]) -> int:
        if ttl is not None:
            return ttl
        if not cls._cache_local_results and cls.runs_locally(provider, model):
            return 0
        return cls._ttl_map.get(model, 0)

    @classmethod
    def _lock(cls, key: str) -> asyncio.Lock:
        if key not in cls._inflight:
            cls._inflight[key] = asyncio.Lock()
        return cls._inflight[key]

    @classmethod
    async def _write_cache(cls, key: str, result: Any, ttl: int) -> None:
        if not cls._cache or result is None:
            return
        await cls._cache.set(key, result, max(ttl * cls._SWR_STALE_FACTOR, ttl + 60))
        await cls._cache.set(f"{key}:f", 1, ttl)

    @classmethod
    async def _swr_refresh(cls, key: str, provider: str, model: str, params: Dict[str, Any],
                           credentials: Optional[Dict[str, str]], ttl: int, **kwargs: Any) -> None:
        lock = cls._lock(key)
        if lock.locked():
            return
        async with lock:
            try:
                await cls._write_cache(key, await cls._upstream(provider, model, params, credentials, **kwargs), ttl)
            except Exception as e:  # noqa: BLE001
                log.warning("[exec] SWR refresh failed (%s): %s", key[:60], e)
            finally:
                cls._swr_pending.discard(key)

    # ── 실행 ──────────────────────────────────────────────────────────────────

    @classmethod
    async def fetch(
        cls,
        provider: str,
        model: str,
        params: Dict[str, Any],
        credentials: Optional[Dict[str, str]] = None,
        ttl: Optional[int] = None,
        **kwargs: Any,
    ) -> Union[List[Any], AnnotatedResult]:
        """조회 한 번. ttl: None 이면 모델 기본 TTL, 0 이면 캐시 안 함."""
        result, cached = await cls._fetch(provider, model, params, credentials, ttl, **kwargs)
        record_execution(provider, model, cached=cached,
                         executed_at="local" if cls.runs_locally(provider, model) else "server")
        return result

    @classmethod
    async def _fetch(cls, provider: str, model: str, params: Dict[str, Any],
                     credentials: Optional[Dict[str, str]], ttl: Optional[int], **kwargs: Any):
        """(결과, 캐시에서 왔는가)."""
        effective_ttl = cls._ttl(provider, model, ttl)
        if not (cls._cache and effective_ttl > 0):
            try:
                return await cls._upstream(provider, model, params, credentials, **kwargs), False
            except CircuitBreakerOpen as e:
                raise QueryExecutorError(str(e)) from e

        key = cls._cache_key(provider, model, params)
        if await cls._cache.get(f"{key}:f") is not None:
            val = await cls._cache.get(key)
            if val is not None:
                return val, True
        stale = await cls._cache.get(key)
        if stale is not None:
            if key not in cls._swr_pending:
                cls._swr_pending.add(key)
                asyncio.create_task(cls._swr_refresh(key, provider, model, params, credentials, effective_ttl, **kwargs))
            return stale, True

        async with cls._lock(key):
            if await cls._cache.get(f"{key}:f") is not None:
                val = await cls._cache.get(key)
                if val is not None:
                    return val, True
            try:
                result = await cls._upstream(provider, model, params, credentials, **kwargs)
            except CircuitBreakerOpen as e:
                stale = await cls._cache.get(key)
                if stale is not None:
                    log.warning("[exec] Circuit OPEN for %s — serving stale cache", provider)
                    return stale, True
                raise QueryExecutorError(str(e)) from e
            await cls._write_cache(key, result, effective_ttl)
            return result, False


async def fetch(provider: str, model: str, params: Optional[Dict[str, Any]] = None, **kwargs: Any) -> Any:
    """ServerExecutor.fetch 의 짧은 이름."""
    return await ServerExecutor.fetch(provider, model, dict(params or {}), **kwargs)


def fetch_blocking(provider: str, model: str, params: Optional[Dict[str, Any]] = None, **kwargs: Any) -> Any:
    """동기 코드(스레드풀에서 도는 def 라우트 · 서비스 · command)에서 조회 한 번.

    조회는 메인 이벤트 루프에서 돈다 (anyio.from_thread) — 캐시(Redis async 클라이언트 · 인메모리 asyncio.Lock),
    single-flight 락, 서킷브레이커가 모두 메인 루프에 묶여 있어서 새 루프(asyncio.run)를 만들면 안 된다.
    스레드풀 밖(스크립트 · 테스트에서 직접 부를 때)이면 새 루프로 돈다.
    """
    import functools

    import anyio.from_thread

    call = functools.partial(ServerExecutor.fetch, provider, model, dict(params or {}), **kwargs)
    try:
        return anyio.from_thread.run(call)
    except RuntimeError as e:
        if "worker thread" not in str(e) and "AnyIO" not in str(e):
            raise
        return asyncio.run(call())


def rows_blocking(provider: str, model: str, **params: Any) -> List[Any]:
    """fetch_blocking 의 결과 행(표준 모델 객체) 목록."""
    from app.backend.platform.obbject import OBBject

    return list(OBBject.unwrap(fetch_blocking(provider, model, params)) or [])

"""data_fetcher 표준 HTTP 레이어 (aiohttp 단일 트랜스포트).

두 가지 요청 함수를 제공한다 — 이름이 다르므로 혼동 없이 한 모듈에서 공존한다:

  amake_request(url, method, timeout, response_callback, max_retries=0, **kw)
      OpenBB 이식 provider 용. ``response_callback(response, session)`` 에 실제
      aiohttp ClientResponse 가 넘어가 ``response.status`` / ``await response.json()``
      등이 OpenBB 원본과 동일하게 동작한다. 기본적으로 재시도하지 않는다(byte-compat);
      ``max_retries>0`` 이면 콜백 호출 전에 429/5xx 를 재시도한다.

  amake_json_request(url, *, params, headers, ..., max_retries=3)
      native provider 용 (구 async_http_client.amake_request 대체, 동일 계약):
      공유 세션 + 기본 재시도/백오프 + Retry-After 존중, 4xx 는 HTTPClientError,
      재시도 소진 429 는 RateLimitError, 기본 JSON 반환.

앱 종료 시 lifespan 에서 ``await aclose_shared_session()`` 으로 커넥션을 정리한다.
"""
import asyncio
import logging
from collections.abc import Awaitable, Callable
from difflib import SequenceMatcher
from functools import partial
from inspect import iscoroutinefunction
from typing import Any, Dict, Optional, TypeVar, Union, cast

# 호출부 예외 핸들링 일원화 (sync HTTPClient 와 공유)
from data_fetcher.utils.http_client import HTTPClientError, RateLimitError

log = logging.getLogger(__name__)

_DEFAULT_UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
)

# 재시도 대상 상태코드
_RETRY_STATUS = {429, 500, 502, 503, 504}

_T = TypeVar("_T")


def get_user_agent() -> str:
    """기본 User-Agent."""
    return _DEFAULT_UA


# ── 순수 유틸 ──────────────────────────────────────────────────────────────────

def check_item(item: str, allowed: list, threshold: float = 0.75) -> None:
    """item이 allowed에 없으면 ValueError (유사 항목 제안 포함)."""
    if item not in allowed:
        similarities = map(
            lambda c: (c, SequenceMatcher(None, item, c).ratio()), allowed
        )
        similar, score = max(similarities, key=lambda x: x[1])
        if score > threshold:
            raise ValueError(f"'{item}' is not available. Did you mean '{similar}'?")
        raise ValueError(f"'{item}' is not available.")


def get_querystring(items: dict, exclude: list) -> str:
    """dict를 쿼리스트링으로 변환(exclude 키 제외)."""
    for key in exclude:
        items.pop(key, None)

    query_items = []
    for key, value in items.items():
        if value is None:
            continue
        if isinstance(value, list):
            for item in value:
                query_items.append(f"{key}={item}")
        else:
            query_items.append(f"{key}={value}")

    querystring = "&".join(query_items)
    return f"{querystring}" if querystring else ""


def run_async(func: Callable[..., Awaitable[_T]], /, *args: Any, **kwargs: Any) -> _T:
    """코루틴 함수를 동기 컨텍스트에서 블로킹 실행 (anyio 포털)."""
    if not iscoroutinefunction(func):
        return cast(_T, func(*args, **kwargs))

    from anyio.from_thread import start_blocking_portal

    with start_blocking_portal() as portal:
        try:
            return portal.call(partial(func, *args, **kwargs))
        finally:
            portal.call(portal.stop)


# ── aiohttp 세션/요청 ─────────────────────────────────────────────────────────

def _coerce_request_kwargs(kwargs: dict) -> dict:
    """aiohttp.request 가 받지 않는 키 제거 + timeout/auth 변환."""
    import aiohttp

    for k in ("preferences", "with_session", "session", "verify_ssl", "ssl", "fingerprint"):
        kwargs.pop(k, None)

    timeout = kwargs.pop("timeout", None)
    if timeout is not None and not isinstance(timeout, aiohttp.ClientTimeout):
        kwargs["timeout"] = aiohttp.ClientTimeout(total=float(timeout))
    elif isinstance(timeout, aiohttp.ClientTimeout):
        kwargs["timeout"] = timeout

    auth = kwargs.get("auth")
    if auth is not None and isinstance(auth, (list, tuple)):
        kwargs["auth"] = aiohttp.BasicAuth(*auth)

    return kwargs


async def get_async_requests_session(**kwargs: Any):
    """aiohttp ClientSession 생성 (User-Agent 기본 포함).

    시스템 CA 번들이 없는 환경(패키징된 .exe, 일부 macOS/슬림 컨테이너)에서도
    HTTPS 인증서 검증이 실패하지 않도록 certifi CA 번들 기반 SSL 컨텍스트를 사용한다.
    """
    import ssl

    import aiohttp
    import certifi

    headers = kwargs.pop("headers", None) or {}
    headers.setdefault("User-Agent", _DEFAULT_UA)
    ssl_context = ssl.create_default_context(cafile=certifi.where())
    connector = aiohttp.TCPConnector(ssl=ssl_context)
    return aiohttp.ClientSession(headers=headers, connector=connector)


# ── 공유 세션 (lazy, 이벤트 루프 1개 가정 — 구 async_http_client 와 동일 전제) ──
_shared_session = None
_shared_session_lock = asyncio.Lock()


async def get_shared_session():
    """앱 전역에서 재사용하는 단일 ClientSession 반환 (없으면 생성)."""
    global _shared_session
    if _shared_session is None or _shared_session.closed:
        async with _shared_session_lock:
            if _shared_session is None or _shared_session.closed:
                _shared_session = await get_async_requests_session()
                log.info("[provider_helpers] shared ClientSession initialized")
    return _shared_session


async def aclose_shared_session() -> None:
    """앱 종료 시 커넥션 정리 (lifespan shutdown에서 호출)."""
    global _shared_session
    if _shared_session is not None and not _shared_session.closed:
        await _shared_session.close()
        log.info("[provider_helpers] shared ClientSession closed")
    _shared_session = None


def _retry_delay(response, attempt: int, backoff_factor: float) -> float:
    """Retry-After 헤더가 있으면 존중, 없으면 지수 백오프."""
    if response is not None:
        retry_after = response.headers.get("Retry-After")
        if retry_after:
            try:
                return min(float(retry_after), 30.0)
            except (TypeError, ValueError):
                pass
    return backoff_factor * (2 ** attempt)


async def _default_callback(response, _):
    return await response.json()


async def amake_request(
    url: str,
    method: str = "GET",
    timeout: int = 10,
    response_callback: Optional[Callable[..., Awaitable[Any]]] = None,
    max_retries: int = 0,
    backoff_factor: float = 0.3,
    **kwargs: Any,
) -> Union[dict, list]:
    """단일 비동기 요청 (OpenBB 호환). response_callback(response, session) 지원.

    max_retries>0 이면 콜백 호출 전에 429/5xx 상태를 재시도한다
    (기본 0 — OpenBB 콜백이 모든 응답을 직접 보는 기존 동작 유지).
    """
    if method.upper() not in ("GET", "POST"):
        raise ValueError("Method must be GET or POST")

    response_callback = response_callback or _default_callback

    with_session = kwargs.pop("with_session", "session" in kwargs)
    provided = kwargs.pop("session", None)
    session = provided or await get_async_requests_session(
        headers=kwargs.pop("headers", None)
    )

    req_kwargs = _coerce_request_kwargs({**kwargs, "timeout": timeout})

    try:
        for attempt in range(max_retries + 1):
            response = await session.request(method, url, **req_kwargs)
            if response.status in _RETRY_STATUS and attempt < max_retries:
                delay = _retry_delay(response, attempt, backoff_factor)
                log.warning(
                    "[provider_helpers] %s %s -> %s, retry %d/%d in %.2fs",
                    method, url, response.status, attempt + 1, max_retries, delay,
                )
                await asyncio.sleep(delay)
                continue
            return await response_callback(response, session)
    finally:
        if not with_session and provided is None:
            await session.close()


async def amake_requests(
    urls: Union[str, list],
    response_callback: Optional[Callable[..., Awaitable[Any]]] = None,
    **kwargs: Any,
) -> list:
    """여러 URL을 동시 요청 후 결과를 평탄화하여 반환."""
    if isinstance(urls, str):
        urls = [urls]

    method = kwargs.pop("method", "GET")
    session = kwargs.pop("session", None) or await get_async_requests_session(
        headers=kwargs.pop("headers", None)
    )
    with_session = kwargs.pop("with_session", False)

    try:
        coros = [
            amake_request(
                u,
                method=method,
                response_callback=response_callback,
                session=session,
                with_session=True,
                **kwargs,
            )
            for u in urls
        ]
        results = await asyncio.gather(*coros, return_exceptions=False)
    finally:
        if not with_session:
            await session.close()

    flattened: list = []
    for r in results:
        if r is None:
            continue
        if isinstance(r, list):
            flattened.extend(r)
        else:
            flattened.append(r)
    return flattened


async def amake_json_request(
    url: str,
    *,
    method: str = "GET",
    params: Optional[Dict[str, Any]] = None,
    headers: Optional[Dict[str, str]] = None,
    json: Optional[Any] = None,
    data: Optional[Any] = None,
    auth: Optional[Any] = None,
    timeout: float = 30.0,
    max_retries: int = 3,
    backoff_factor: float = 0.3,
    return_json: bool = True,
) -> Any:
    """native provider 용 비동기 요청 (구 async_http_client.amake_request 와 동일 계약).

    공유 ClientSession + 비차단 재시도/백오프, Retry-After 존중.

    Raises:
        RateLimitError:  재시도 소진 후에도 429
        HTTPClientError: 그 외 HTTP/전송 오류 (status_code 포함)
    """
    import aiohttp

    session = await get_shared_session()
    req_kwargs: Dict[str, Any] = {
        "params": params,
        "headers": headers,
        "json": json,
        "data": data,
        "timeout": aiohttp.ClientTimeout(total=float(timeout)),
    }
    if auth is not None:
        req_kwargs["auth"] = (
            aiohttp.BasicAuth(*auth) if isinstance(auth, (list, tuple)) else auth
        )
    last_exc: Optional[Exception] = None

    for attempt in range(max_retries + 1):
        try:
            async with session.request(method, url, **req_kwargs) as resp:
                if resp.status in _RETRY_STATUS:
                    if attempt < max_retries:
                        delay = _retry_delay(resp, attempt, backoff_factor)
                        log.warning(
                            "[provider_helpers] %s %s -> %s, retry %d/%d in %.2fs",
                            method, url, resp.status, attempt + 1, max_retries, delay,
                        )
                        await asyncio.sleep(delay)
                        continue
                    if resp.status == 429:
                        raise RateLimitError(
                            f"Rate limit exceeded for {url}", status_code=429
                        )
                if resp.status >= 400:
                    body = (await resp.text())[:200]
                    raise HTTPClientError(
                        f"HTTP {resp.status} for {url}: {body}",
                        status_code=resp.status,
                    )
                return await (resp.json(content_type=None) if return_json else resp.text())

        except (asyncio.TimeoutError, aiohttp.ClientError) as e:
            last_exc = e
            if attempt < max_retries:
                delay = backoff_factor * (2 ** attempt)
                log.warning(
                    "[provider_helpers] %s %s transport error (%s), retry %d/%d in %.2fs",
                    method, url, e.__class__.__name__, attempt + 1, max_retries, delay,
                )
                await asyncio.sleep(delay)
                continue
            raise HTTPClientError(f"Request failed for {url}: {e}") from e

    # 도달 불가하지만 안전망
    raise HTTPClientError(f"Request failed for {url}: {last_exc}")


def make_request(url: str, method: str = "GET", timeout: int = 10, **kwargs: Any):
    """동기 요청 (requests). requests.Response 반환.

    ``session`` 을 넘기면 해당 requests.Session 으로 요청한다(OECD 레거시 SSL 세션 등).
    """
    import requests

    headers = kwargs.pop("headers", None) or {}
    headers.setdefault("User-Agent", _DEFAULT_UA)
    kwargs.pop("preferences", None)
    session = kwargs.pop("session", None)
    requester = session if session is not None else requests
    if method.upper() == "GET":
        return requester.get(url, headers=headers, timeout=timeout, **kwargs)
    if method.upper() == "POST":
        return requester.post(url, headers=headers, timeout=timeout, **kwargs)
    raise ValueError("Method must be GET or POST")


# 일부 이식 코드가 helpers.response_callback 를 import 하므로 기본 콜백 노출
response_callback = _default_callback

__all__ = [
    "get_user_agent",
    "check_item",
    "get_querystring",
    "run_async",
    "get_async_requests_session",
    "get_shared_session",
    "aclose_shared_session",
    "amake_request",
    "amake_requests",
    "amake_json_request",
    "make_request",
    "response_callback",
    "HTTPClientError",
    "RateLimitError",
]

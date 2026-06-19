"""OpenBB 이식 provider 용 HTTP/유틸 헬퍼.

OpenBB provider 코드가 사용하는 헬퍼만 자체 구현한다. aiohttp 기반이라
``response_callback(response, session)`` 에 실제 aiohttp ClientResponse 가 넘어가
``response.status`` / ``await response.json()`` / ``.read()`` / ``.text()`` 호출이
OpenBB 원본과 동일하게 동작한다. 시그니처도 OpenBB 와 호환된다.
"""
import asyncio
from collections.abc import Awaitable, Callable
from difflib import SequenceMatcher
from functools import partial
from inspect import iscoroutinefunction
from typing import Any, Optional, TypeVar, Union, cast

_DEFAULT_UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
)

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


async def _default_callback(response, _):
    return await response.json()


async def amake_request(
    url: str,
    method: str = "GET",
    timeout: int = 10,
    response_callback: Optional[Callable[..., Awaitable[Any]]] = None,
    **kwargs: Any,
) -> Union[dict, list]:
    """단일 비동기 요청. response_callback(response, session) 지원."""
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
        response = await session.request(method, url, **req_kwargs)
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
    "amake_request",
    "amake_requests",
    "make_request",
    "response_callback",
]

"""
비동기 HTTP 클라이언트 (httpx 기반)

FastAPI async 환경에서 외부 API를 호출할 때 이벤트 루프를 블로킹하지 않도록
공유 httpx.AsyncClient + 비차단 재시도/백오프를 제공한다.

동기 `requests` 기반 `http_client.HTTPClient`의 async 대체:
    - 연결 풀링: 앱 전체가 단일 AsyncClient를 공유(커넥션 재사용)
    - 재시도: 429/5xx·타임아웃·전송오류에 대해 asyncio.sleep 백오프(루프 비차단)
    - Retry-After 헤더 존중

사용법:
    from data_fetcher.utils.async_http_client import amake_request

    data = await amake_request(url, params={"apikey": key})

앱 종료 시 lifespan에서 `await aclose_client()` 호출로 커넥션을 정리한다.
"""
import asyncio
import logging
from typing import Any, Dict, Optional

import httpx

# 동기 클라이언트와 예외 타입을 공유해 호출부 핸들링을 일원화한다.
from data_fetcher.utils.http_client import HTTPClientError, RateLimitError

log = logging.getLogger(__name__)

_DEFAULT_UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
)

# 재시도 대상 상태코드
_RETRY_STATUS = {429, 500, 502, 503, 504}

# ── 공유 클라이언트 (lazy, 이벤트 루프 1개 가정) ───────────────────────────────
_client: Optional[httpx.AsyncClient] = None
_client_lock = asyncio.Lock()


async def get_async_client() -> httpx.AsyncClient:
    """앱 전역에서 재사용하는 단일 AsyncClient를 반환(없으면 생성)."""
    global _client
    if _client is None or _client.is_closed:
        async with _client_lock:
            if _client is None or _client.is_closed:
                _client = httpx.AsyncClient(
                    timeout=httpx.Timeout(30.0, connect=10.0),
                    limits=httpx.Limits(
                        max_connections=100,
                        max_keepalive_connections=20,
                    ),
                    headers={"User-Agent": _DEFAULT_UA, "Accept": "application/json"},
                    follow_redirects=True,
                )
                log.info("[async_http] AsyncClient initialized")
    return _client


async def aclose_client() -> None:
    """앱 종료 시 커넥션 정리 (lifespan shutdown에서 호출)."""
    global _client
    if _client is not None and not _client.is_closed:
        await _client.aclose()
        log.info("[async_http] AsyncClient closed")
    _client = None


def _retry_delay(resp: Optional[httpx.Response], attempt: int, backoff_factor: float) -> float:
    """Retry-After 헤더가 있으면 존중, 없으면 지수 백오프."""
    if resp is not None:
        retry_after = resp.headers.get("Retry-After")
        if retry_after:
            try:
                return min(float(retry_after), 30.0)
            except (TypeError, ValueError):
                pass
    return backoff_factor * (2 ** attempt)


async def amake_request(
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
    """비동기 HTTP 요청 (비차단 재시도 포함).

    Args:
        url:            요청 URL
        method:         HTTP 메서드 (기본 GET)
        params:         쿼리 파라미터
        headers:        추가 헤더
        json/data:      POST 바디
        auth:           httpx 인증 (예: (user, password) HTTP Basic 튜플)
        timeout:        요청 타임아웃(초)
        max_retries:    재시도 횟수 (429/5xx/타임아웃/전송오류 대상)
        backoff_factor: 지수 백오프 계수 (delay = factor * 2**attempt)
        return_json:    True면 .json(), False면 .text 반환

    Raises:
        RateLimitError:  재시도 소진 후에도 429
        HTTPClientError: 그 외 HTTP/전송 오류
    """
    client = await get_async_client()
    last_exc: Optional[Exception] = None

    for attempt in range(max_retries + 1):
        try:
            resp = await client.request(
                method, url,
                params=params, headers=headers, json=json, data=data, auth=auth,
                timeout=timeout,
            )

            # 재시도 가능한 상태코드
            if resp.status_code in _RETRY_STATUS:
                if attempt < max_retries:
                    delay = _retry_delay(resp, attempt, backoff_factor)
                    log.warning(
                        "[async_http] %s %s -> %s, retry %d/%d in %.2fs",
                        method, url, resp.status_code, attempt + 1, max_retries, delay,
                    )
                    await asyncio.sleep(delay)
                    continue
                if resp.status_code == 429:
                    raise RateLimitError(f"Rate limit exceeded for {url}")

            resp.raise_for_status()
            return resp.json() if return_json else resp.text

        except (httpx.TimeoutException, httpx.TransportError) as e:
            last_exc = e
            if attempt < max_retries:
                delay = backoff_factor * (2 ** attempt)
                log.warning(
                    "[async_http] %s %s transport error (%s), retry %d/%d in %.2fs",
                    method, url, e.__class__.__name__, attempt + 1, max_retries, delay,
                )
                await asyncio.sleep(delay)
                continue
            raise HTTPClientError(f"Request failed for {url}: {e}") from e

        except httpx.HTTPStatusError as e:
            # 4xx 등 비재시도 상태코드
            raise HTTPClientError(
                f"HTTP {e.response.status_code} for {url}: {e}"
            ) from e

    # 도달 불가하지만 안전망
    raise HTTPClientError(f"Request failed for {url}: {last_exc}")


async def aget(url: str, **kwargs: Any) -> Any:
    """GET 편의 함수."""
    return await amake_request(url, method="GET", **kwargs)


async def apost(url: str, **kwargs: Any) -> Any:
    """POST 편의 함수."""
    return await amake_request(url, method="POST", **kwargs)

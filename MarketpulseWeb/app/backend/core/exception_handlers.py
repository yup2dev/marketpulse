"""전역 예외 처리 — 라우트가 던진 예외를 한 곳에서 HTTP 응답으로 바꾼다.

    예외 (자신 또는 __cause__ 체인)          응답
    ─────────────────────────────────────    ──────────────────────────────────────────
    HTTPException                            그대로 (FastAPI 기본 — 의도한 404 · 409 등)
    CircuitBreakerOpen                       503 + Retry-After
    MissingCredentialsError                  424 {detail, code:"missing_key", provider}
    RemoteUnavailableError                   503 (Fetcher · 워커 꺼짐 — 프론트가 'Fetcher 실행' 안내)
    QueryExecutorError (그 밖)               502
    HTTPClientError                          402 · 429 · 403 · 502 (외부 API 응답에 맞춰)
    ValueError                               400 (서비스의 '잘못된 입력' — pydantic ValidationError 포함)
    그 밖의 Exception                         500 + 트레이스백 로그

처리는 두 군데에서 같은 error_response() 로 한다.
  - add_exception_handler: 위 예외 타입들. ExceptionMiddleware(가장 안쪽)라 CORS 헤더가 붙는다.
  - UnhandledErrorMiddleware: 그 밖의 예외. Starlette 는 Exception 핸들러를 가장 바깥
    ServerErrorMiddleware 에서 돌려 CORS 헤더가 빠진다 → 브라우저가 상태 코드를 못 보고 네트워크 오류로
    본다. 그래서 500 은 CORS 안쪽의 순수 ASGI 미들웨어가 만든다 (응답이 시작된 스트리밍은 건드리지 않는다).
"""
import logging
from typing import Optional

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from data_fetcher.query_executor import (
    MissingCredentialsError, QueryExecutorError, RemoteUnavailableError,
)
from data_fetcher.utils.circuit_breaker import CircuitBreakerOpen
from data_fetcher.utils.http_client import HTTPClientError

log = logging.getLogger("app.backend.errors")

# add_exception_handler 로 거는 타입 — 이 밖의 예외는 UnhandledErrorMiddleware 가 받는다
HANDLED_TYPES = (CircuitBreakerOpen, QueryExecutorError, HTTPClientError, ValueError)


def _find_cause(exc: BaseException, types) -> Optional[BaseException]:
    """예외 자신 또는 __cause__ 체인에서 주어진 타입을 찾는다."""
    cur = exc
    for _ in range(5):
        if cur is None:
            return None
        if isinstance(cur, types):
            return cur
        cur = cur.__cause__
    return None


def missing_key_response(err: MissingCredentialsError) -> JSONResponse:
    """사용자 키 미등록 → 424 + code/provider. 프론트는 이 code 로 '키 등록' 안내를 띄운다.

    401/403 을 쓰지 않는 이유: apiClient 가 그 둘을 세션 만료로 보고 refresh·로그아웃한다.
    """
    return JSONResponse(
        status_code=424,
        content={"detail": str(err), "code": "missing_key", "provider": err.provider},
    )


def _http_client_response(err: HTTPClientError) -> JSONResponse:
    sc = getattr(err, "status_code", None)
    if sc == 402:
        return JSONResponse(status_code=402, content={"detail": "API subscription required for this data source"})
    if sc == 429:
        return JSONResponse(status_code=429, content={"detail": "External API rate limit exceeded"})
    if sc in (401, 403):
        return JSONResponse(status_code=403, content={"detail": "External API access denied"})
    return JSONResponse(status_code=502, content={"detail": str(err)})


def error_response(exc: BaseException, where: str = "") -> Optional[JSONResponse]:
    """알려진 예외 → 응답 (+ 간결한 로그, 트레이스백 없음). 모르는 예외면 None."""
    cb = _find_cause(exc, (CircuitBreakerOpen,))
    if cb is not None:
        log.warning("[%s] %s", where, exc)
        return JSONResponse(
            status_code=503,
            content={"detail": str(cb)},
            headers={"Retry-After": str(int(cb.retry_after) + 1)},
        )
    missing = _find_cause(exc, (MissingCredentialsError,))
    if missing is not None:
        log.info("[%s] %s", where, missing)
        return missing_key_response(missing)
    unavailable = _find_cause(exc, (RemoteUnavailableError,))
    if unavailable is not None:
        log.warning("[%s] %s", where, unavailable)
        return JSONResponse(status_code=503, content={"detail": str(unavailable)})
    qe = _find_cause(exc, (QueryExecutorError,))
    if qe is not None:
        log.warning("[%s] %s", where, qe)
        return JSONResponse(status_code=502, content={"detail": str(qe)})
    http_err = _find_cause(exc, (HTTPClientError,))
    if http_err is not None:
        log.warning("[%s] external API error: %s", where, http_err)
        return _http_client_response(http_err)
    if isinstance(exc, ValueError):
        log.info("[%s] %s", where, exc)
        return JSONResponse(status_code=400, content={"detail": str(exc)})
    return None


def _where(scope_or_request) -> str:
    scope = getattr(scope_or_request, "scope", scope_or_request)
    return f"{scope.get('method', '')} {scope.get('path', '')}".strip()


def unexpected_response(exc: BaseException, where: str) -> JSONResponse:
    log.error("[%s] %s", where, exc, exc_info=exc)
    return JSONResponse(status_code=500, content={"detail": str(exc)})


async def handle_known(request: Request, exc: Exception) -> JSONResponse:
    """HANDLED_TYPES 의 핸들러. 타입은 맞아도 error_response 가 모르는 경우는 없지만 500 으로 막아 둔다."""
    where = _where(request)
    return error_response(exc, where) or unexpected_response(exc, where)


class UnhandledErrorMiddleware:
    """HANDLED_TYPES 밖의 예외 → error_response(체인에 알려진 원인이 있으면) 또는 500.

    순수 ASGI — BaseHTTPMiddleware 는 스트리밍(SSE)을 한 번 더 감싼다. 응답 머리를 이미 보냈으면
    바꿀 수 없으니 그대로 다시 던진다.
    """

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        started = False

        async def _send(message):
            nonlocal started
            if message["type"] == "http.response.start":
                started = True
            await send(message)

        try:
            await self.app(scope, receive, _send)
        except Exception as exc:  # noqa: BLE001 — 여기가 마지막 그물
            if started:
                raise
            where = _where(scope)
            response = error_response(exc, where) or unexpected_response(exc, where)
            await response(scope, receive, send)


def add_exception_handlers(app: FastAPI) -> None:
    """앱에 전역 예외 처리를 건다. 다른 미들웨어보다 먼저 불러 가장 안쪽에 둔다 (CORS · 계측이 응답을 본다)."""
    for exc_type in HANDLED_TYPES:
        app.add_exception_handler(exc_type, handle_known)
    app.add_middleware(UnhandledErrorMiddleware)

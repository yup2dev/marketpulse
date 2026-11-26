"""
API Route Utilities
공통 에러 처리 데코레이터 — 모든 라우트 핸들러에 일관된 예외 처리를 적용합니다.

사용법:
    from app.backend.api.deps import route_handler

    @router.get("/something")
    @route_handler
    async def my_endpoint(...):
        return await service.do_something(...)

처리 규칙 — 모든 오류 응답은 {detail, code, provider?} (exception_response):
    - HTTPException          → 그 상태 그대로 + code (404 not_found · 400 bad_param …)
    - ValueError             → 400 bad_param
    - EmptyDataError         → 200 + 빈 results + warnings (오류가 아니다)
    - 키 미등록              → 424 missing_key
    - PC Fetcher             → 503 fetcher_offline · fetcher_timeout · fetcher_outdated / 서킷 503 circuit_open
    - 외부 API               → 402 upstream_subscription · 429 upstream_limit · 502 upstream_denied · upstream_error
    - 위젯에 없는 데이터 API → 404 api_not_registered (WIDGET_API_GATE=enforce 일 때)
    - 그 외 Exception        → 500 internal_error + 로깅 (exc_info=True)
"""
import asyncio
import logging
from functools import wraps
from typing import Any

from fastapi import HTTPException
from fastapi.responses import JSONResponse

from data_fetcher.query_executor import QueryExecutorError
from data_fetcher.utils.provider_errors import EmptyDataError, UnauthorizedError
from app.backend.core.execution import MissingCredentialsError, RemoteUnavailableError
from app.backend.core.execution.errors import FetcherOutdatedError, FetcherTimeoutError
from app.backend.services.widget_sources import ApiNotRegisteredError
from app.backend.core.execution.circuit_breaker import CircuitBreakerOpen
from data_fetcher.utils.http_client import HTTPClientError


# ── 날짜가 있는 행 목록 공통 처리 (게이트웨이·전용 라우트 공용) ──────────────────

# 행 dict에서 날짜 필드로 인정하는 키 (우선순위 순)
from data_fetcher.core.model_schema import DATE_KEYS  # noqa: E402 — 날짜 필드 이름은 한 곳에


def row_date_key(rows: list) -> str | None:
    """행 목록의 날짜 필드 키. 첫 행 기준 우선순위 매칭, 없으면 *_date 아무거나."""
    if not rows or not isinstance(rows[0], dict):
        return None
    first = rows[0]
    for k in DATE_KEYS:
        if k in first:
            return k
    return next((k for k in first if k.endswith("_date")), None)


def filter_dated_rows(rows: list, start_date: Any, end_date: Any, key: str | None = None) -> list:
    """날짜 필드가 있는 행 목록의 공통 후처리.

    - start_date/end_date 가 주어지면 범위 밖 행 제거 (fetcher가 자체 지원하지 않는
      모델도 위젯의 기간 선택이 동작하도록 하는 범용 필터 — 이중 적용은 무해)
    - 날짜 desc 정렬 (최신이 위로)

    key 를 주면 그 필드로 거른다(예: 내부자 거래는 공시일보다 거래일). 행에 그 키가
    없으면 자동 감지로 돌아간다. 직렬화된 행(dict, 날짜는 ISO 문자열)을 전제로
    문자열 prefix(YYYY-MM-DD) 비교를 쓴다.
    """
    if key is None or not rows or not isinstance(rows[0], dict) or key not in rows[0]:
        key = row_date_key(rows)
    if key is None:
        return rows

    def day(row: dict) -> str | None:
        v = row.get(key)
        return str(v)[:10] if v not in (None, "") else None

    if start_date or end_date:
        lo = str(start_date)[:10] if start_date else None
        hi = str(end_date)[:10] if end_date else None
        rows = [
            r for r in rows
            if (d := day(r)) is not None and (lo is None or d >= lo) and (hi is None or d <= hi)
        ]
    return sorted(rows, key=lambda r: day(r) or "", reverse=True)


def period_start(period: str | None) -> str | None:
    """기간 토큰(1mo·1y·5y·max …) → 시작일 ISO 문자열. 'max'·빈 값은 None(제한 없음).

    data_fetcher 의 parse_period_to_dates 는 끝을 '오늘-3일'로 잡는다(경제지표 지연용).
    이벤트 목록(배당·공시 등)은 최근 며칠이 빠지면 안 되므로 시작일만 계산한다.
    """
    if not period:
        return None
    p = period.strip().lower()
    if p in ("max", "all"):
        return None
    from datetime import date, timedelta
    import re
    m = re.fullmatch(r"(\d+)(d|w|wk|mo|m|y)", p)
    if not m:
        raise ValueError(f"Unsupported period: {period}")
    n, unit = int(m.group(1)), m.group(2)
    days = {"d": 1, "w": 7, "wk": 7, "mo": 30, "m": 30, "y": 365}[unit] * n
    return (date.today() - timedelta(days=days)).isoformat()


def resolve_date_range(period: str | None, start_date: str | None, end_date: str | None):
    """명시한 start/end 가 period 보다 우선한다 (OpenBB 처럼 날짜를 직접 줄 수도 있게)."""
    return (start_date or period_start(period)), end_date


def _find_cause(e: Exception, types: tuple) -> Exception | None:
    """예외 자신 또는 __cause__ 체인에서 주어진 타입을 찾는다."""
    cur = e
    for _ in range(5):
        if isinstance(cur, types):
            return cur
        cur = getattr(cur, "__cause__", None)
        if cur is None:
            break
    return None


# ── 오류 응답 — 모든 오류는 {detail, code, provider?} ─────────────────────────────
# 위젯은 code 로 분기한다 (code 가 없던 시절의 응답은 status 로 — 프론트 common/widget/helpers.js).
# 401 · 403 은 provider 오류에 쓰지 않는다: apiClient 가 그 둘을 세션 만료로 보고 refresh · 로그아웃한다.

_HTTP_CODES = {400: "bad_param", 403: "forbidden", 404: "not_found", 409: "conflict", 422: "bad_param"}


def error_response(status: int, code: str, detail: Any, provider: str | None = None,
                   headers: dict | None = None) -> JSONResponse:
    body: dict = {"detail": detail, "code": code}
    if provider:
        body["provider"] = provider
    return JSONResponse(status_code=status, content=body, headers=headers)


def missing_key_response(err: MissingCredentialsError) -> JSONResponse:
    """사용자 키 미등록 → 424 + code/provider. 프론트는 이 code로 '키 등록' 안내를 띄운다."""
    return error_response(424, "missing_key", str(err), provider=err.provider)


def empty_response(err: Exception) -> JSONResponse:
    """조회는 됐고 결과가 없다 — 오류가 아니다. 200 + 빈 results + warnings (OBBject 모양)."""
    message = getattr(err, "message", None) or str(err) or "No results found."
    return JSONResponse(status_code=200, content={"results": [], "provider": None, "warnings": [message],
                                                  "metadata": {}})


def _upstream_response(err: HTTPClientError) -> JSONResponse:
    sc = getattr(err, "status_code", None)
    if sc == 402:
        return error_response(402, "upstream_subscription", "API subscription required for this data source")
    if sc == 429:
        return error_response(429, "upstream_limit", "External API rate limit exceeded")
    if sc in (401, 403):
        return error_response(502, "upstream_denied", "External API access denied — check the API key and plan")
    return error_response(502, "upstream_error", str(err))


def exception_response(e: Exception, log, name: str) -> JSONResponse:
    """라우트에서 올라온 예외 → 오류 응답 한 곳. 코드표는 docs/ARCHITECTURE.ko.md '오류 응답'."""
    if isinstance(e, HTTPException):                       # 라우트가 일부러 던진 404 · 400 등
        return error_response(e.status_code, _HTTP_CODES.get(e.status_code, "error"), e.detail,
                              headers=getattr(e, "headers", None))
    if isinstance(e, ValueError):
        return error_response(400, "bad_param", str(e))
    if isinstance(e, ApiNotRegisteredError):              # 위젯에 등록되지 않은 데이터 API (WIDGET_API_GATE=enforce)
        return error_response(404, "api_not_registered", str(e))

    empty = _find_cause(e, (EmptyDataError,))
    if empty is not None:
        log.info(f"[{name}] empty: {empty}")
        return empty_response(empty)
    missing = _find_cause(e, (MissingCredentialsError,))
    if missing is not None:
        log.info(f"[{name}] {missing}")
        return missing_key_response(missing)
    cb_err = _find_cause(e, (CircuitBreakerOpen,))
    if cb_err is not None:
        log.warning(f"[{name}] {e}")
        return error_response(503, "circuit_open", str(cb_err), provider=getattr(cb_err, "provider", None),
                              headers={"Retry-After": str(int(cb_err.retry_after) + 1)})
    for exc_type, code in ((FetcherOutdatedError, "fetcher_outdated"), (FetcherTimeoutError, "fetcher_timeout"),
                           (RemoteUnavailableError, "fetcher_offline")):
        remote = _find_cause(e, (exc_type,))
        if remote is not None:
            log.warning(f"[{name}] {remote}")
            return error_response(503, code, str(remote))
    http_err = _find_cause(e, (HTTPClientError,))
    if http_err is not None:
        log.warning(f"[{name}] external API error: {e}")
        return _upstream_response(http_err)
    denied = _find_cause(e, (UnauthorizedError,))
    if denied is not None:
        log.warning(f"[{name}] external API denied: {denied}")
        return error_response(502, "upstream_denied", str(denied))
    qe = _find_cause(e, (QueryExecutorError,))
    if qe is not None:
        log.warning(f"[{name}] {qe}")
        return error_response(502, "upstream_error", str(qe))
    log.error(f"[{name}] {e}", exc_info=True)
    return error_response(500, "internal_error", str(e))


def route_handler(func):
    """
    라우트 핸들러에 공통 에러 처리를 적용하는 데코레이터.
    async / sync 함수 모두 지원합니다. 예외는 exception_response 가 {detail, code} 응답으로 바꾼다.
    """
    log = logging.getLogger(func.__module__)

    if asyncio.iscoroutinefunction(func):
        @wraps(func)
        async def async_wrapper(*args, **kwargs):
            try:
                return await func(*args, **kwargs)
            except Exception as e:  # noqa: BLE001 — 전부 응답으로 바꾼다
                return exception_response(e, log, func.__name__)
        return async_wrapper

    @wraps(func)
    def sync_wrapper(*args, **kwargs):
        try:
            return func(*args, **kwargs)
        except Exception as e:  # noqa: BLE001
            return exception_response(e, log, func.__name__)
    return sync_wrapper

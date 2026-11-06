"""
API Route Utilities
공통 에러 처리 데코레이터 — 모든 라우트 핸들러에 일관된 예외 처리를 적용합니다.

사용법:
    from app.backend.api.deps import route_handler

    @router.get("/something")
    @route_handler
    async def my_endpoint(...):
        return await service.do_something(...)

처리 규칙:
    - HTTPException          → 그대로 재전달 (의도적인 404/400 등)
    - ValueError             → 400 Bad Request
    - 그 외 Exception        → 500 Internal Server Error + 로깅 (exc_info=True)
"""
import asyncio
import logging
from functools import wraps
from typing import Any

from fastapi import HTTPException
from fastapi.responses import JSONResponse

from data_fetcher.abstract_provider.abstract.fetcher import AnnotatedResult
from data_fetcher.core.obbject import OBBject
from data_fetcher.query_executor import (
    MissingCredentialsError, QueryExecutorError, RemoteUnavailableError,
)
from data_fetcher.utils.circuit_breaker import CircuitBreakerOpen
from data_fetcher.utils.http_client import HTTPClientError


def wrap_result(raw: Any, provider: str) -> OBBject:
    """
    OpenBB OBBject.from_query 와 동일한 역할:
      - AnnotatedResult  → result 리스트 추출 + metadata 보존
      - List[DataModel]  → model_dump(mode='json') 직렬화
      - List[dict]       → 그대로
      - dict (snapshot)  → [dict] 단일 행
    """
    metadata: dict = {}
    if isinstance(raw, AnnotatedResult):
        metadata = raw.metadata or {}
        raw = raw.result

    items = raw if isinstance(raw, list) else ([raw] if raw is not None else [])
    results = [
        item.model_dump(mode="json") if hasattr(item, "model_dump") else item
        for item in items
    ]
    return OBBject(results=results, provider=provider, metadata=metadata)


# ── 날짜가 있는 행 목록 공통 처리 (게이트웨이·전용 라우트 공용) ──────────────────

# 행 dict에서 날짜 필드로 인정하는 키 (우선순위 순)
DATE_KEYS = ("date", "period_ending", "filing_date", "report_date", "datetime", "timestamp")


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


def missing_key_response(err: MissingCredentialsError) -> JSONResponse:
    """사용자 키 미등록 → 424 + code/provider. 프론트는 이 code로 '키 등록' 안내를 띄운다.

    401/403 을 쓰지 않는 이유: apiClient 가 그 둘을 세션 만료로 보고 refresh·로그아웃한다.
    """
    return JSONResponse(
        status_code=424,
        content={"detail": str(err), "code": "missing_key", "provider": err.provider},
    )


def _query_executor_response(e: Exception, log, name: str):
    """QueryExecutorError 계열 → 간결한 로그(트레이스백 X) + 적절한 상태코드. 해당 없으면 None."""
    missing = _find_cause(e, (MissingCredentialsError,))
    if missing is not None:
        log.info(f"[{name}] {missing}")
        return missing_key_response(missing)
    # 원격(Fetcher/워커) 미가용 → 503
    unavailable = _find_cause(e, (RemoteUnavailableError,))
    if unavailable is not None:
        log.warning(f"[{name}] {unavailable}")
        return JSONResponse(status_code=503, content={"detail": str(unavailable)})
    # 그 외 조회 오류(자격증명 누락·provider/model 오류 등) → 간결 로그 + 502
    qe = _find_cause(e, (QueryExecutorError,))
    if qe is not None:
        log.warning(f"[{name}] {qe}")
        return JSONResponse(status_code=502, content={"detail": str(qe)})
    return None


def _http_client_response(e: Exception):
    """HTTPClientError → 외부 API 에러에 맞는 JSONResponse 반환. 해당 없으면 None."""
    err = e if isinstance(e, HTTPClientError) else (
        e.__cause__ if isinstance(e.__cause__, HTTPClientError) else None
    )
    if err is None:
        return None
    sc = getattr(err, 'status_code', None)
    if sc == 402:
        return JSONResponse(status_code=402, content={"detail": "API subscription required for this data source"})
    if sc == 429:
        return JSONResponse(status_code=429, content={"detail": "External API rate limit exceeded"})
    if sc in (401, 403):
        return JSONResponse(status_code=403, content={"detail": "External API access denied"})
    return JSONResponse(status_code=502, content={"detail": str(err)})


def route_handler(func):
    """
    라우트 핸들러에 공통 에러 처리를 적용하는 데코레이터.
    async / sync 함수 모두 지원합니다.
    """
    log = logging.getLogger(func.__module__)

    if asyncio.iscoroutinefunction(func):
        @wraps(func)
        async def async_wrapper(*args, **kwargs):
            try:
                return await func(*args, **kwargs)
            except HTTPException:
                raise
            except ValueError as e:
                raise HTTPException(status_code=400, detail=str(e))
            except Exception as e:
                cb_err = e if isinstance(e, CircuitBreakerOpen) else (
                    e.__cause__ if isinstance(e.__cause__, CircuitBreakerOpen) else None
                )
                if cb_err is not None:
                    log.warning(f"[{func.__name__}] {e}")
                    return JSONResponse(
                        status_code=503,
                        content={"detail": str(cb_err)},
                        headers={"Retry-After": str(int(cb_err.retry_after) + 1)},
                    )
                http_resp = _http_client_response(e)
                if http_resp is not None:
                    log.warning(f"[{func.__name__}] external API error: {e}")
                    return http_resp
                qe_resp = _query_executor_response(e, log, func.__name__)
                if qe_resp is not None:
                    return qe_resp
                log.error(f"[{func.__name__}] {e}", exc_info=True)
                raise HTTPException(status_code=500, detail=str(e))
        return async_wrapper

    else:
        @wraps(func)
        def sync_wrapper(*args, **kwargs):
            try:
                return func(*args, **kwargs)
            except HTTPException:
                raise
            except ValueError as e:
                raise HTTPException(status_code=400, detail=str(e))
            except Exception as e:
                cb_err = e if isinstance(e, CircuitBreakerOpen) else (
                    e.__cause__ if isinstance(e.__cause__, CircuitBreakerOpen) else None
                )
                if cb_err is not None:
                    log.warning(f"[{func.__name__}] {e}")
                    return JSONResponse(
                        status_code=503,
                        content={"detail": str(cb_err)},
                        headers={"Retry-After": str(int(cb_err.retry_after) + 1)},
                    )
                http_resp = _http_client_response(e)
                if http_resp is not None:
                    log.warning(f"[{func.__name__}] external API error: {e}")
                    return http_resp
                qe_resp = _query_executor_response(e, log, func.__name__)
                if qe_resp is not None:
                    return qe_resp
                log.error(f"[{func.__name__}] {e}", exc_info=True)
                raise HTTPException(status_code=500, detail=str(e))
        return sync_wrapper

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
from data_fetcher.query_executor import QueryExecutorError, RemoteUnavailableError
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


def _query_executor_response(e: Exception, log, name: str):
    """QueryExecutorError 계열 → 간결한 로그(트레이스백 X) + 적절한 상태코드. 해당 없으면 None."""
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

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
from data_fetcher.utils.circuit_breaker import CircuitBreakerOpen


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
                log.error(f"[{func.__name__}] {e}", exc_info=True)
                raise HTTPException(status_code=500, detail=str(e))
        return sync_wrapper

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

from fastapi import HTTPException


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
                log.error(f"[{func.__name__}] {e}", exc_info=True)
                raise HTTPException(status_code=500, detail=str(e))
        return sync_wrapper

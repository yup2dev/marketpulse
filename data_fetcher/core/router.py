"""
CommandRouter

@router.command(model="BalanceSheet") 데코레이터를 제공하는 FastAPI 라우터 확장.

사용 예시:
    router = CommandRouter(prefix="/equity/fundamental", tags=["equity"])

    @router.command(model="IncomeStatement")
    async def income_statement(
        symbol: str,
        provider: str = "fmp",
        period: str = "annual",
        limit: int = 5,
    ) -> OBBject:
        return await OBBject.from_query(Query(**locals()))
"""
from __future__ import annotations

import re
from functools import wraps
from typing import Any, Callable, List, Optional

from fastapi import APIRouter

from data_fetcher.core.query import _command_model


def _to_kebab_case(name: str) -> str:
    """
    PascalCase → kebab-case URL 경로 변환

    Examples:
        "BalanceSheet"    → "balance-sheet"
        "IncomeStatement" → "income-statement"
        "gdp"             → "gdp"
    """
    s = re.sub(r"([A-Z]+)([A-Z][a-z])", r"\1-\2", name)
    s = re.sub(r"([a-z\d])([A-Z])", r"\1-\2", s)
    return s.lower()


class CommandRouter:
    """
    @router.command() 데코레이터를 지원하는 FastAPI 라우터 래퍼

    내부적으로 FastAPI APIRouter를 보유하며, command() 데코레이터로
    등록된 함수를 GET 엔드포인트로 자동 변환합니다.

    Args:
        prefix: 라우터 경로 prefix (예: "/equity/fundamental")
        tags:   OpenAPI 태그 목록
    """

    def __init__(
        self,
        prefix: str = "",
        tags: Optional[List[str]] = None,
        **router_kwargs: Any,
    ) -> None:
        self._router = APIRouter(prefix=prefix, tags=tags or [], **router_kwargs)

    # APIRouter 속성 위임
    @property
    def router(self) -> APIRouter:
        return self._router

    def command(
        self,
        model: str,
        path: Optional[str] = None,
        **endpoint_kwargs: Any,
    ) -> Callable:
        """
        엔드포인트 등록 데코레이터

        Args:
            model:  Fetcher 모델 이름 (예: "IncomeStatement")
                    path가 없으면 이 값을 kebab-case로 변환해 경로로 사용
            path:   명시적 경로 (없으면 model → kebab-case 자동 변환)
            **endpoint_kwargs: FastAPI @router.get()에 전달할 추가 인자

        Example:
            @router.command(model="BalanceSheet")
            async def balance_sheet(...) -> OBBject: ...
            # → GET /equity/fundamental/balance-sheet
        """
        endpoint_path = path or f"/{_to_kebab_case(model)}"

        def decorator(func: Callable) -> Callable:
            @wraps(func)
            async def wrapper(*args: Any, **kwargs: Any) -> Any:
                # ContextVar에 모델 이름 주입 → Query(**locals())가 읽어감
                token = _command_model.set(model)
                try:
                    return await func(*args, **kwargs)
                finally:
                    _command_model.reset(token)

            # FastAPI에 GET 엔드포인트로 등록
            self._router.get(
                endpoint_path,
                response_model=None,  # OBBject는 Pydantic 모델이므로 자동 처리
                **endpoint_kwargs,
            )(wrapper)

            return func  # 원본 함수 반환 (타입 힌트 보존)

        return decorator

    # ── APIRouter 메서드 위임 ──────────────────────────────────────────────
    def include_router(self, *args: Any, **kwargs: Any) -> None:
        self._router.include_router(*args, **kwargs)

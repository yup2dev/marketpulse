"""
CommandRouter — 표준 모델에서 라우트를 만든다.

세 가지로 쓸 수 있다:

    router = CommandRouter(prefix="/equity/fundamental")

    # 1. 등록 목록 — 함수 없이. 파라미터 · provider 선택지는 모델에서 만든다
    router.add_commands([
        Command("/income-statement", "income_statement", provider="fmp"),
        Command("/quote",            "quote"),
    ])

    # 2. **params 만 받는 함수 — 시그니처는 모델에서 만들고, 본문에서 가공할 수 있다
    @router.command(model="consumer_price_index")
    async def cpi(**params) -> OBBject:
        return await OBBject.from_query(Query(**params))

    # 3. 파라미터를 직접 적은 함수 — 적은 그대로 (모델 검사 없음)
    @router.command(model="IncomeStatement")
    async def income_statement(symbol: str, provider: str = "fmp") -> OBBject:
        return await OBBject.from_query(Query(**locals()))

1 · 2 는 앱이 뜰 때 모델을 확인한다 — 없는 모델이면 import 에서 실패한다.
경로를 안 적으면 모델 이름에서 만든다 ("income_statement" → "/income-statement").
만든 라우트에는 openapi_extra["model"] 이 붙는다 — 등록 목록 조회(/api/v1/coverage)가 이걸 읽는다.
"""
from __future__ import annotations

import enum
import inspect
import keyword
import re
from functools import wraps
from typing import Any, Callable, Iterable, List, Literal, NamedTuple, Optional

from fastapi import APIRouter, Query as QueryParam

from data_fetcher.core.interface import ModelSpec, model_key, model_spec
from data_fetcher.core.obbject import OBBject
from data_fetcher.core.query import Query, _command_model


class Command(NamedTuple):
    """등록 목록의 한 줄. path 가 None 이면 모델 이름에서 만든다."""
    path: Optional[str]
    model: str
    provider: Optional[str] = None   # 기본 provider — 없으면 등록 순서 첫 번째


def _to_kebab_case(name: str) -> str:
    """"BalanceSheet" · "balance_sheet" → "balance-sheet"."""
    return model_key(name).replace("_", "-")


def _py_name(name: str) -> str:
    """쿼리 이름 → 파이썬 인자 이름 (예약어 · 특수문자 피하기). 쿼리 이름은 alias 로 유지."""
    py = re.sub(r"\W", "_", name)
    return f"{py}_" if keyword.iskeyword(py) or not py.isidentifier() else py


def _signature(spec: ModelSpec, provider: str) -> tuple[inspect.Signature, dict]:
    """모델의 FastAPI 시그니처와 {파이썬 인자 이름: 쿼리 이름}."""
    names = {}
    params = [inspect.Parameter(
        "provider", inspect.Parameter.KEYWORD_ONLY,
        annotation=Literal[spec.providers],
        default=QueryParam(provider, description="데이터 출처"),
    )]
    for s in spec.params:
        py = _py_name(s.name)
        names[py] = s.name
        alias = s.name if py != s.name else None
        if s.required:
            ann, default = s.annotation, QueryParam(..., alias=alias, description=s.description)
        else:
            ann, default = Optional[s.annotation], QueryParam(None, alias=alias, description=s.description)
        params.append(inspect.Parameter(py, inspect.Parameter.KEYWORD_ONLY, annotation=ann, default=default))
    return inspect.Signature(params, return_annotation=OBBject), names


def _values(kwargs: dict, names: dict) -> dict:
    """받은 쿼리 값 → fetcher 파라미터. 안 보낸 값(None)은 빼서 fetcher 기본값을 따르게 한다."""
    out = {}
    for py, v in kwargs.items():
        if v is None:
            continue
        out[names.get(py, py)] = v.value if isinstance(v, enum.Enum) else v
    return out


def _resolve(model: str, provider: Optional[str]) -> tuple[ModelSpec, str]:
    spec = model_spec(model)
    provider = provider or spec.providers[0]
    if provider not in spec.providers:
        raise ValueError(f"'{provider}' 는 {spec.model} 을 주지 않는다 (가능: {', '.join(spec.providers)})")
    return spec, provider


class CommandRouter:
    """
    표준 모델에서 GET 엔드포인트를 만드는 FastAPI 라우터 래퍼.

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

    @property
    def router(self) -> APIRouter:
        return self._router

    def _add(self, path: str, endpoint: Callable, model: str, **endpoint_kwargs: Any) -> None:
        extra = {**endpoint_kwargs.pop("openapi_extra", {}), "model": model}
        self._router.add_api_route(
            path, endpoint, methods=["GET"], response_model=None,
            openapi_extra=extra, **endpoint_kwargs,
        )

    def add_command(
            self,
            model: str,
            path: Optional[str] = None,
            *,
            provider: Optional[str] = None,
            **endpoint_kwargs: Any,
    ) -> None:
        """함수 없이 모델 하나를 엔드포인트로 — 본문은 OBBject.from_query(Query(...))."""
        spec, default_provider = _resolve(model, provider)
        sig, names = _signature(spec, default_provider)

        async def endpoint(**kwargs: Any) -> OBBject:
            p = kwargs.pop("provider")
            return await OBBject.from_query(Query(_model=spec.model, provider=p, **_values(kwargs, names)))

        endpoint.__signature__ = sig
        endpoint.__name__ = spec.model
        endpoint.__doc__ = f"provider: {', '.join(spec.providers)}"
        self._add(path or f"/{_to_kebab_case(spec.model)}", endpoint, spec.model, **endpoint_kwargs)

    def add_commands(self, commands: Iterable[Command]) -> None:
        for c in commands:
            self.add_command(c.model, c.path, provider=c.provider)

    def command(
            self,
            model: str,
            path: Optional[str] = None,
            *,
            provider: Optional[str] = None,
            **endpoint_kwargs: Any,
    ) -> Callable:
        """
        엔드포인트 등록 데코레이터.

        함수가 **params 만 받으면 시그니처를 모델에서 만든다 (params 에 provider 포함).
        파라미터를 직접 적은 함수는 적은 그대로 등록한다.
        """
        def decorator(func: Callable) -> Callable:
            kinds = {p.kind for p in inspect.signature(func).parameters.values()}
            if kinds == {inspect.Parameter.VAR_KEYWORD}:
                spec, default_provider = _resolve(model, provider)
                sig, names = _signature(spec, default_provider)
                key = spec.model

                @wraps(func)
                async def endpoint(**kwargs: Any) -> Any:
                    p = kwargs.pop("provider")
                    token = _command_model.set(key)
                    try:
                        return await func(provider=p, **_values(kwargs, names))
                    finally:
                        _command_model.reset(token)

                endpoint.__signature__ = sig
                del endpoint.__wrapped__   # FastAPI 가 원래 함수(**params)의 시그니처를 읽지 않게
            else:
                key = model

                @wraps(func)
                async def endpoint(*args: Any, **kwargs: Any) -> Any:
                    # ContextVar에 모델 이름 주입 → Query(**locals())가 읽어감
                    token = _command_model.set(model)
                    try:
                        return await func(*args, **kwargs)
                    finally:
                        _command_model.reset(token)

            self._add(path or f"/{_to_kebab_case(model)}", endpoint, key, **dict(endpoint_kwargs))
            return func  # 원본 함수 반환 (타입 힌트 보존)

        return decorator

    # ── APIRouter 메서드 위임 ──────────────────────────────────────────────
    def include_router(self, *args: Any, **kwargs: Any) -> None:
        self._router.include_router(*args, **kwargs)

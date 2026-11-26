"""Router — @router.command 로 command 를 등록한다 (OpenBB openbb_core.app.router).

세 가지 command:

  1. 조회 — model=  (OpenBB 와 같다. 본문은 한 줄)
        @router.command(model="yield_curve", defaults={"provider": "fred"})
        async def yield_curve(cc, provider_choices, standard_params, extra_params) -> OBBject:
            return await OBBject.from_query(Query(**locals()))
     SignatureInspector 가 ProviderInterface 로 provider 선택지 · 표준 파라미터 · provider 별 추가 파라미터를
     엔드포인트 시그니처에 채운다. 날짜 범위를 받는 모델에는 period(1y · 5y …)도 연다.

  2. 가공 — inputs=  (조회 → 순수 함수)
        @router.command(path="/regime/current", inputs=lambda: {"gdp": Fetch(...), ...})
        def regime_current(data) -> ...:
            return regime.compute_regime(data["gdp"], ...)
     요청 파라미터는 inputs 함수와 command 함수의 인자를 합친 것(data 제외). 조회는 CommandRunner 가 한다.

  3. 그 밖 — model · inputs 없이 함수가 결과를 바로 낸다 (정적 목록 등).

API 계층(웹 서버)은 api_router(wrap=...) 로 엔드포인트를 감싸 오류 응답을 한 곳에서 맞춘다
(OpenBB api/router/commands.py 의 build_api_wrapper 자리).
"""
from __future__ import annotations

import inspect
from dataclasses import dataclass, field
from datetime import date as date_type
from types import SimpleNamespace
from typing import Any, Callable, Dict, List, Literal, Mapping, Optional, Union, get_args, get_origin

from fastapi import APIRouter

from app.backend.core.command.command_runner import CommandRunner, Fetch
from app.backend.core.command.query import _command_model

_OPENBB_ARGS = ("cc", "provider_choices", "standard_params", "extra_params")
_SCALARS = (str, int, float, bool, date_type)


def _query_annotation(ann: Any) -> Any:
    """쿼리 문자열로 받을 수 있는 타입만 그대로 — 아니면 str (dict · 모델 칸이 요청 본문으로 바뀌지 않게)."""
    origin = get_origin(ann)
    if ann in _SCALARS or ann is Any:
        return ann
    if origin is Literal:
        return ann
    if origin is Union:
        inner = [a for a in get_args(ann) if a is not type(None)]
        if len(inner) == 1:
            return Optional[_query_annotation(inner[0])]
        if all(a in _SCALARS for a in inner):
            return ann
        return Optional[str]
    if origin in (list, List) and all(a in _SCALARS for a in get_args(ann)):
        return ann
    if inspect.isclass(ann) and issubclass(ann, date_type):
        return ann
    return Optional[str]


def _param(name: str, annotation: Any, default: Any) -> inspect.Parameter:
    return inspect.Parameter(name, inspect.Parameter.KEYWORD_ONLY, default=default, annotation=annotation)


@dataclass
class CommandSpec:
    path: str
    endpoint: Callable
    methods: List[str]
    openapi_extra: Dict[str, Any] = field(default_factory=dict)
    kwargs: Dict[str, Any] = field(default_factory=dict)


class SignatureInspector:
    """command 함수 → FastAPI 가 읽을 엔드포인트 시그니처 + 실제 호출."""

    @staticmethod
    def is_openbb_style(func: Callable) -> bool:
        return "standard_params" in inspect.signature(func).parameters

    @staticmethod
    def model_signature(model: str, defaults: Mapping[str, Any]) -> tuple:
        """(파라미터 목록, 표준 칸 이름, 추가 칸 이름) — ProviderInterface 에서."""
        from app.backend.core.command.provider_interface import ProviderInterface

        mp = ProviderInterface.params(model)
        params = [_param("provider", Literal[tuple(mp.providers)], defaults.get("provider", mp.providers[0]))]
        standard, extra = [], []
        for name, f in mp.standard.items():
            default = defaults.get(name, inspect.Parameter.empty if f.is_required() else f.get_default(call_default_factory=True))
            params.append(_param(name, _query_annotation(f.annotation), default))
            standard.append(name)
        for name, (f, owners) in mp.extra.items():
            params.append(_param(name, _query_annotation(Optional[f.annotation]), defaults.get(name)))
            extra.append(name)
        if ("start_date" in standard or "start_date" in extra) and "period" not in standard + extra:
            params.append(_param("period", Optional[str], defaults.get("period")))
            extra.append("period")
        # 필수 칸이 앞에 오도록 (KEYWORD_ONLY 라 순서 제약은 없지만 문서가 읽기 쉽다)
        params.sort(key=lambda p: p.default is not inspect.Parameter.empty)
        return params, standard, extra

    @staticmethod
    def merged_signature(*funcs: Callable, skip: tuple = ("data",)) -> List[inspect.Parameter]:
        """여러 함수의 인자를 합친다 (같은 이름은 먼저 나온 것)."""
        seen: Dict[str, inspect.Parameter] = {}
        for fn in funcs:
            for p in inspect.signature(fn).parameters.values():
                if p.name in skip or p.kind in (p.VAR_KEYWORD, p.VAR_POSITIONAL) or p.name in seen:
                    continue
                seen[p.name] = p.replace(kind=inspect.Parameter.KEYWORD_ONLY)
        return list(seen.values())


class Router:
    """@router.command 를 모아 두었다가 FastAPI APIRouter 로 만든다."""

    def __init__(self, prefix: str = "", tags: Optional[List[str]] = None, description: str = "") -> None:
        self.prefix = prefix
        self.tags = tags or []
        self.description = description
        self._commands: List[CommandSpec] = []

    # ── 등록 ──────────────────────────────────────────────────────────────────

    def command(
        self,
        func: Optional[Callable] = None,
        *,
        model: Optional[str] = None,
        inputs: Optional[Callable[..., Mapping[str, Fetch]]] = None,
        path: Optional[str] = None,
        methods: Optional[List[str]] = None,
        defaults: Optional[Mapping[str, Any]] = None,
        widget_config: Optional[Mapping[str, Any]] = None,
        **kwargs: Any,
    ) -> Callable:
        if func is None:
            return lambda f: self.command(f, model=model, inputs=inputs, path=path, methods=methods,
                                          defaults=defaults, widget_config=widget_config, **kwargs)
        defaults = dict(defaults or {})
        extra: Dict[str, Any] = {}
        if model:
            extra["model"] = model
        if widget_config:
            extra["widget_config"] = dict(widget_config)

        if model and SignatureInspector.is_openbb_style(func):
            endpoint = self._model_endpoint(func, model, defaults)
            default_path = f"/{func.__name__}"
        elif model:
            raise TypeError(f"command '{func.__name__}': model= 을 주면 OpenBB 꼴 인자"
                            f"({', '.join(_OPENBB_ARGS)})를 받아야 한다")
        else:
            endpoint = self._run_endpoint(func, inputs, defaults)
            default_path = f"/{func.__name__}"

        self._commands.append(CommandSpec(
            path=path if path is not None else default_path, endpoint=endpoint, methods=list(methods or ["GET"]),
            openapi_extra=extra, kwargs=kwargs,
        ))
        return func

    @staticmethod
    def _model_endpoint(func: Callable, model: str, defaults: Mapping[str, Any]) -> Callable:
        params, standard, extra = SignatureInspector.model_signature(model, defaults)
        wanted = set(inspect.signature(func).parameters)

        async def endpoint(**kw: Any):
            args = {
                "cc": None,
                "provider_choices": SimpleNamespace(provider=kw.pop("provider", None)),
                "standard_params": {k: kw.get(k) for k in standard},
                "extra_params": {k: kw.get(k) for k in extra},
            }
            token = _command_model.set(model)
            try:
                return await CommandRunner.run(func, {k: v for k, v in args.items() if k in wanted})
            finally:
                _command_model.reset(token)

        endpoint.__name__ = func.__name__
        endpoint.__doc__ = func.__doc__
        endpoint.__signature__ = inspect.Signature(params)
        return endpoint

    @staticmethod
    def _run_endpoint(func: Callable, inputs: Optional[Callable], defaults: Mapping[str, Any]) -> Callable:
        sources = (inputs, func) if inputs else (func,)
        params = [p.replace(default=defaults[p.name]) if p.name in defaults else p
                  for p in SignatureInspector.merged_signature(*sources)]

        async def endpoint(**kw: Any):
            return await CommandRunner.run(func, kw, inputs)

        # 일반 command 는 함수의 반환 타입(예: OBBject[List[Row]])을 그대로 — 응답 스키마 · 검증에 쓰인다.
        # 가공 command 의 함수는 행을 돌려주고 러너가 OBBject 로 감싸므로 반환 타입을 넘기지 않는다
        ret = inspect.signature(func).return_annotation if inputs is None else inspect.Signature.empty
        endpoint.__name__ = func.__name__
        endpoint.__doc__ = func.__doc__
        endpoint.__signature__ = inspect.Signature(params, return_annotation=ret)
        return endpoint

    def include_router(self, router: "Router", prefix: str = "") -> None:
        for c in router._commands:
            self._commands.append(CommandSpec(path=prefix + router.prefix + c.path, endpoint=c.endpoint,
                                              methods=c.methods, openapi_extra=c.openapi_extra, kwargs=c.kwargs))

    # ── FastAPI ───────────────────────────────────────────────────────────────

    def api_router(self, wrap: Optional[Callable[[Callable], Callable]] = None) -> APIRouter:
        """등록된 command → APIRouter. wrap 은 엔드포인트마다 씌울 API 래퍼 (오류 응답 등)."""
        api = APIRouter(prefix=self.prefix, tags=self.tags)
        for c in self._commands:
            endpoint = wrap(c.endpoint) if wrap else c.endpoint
            if wrap and hasattr(c.endpoint, "__signature__"):
                endpoint.__signature__ = c.endpoint.__signature__
            # response_model · status_code · summary 같은 FastAPI 옵션은 command 에 적은 그대로.
            # response_model 을 적지 않으면 엔드포인트 반환 타입에서 (없으면 검증 없음)
            api.add_api_route(c.path, endpoint, methods=c.methods,
                              **{"openapi_extra": c.openapi_extra or None, **c.kwargs})
        return api

    @property
    def router(self) -> APIRouter:
        return self.api_router()

    @property
    def commands(self) -> List[CommandSpec]:
        return list(self._commands)


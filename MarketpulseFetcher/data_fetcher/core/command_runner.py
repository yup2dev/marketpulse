"""CommandRunner — command 실행 한 곳 (OpenBB openbb_core.app.command_runner).

조회 command 는 함수가 Query 를 실행하고, 가공 command 는 여기서 inputs(받을 모델들)를 먼저 병렬로 조회한 뒤
순수 함수(rows → 결과)에 넘긴다. 결과는 OBBject 하나로 맞춘다.

    inputs = {"cpi": Fetch("fred", "series", {"series_id": "CPIAUCSL", "units": "pc1"}, required=True), ...}

  - 입력 하나가 실패하면 그 키는 빈 목록 + 경고 (스냅샷은 있는 칸만 그린다)
  - required 입력이 실패하거나 전부 실패하면 첫 오류를 그대로 올린다 — 키 미등록(424) · Fetcher 미접속(503) 안내가 화면까지 가게
"""
from __future__ import annotations

import asyncio
import inspect
import logging
from dataclasses import dataclass, field
from typing import Any, Callable, Dict, List, Mapping, Optional

from data_fetcher.core.obbject import OBBject
from data_fetcher.core.query import Query
from data_fetcher.core.warnings import WarningsCollector, add_warning

log = logging.getLogger(__name__)

Rows = List[Dict[str, Any]]


@dataclass(frozen=True)
class Fetch:
    """가공 command 의 입력 하나 — provider · model · 파라미터."""

    provider: str
    model: str
    params: Mapping[str, Any] = field(default_factory=dict)
    required: bool = False

    def query(self) -> Query:
        return Query(_model=self.model, provider=self.provider, **dict(self.params))


def _rows(raw: Any) -> Rows:
    items = OBBject.unwrap(raw)
    items = items if isinstance(items, list) else ([items] if items is not None else [])
    return [r.model_dump() if hasattr(r, "model_dump") else dict(r) for r in items]


async def fetch_inputs(specs: Mapping[str, Fetch]) -> Dict[str, Rows]:
    """{키: Fetch} → {키: 행 목록}. 병렬로 받는다."""
    keys = list(specs)
    found = await asyncio.gather(*[specs[k].query().execute() for k in keys], return_exceptions=True)
    errors = [r for r in found if isinstance(r, BaseException)]
    if errors and len(errors) == len(found):
        raise errors[0]
    out: Dict[str, Rows] = {}
    for key, raw in zip(keys, found):
        if isinstance(raw, BaseException):
            if specs[key].required:
                raise raw
            log.warning("[inputs] %s (%s/%s) 실패: %s", key, specs[key].provider, specs[key].model, raw)
            add_warning(f"{key}: {raw}")
            raw = []
        out[key] = _rows(raw)
    return out


def to_obbject(result: Any, provider: Optional[str]) -> OBBject:
    """가공 결과 → OBBject. (행, 메타데이터) 튜플이면 메타데이터를 붙인다."""
    if isinstance(result, OBBject):
        return result
    meta: Dict[str, Any] = {}
    if isinstance(result, tuple) and len(result) == 2 and isinstance(result[1], dict):
        result, meta = result
    return OBBject.from_result(result, provider, metadata=meta)


def _split(func: Callable, params: Dict[str, Any]) -> Dict[str, Any]:
    sig = inspect.signature(func)
    if any(p.kind == p.VAR_KEYWORD for p in sig.parameters.values()):
        return dict(params)
    return {k: v for k, v in params.items() if k in sig.parameters}


class CommandRunner:
    """command 실행 — 조회는 함수가 그대로, 가공은 inputs 조회 → 순수 함수."""

    @staticmethod
    async def call(func: Callable, **params: Any) -> Any:
        """async 함수는 그대로, 동기 함수는 스레드풀에서 — 무거운 계산(백테스트 등)이 이벤트 루프를 막지 않게."""
        if inspect.iscoroutinefunction(func):
            return await func(**params)
        from starlette.concurrency import run_in_threadpool
        result = await run_in_threadpool(lambda: func(**params))
        return await result if inspect.isawaitable(result) else result

    @staticmethod
    async def run(func: Callable, params: Dict[str, Any],
                  inputs: Optional[Callable[..., Mapping[str, Fetch]]] = None) -> Any:
        """inputs 가 있으면 조회 → 순수 함수 → OBBject. 없으면 함수 결과를 그대로 (OBBject · 응답 객체 · dict …)."""
        with WarningsCollector() as collected:
            if inputs is None:
                result = await CommandRunner.call(func, **params)
                if not isinstance(result, OBBject):
                    return result
                obb = result
            else:
                specs = inputs(**_split(inputs, params))
                data = await fetch_inputs(specs)
                result = await CommandRunner.call(func, data=data, **_split(func, params))
                obb = to_obbject(result, ",".join(dict.fromkeys(s.provider for s in specs.values())) or None)
        if collected.warnings:
            obb.warnings = list(dict.fromkeys([*(obb.warnings or []), *collected.warnings]))
        return obb


__all__ = ["CommandRunner", "Fetch", "fetch_inputs", "to_obbject", "Rows"]

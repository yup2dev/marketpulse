"""OpenBB 식 command 계층 (app.backend.platform) — ProviderInterface · Query · Router · CommandRunner (#114).

  - 조회 command : @router.command(model=...) — 시그니처를 ProviderInterface 가 채우고 본문은 Query 한 줄
  - 가공 command : @router.command(inputs=...) — 러너가 inputs 를 조회해 순수 함수에 넘긴다
"""
import asyncio
from datetime import date
from typing import Optional

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

import data_fetcher.providers_init  # noqa: F401
from app.backend.platform import Fetch, OBBject, ProviderInterface, Query, Router, add_warning
from app.backend.platform.command_runner import fetch_inputs
from app.backend.core.execution import MissingCredentialsError, ServerExecutor


@pytest.fixture
def calls(monkeypatch):
    box = {"calls": [], "handler": lambda p, m, params: [{"date": "2026-09-01", "value": 1.0}]}

    async def fetch(provider, model, params, *a, **k):
        box["calls"].append((provider, model, dict(params)))
        out = box["handler"](provider, model, params)
        if isinstance(out, BaseException):
            raise out
        return out

    monkeypatch.setattr(ServerExecutor, "fetch", fetch)
    return box


def _client(router: Router) -> TestClient:
    from app.backend.api.command_map import build_api_wrapper
    app = FastAPI()
    app.include_router(router.api_router(wrap=build_api_wrapper), prefix="/t")
    return TestClient(app)


# ── ProviderInterface ─────────────────────────────────────────────────────────

def test_provider_interface_splits_standard_and_extra():
    mp = ProviderInterface.params("series")
    assert "fred" in mp.providers and len(mp.providers) > 1
    assert {"series_id", "start_date", "end_date"} <= set(mp.standard) | set(mp.extra)
    with pytest.raises(KeyError):
        ProviderInterface.params("no_such_model")


# ── Query ─────────────────────────────────────────────────────────────────────

def test_query_openbb_form_and_period(calls):
    q = Query(_model="series", provider_choices={"provider": "fred"},
              standard_params={"series_id": "DGS10", "start_date": None}, extra_params={"period": "1y"})
    asyncio.run(q.execute())
    (provider, model, params), = calls["calls"]
    assert (provider, model) == ("fred", "series")
    assert params["series_id"] == "DGS10" and "period" not in params
    assert isinstance(params["start_date"], date) and params["end_date"] >= params["start_date"]


def test_query_flat_form_still_works(calls):
    asyncio.run(Query(_model="series", provider="fred", series_id="X").execute())
    assert calls["calls"][0][2] == {"series_id": "X"}


# ── 조회 command ──────────────────────────────────────────────────────────────

def test_model_command_signature_and_call(calls):
    router = Router()

    @router.command(model="series", path="/s", defaults={"provider": "fred", "period": "5y"})
    async def series(cc, provider_choices, standard_params, extra_params) -> OBBject:
        return await OBBject.from_query(Query(**locals()))

    spec, = router.commands
    assert spec.openapi_extra["model"] == "series"
    client = _client(router)
    body = client.get("/t/s", params={"series_id": "DGS10"}).json()
    assert body["provider"] == "fred" and body["results"] == [{"date": "2026-09-01", "value": 1.0}]
    params = calls["calls"][0][2]
    assert params["series_id"] == "DGS10" and "start_date" in params      # 기본 period 5y → 날짜

    assert client.get("/t/s", params={"series_id": "X", "provider": "nope"}).status_code == 422
    # series_id 는 fred 전용(extra) 칸이라 API 에서는 선택 — 필수 검사는 fetcher 가 한다 (OpenBB 와 같다)


def test_model_command_missing_key_is_424(calls):
    router = Router()

    @router.command(model="series", path="/s", defaults={"provider": "fred"})
    async def series(cc, provider_choices, standard_params, extra_params) -> OBBject:
        return await OBBject.from_query(Query(**locals()))

    calls["handler"] = lambda p, m, params: MissingCredentialsError("fred")
    r = _client(router).get("/t/s", params={"series_id": "X"})
    assert r.status_code == 424 and r.json()["code"] == "missing_key"


# ── 가공 command ──────────────────────────────────────────────────────────────

def test_inputs_command_fetches_then_calls_pure_function(calls):
    router = Router()

    def inputs(date: Optional[date] = None, n: int = 2):
        return {"a": Fetch("fred", "series", {"series_id": "A", "end_date": date, "limit": n}),
                "b": Fetch("fred", "series", {"series_id": "B"})}

    seen = {}

    @router.command(path="/x", inputs=inputs)
    def summarize(data, n: int = 2, label: str = "x"):
        seen.update(data=data, n=n, label=label)
        return [{"keys": sorted(data), "label": label}], {"n": n}

    body = _client(router).get("/t/x", params={"date": "2026-01-31", "n": 3, "label": "hi"}).json()
    assert body["results"] == [{"keys": ["a", "b"], "label": "hi"}] and body["metadata"]["n"] == 3
    assert {"cached", "duration_ms", "row_count", "executed_at"} <= set(body["metadata"])   # 실행 정보
    assert body["provider"] == "fred"
    a = next(p for _, _, p in calls["calls"] if p["series_id"] == "A")
    assert a["end_date"] == date(2026, 1, 31) and a["limit"] == 3
    assert seen["n"] == 3 and seen["data"]["a"] == [{"date": "2026-09-01", "value": 1.0}]


def test_fetch_inputs_partial_required_and_all_failed(calls):
    calls["handler"] = lambda p, m, params: RuntimeError("down") if params["series_id"] == "B" else [{"v": 1}]
    out = asyncio.run(fetch_inputs({"a": Fetch("fred", "series", {"series_id": "A"}),
                                    "b": Fetch("fred", "series", {"series_id": "B"})}))
    assert out == {"a": [{"v": 1}], "b": []}                               # 빠진 입력은 빈 목록

    with pytest.raises(RuntimeError):                                      # required 가 실패하면 오류
        asyncio.run(fetch_inputs({"a": Fetch("fred", "series", {"series_id": "A"}),
                                  "b": Fetch("fred", "series", {"series_id": "B"}, required=True)}))

    calls["handler"] = lambda p, m, params: MissingCredentialsError("fred")
    with pytest.raises(MissingCredentialsError):                           # 전부 실패 → 첫 오류 (424 안내)
        asyncio.run(fetch_inputs({"a": Fetch("fred", "series", {"series_id": "A"})}))


def test_warnings_reach_the_response(calls):
    router = Router()

    @router.command(path="/w")
    def warn():                                   # 일반 command — 결과를 그대로 (OBBject 면 경고가 붙는다)
        add_warning("careful")
        return OBBject(results=[{"ok": True}])

    assert _client(router).get("/t/w").json()["warnings"] == ["careful"]


def test_widget_config_goes_to_openapi(calls):
    router = Router()

    @router.command(path="/w", widget_config={"view_type": "table"})
    def w():
        return []

    app = FastAPI()
    app.include_router(router.api_router(), prefix="/t")
    assert app.openapi()["paths"]["/t/w"]["get"]["widget_config"] == {"view_type": "table"}

"""라우트 생성기 — 표준 모델에서 파라미터 · provider 선택지를 만드는지 (data_fetcher/core/router.py).

실제 ProviderRegistry 를 쓰고, QueryExecutor.fetch 만 가짜로 바꿔 네트워크를 타지 않는다.
"""
import datetime as dt
from typing import Literal, Optional, Union

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from data_fetcher.core import Command, CommandRouter, OBBject, Query
from data_fetcher.core.interface import _query_type, model_key, model_spec, models
from data_fetcher.core.router import _py_name
from data_fetcher.query_executor import QueryExecutor


@pytest.fixture
def calls(monkeypatch):
    seen = []

    async def fake_fetch(provider, model, params):
        seen.append((provider, model, params))
        return []

    monkeypatch.setattr(QueryExecutor, "fetch", staticmethod(fake_fetch))
    return seen


def _client(router: CommandRouter) -> TestClient:
    app = FastAPI()
    app.include_router(router.router)
    return TestClient(app)


def _params(client: TestClient, path: str) -> dict:
    op = client.app.openapi()["paths"][path]["get"]
    return {p["name"]: p for p in op["parameters"]}


# ── 모델 지도 ─────────────────────────────────────────────────────────────────

def test_model_key_accepts_any_spelling():
    assert model_key("IncomeStatement") == "income_statement"
    assert model_key("income-statement") == "income_statement"
    assert model_key("income_statement") == "income_statement"


def test_model_spec_splits_standard_and_extra_params():
    spec = model_spec("income_statement")
    assert set(spec.providers) == set(models()["income_statement"])
    by_name = {p.name: p for p in spec.params}
    assert by_name["symbol"].required and by_name["symbol"].providers == ()
    extras = [p for p in spec.params if p.providers]
    assert extras, "sec 전용 파라미터가 있어야 한다"
    for p in extras:
        assert not p.required
        assert f"(provider: {', '.join(p.providers)})" in p.description


def test_every_registered_model_can_become_a_route():
    """새 fetcher 의 QueryParams 가 라우트로 못 바뀌는 모양이면 여기서 걸린다."""
    r = CommandRouter()
    for m in models():
        r.add_command(m)
    app = FastAPI()
    app.include_router(r.router)
    assert len(app.openapi()["paths"]) == len(models())


def test_model_key_with_capitals_is_used_as_is():
    caps = [m for m in models() if m != m.lower()]
    for m in caps:
        assert model_spec(m).model == m


def test_unknown_model_is_an_error():
    with pytest.raises(KeyError):
        model_spec("no_such_model")


@pytest.mark.parametrize("ann, expected", [
    (int, int),
    (Optional[bool], bool),
    (Literal["a", "b"], Literal["a", "b"]),
    (dt.date, str),                 # 상대 날짜("-7d")를 받는 fetcher 가 있다
    (Union[int, str], str),
    (list[str], str),
])
def test_query_type(ann, expected):
    assert _query_type(ann) == expected


def test_py_name_avoids_keywords():
    assert _py_name("from") == "from_"
    assert _py_name("symbol") == "symbol"


# ── 등록 목록 (함수 없이) ─────────────────────────────────────────────────────

def test_add_commands_builds_route_from_model(calls):
    r = CommandRouter(prefix="/x")
    r.add_commands([Command("/is", "income_statement", provider="fmp")])
    c = _client(r)

    ps = _params(c, "/x/is")
    assert ps["provider"]["schema"]["enum"] == list(model_spec("income_statement").providers)
    assert ps["provider"]["schema"]["default"] == "fmp"
    assert ps["symbol"]["required"] is True

    res = c.get("/x/is", params={"symbol": "AAPL", "period": "quarterly"})
    assert res.status_code == 200
    # 안 보낸 값은 넘기지 않는다 — fetcher 기본값을 따르게
    assert calls[-1] == ("fmp", "income_statement", {"symbol": "AAPL", "period": "quarterly"})


def test_path_defaults_to_kebab_model_name():
    r = CommandRouter()
    r.add_command("analyst_estimates")
    assert [rt.path for rt in r.router.routes] == ["/analyst-estimates"]
    assert r.router.routes[0].openapi_extra["model"] == "analyst_estimates"


def test_rejects_unregistered_provider_and_missing_required(calls):
    r = CommandRouter()
    r.add_command("income_statement")
    c = _client(r)
    assert c.get("/income-statement", params={"symbol": "AAPL", "provider": "nope"}).status_code == 422
    assert c.get("/income-statement").status_code == 422
    assert calls == []


def test_registration_fails_fast():
    r = CommandRouter()
    with pytest.raises(KeyError):
        r.add_command("no_such_model")
    with pytest.raises(ValueError):
        r.add_command("income_statement", provider="yahoo")   # yahoo 는 안 준다


# ── 데코레이터 ────────────────────────────────────────────────────────────────

def test_command_on_var_kwargs_function_gets_model_signature(calls):
    r = CommandRouter()
    seen = {}

    @r.command(model="IncomeStatement", provider="fmp")
    async def income(**params) -> OBBject:
        seen.update(params)
        return await OBBject.from_query(Query(**params))

    c = _client(r)
    assert "symbol" in _params(c, "/income-statement")
    assert c.get("/income-statement", params={"symbol": "AAPL"}).status_code == 200
    assert seen == {"provider": "fmp", "symbol": "AAPL"}
    assert calls[-1] == ("fmp", "income_statement", {"symbol": "AAPL"})


def test_command_with_explicit_params_is_kept_as_written(calls):
    r = CommandRouter()

    @r.command(model="IncomeStatement")
    async def income(symbol: str, provider: str = "fmp", limit: int = 5) -> OBBject:
        return await OBBject.from_query(Query(**locals()))

    c = _client(r)
    assert set(_params(c, "/income-statement")) == {"symbol", "provider", "limit"}
    assert c.get("/income-statement", params={"symbol": "AAPL"}).status_code == 200
    assert calls[-1] == ("fmp", "IncomeStatement", {"symbol": "AAPL", "limit": 5})


# ── 앱에 붙은 등록 목록 ───────────────────────────────────────────────────────

def test_coverage_lists_generated_routes():
    from app.backend.api.routes.coverage import command_routes
    from app.backend.main import app

    rows = {r["path"]: r for r in command_routes(app.routes)}
    row = rows["/api/v1/equity/fundamental/income-statement"]
    assert row["model"] == "income_statement"
    assert row["providers"] == list(model_spec("income_statement").providers)
    assert any(p["providers"] for p in row["params"])

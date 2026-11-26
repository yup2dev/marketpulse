"""실행 위치 — (provider, model) 를 PC Fetcher 에서만(Y) 돌릴지 서버에서(N) 돌릴지는 DB 표가 정한다.

fetcher 패키지는 이걸 모른다: 순수 QueryExecutor 는 캐시 · 위임 · 사용자 키 · 서킷브레이커가 없고,
웹 서버의 core/execution(ServerExecutor)만 실행 위치 표(data_model_routes)를 읽는다.
"""
import ast
import asyncio
import uuid
from pathlib import Path

import pytest

import data_fetcher.providers_init  # noqa: F401 — provider 등록
from app.backend.core.auth.security import create_access_token
from app.backend.core.execution import (
    RemoteUnavailableError, ServerExecutor, current_user_id, routes,
)
from app.backend.models.orm import DataModelRoute, User
from data_fetcher.query_executor import QueryExecutor

ROOT = Path(__file__).resolve().parents[1]


class _Remote:
    def __init__(self, exc=None):
        self.calls, self.exc = [], exc

    async def fetch(self, provider, model, params, credentials=None, **kwargs):
        self.calls.append((provider, model, params))
        if self.exc:
            raise self.exc
        return [{"via": "remote"}]


@pytest.fixture
def executor(monkeypatch):
    """캐시 없음 · 위임 통로 · 실행 위치 표를 테스트마다 새로."""
    def make(remote=None, table=None, resolver=None):
        monkeypatch.setattr(ServerExecutor, "_cache", None)
        monkeypatch.setattr(ServerExecutor, "_remote", remote)
        monkeypatch.setattr(ServerExecutor, "_credential_resolver", staticmethod(resolver) if resolver else None)
        monkeypatch.setattr(routes, "_routes", dict(table or {}))
        monkeypatch.setattr(routes, "_provider_default", {})
        calls = []

        async def direct(self, provider_name, model_name, params, credentials=None, **kw):
            calls.append((provider_name, model_name, params, credentials))
            return [{"via": "server"}]

        monkeypatch.setattr(QueryExecutor, "execute", direct)
        return calls
    return make


@pytest.fixture
def as_user():
    token = current_user_id.set("user-1")
    yield "user-1"
    current_user_id.reset(token)


def _run(provider, model, params=None):
    return asyncio.run(ServerExecutor.fetch(provider, model, params or {}))


# ── 표 → 어디서 실행하나 ──────────────────────────────────────────────────────

def test_local_route_goes_to_users_fetcher_only(executor, as_user):
    remote = _Remote()
    direct = executor(remote, {("yahoo", "quote"): True})
    assert _run("yahoo", "quote", {"symbol": "AAPL"}) == [{"via": "remote"}]
    assert remote.calls == [("yahoo", "quote", {"symbol": "AAPL"})] and direct == []


def test_server_route_runs_in_process(executor, as_user):
    remote = _Remote()
    direct = executor(remote, {("yahoo", "quote"): False})        # DB 에서 N 으로 바꾸면 서버에서
    assert _run("yahoo", "quote") == [{"via": "server"}]
    assert remote.calls == [] and direct[0][:2] == ("yahoo", "quote")


def test_local_route_without_fetcher_is_503_not_server(executor, as_user):
    remote = _Remote(exc=RemoteUnavailableError("worker offline"))
    direct = executor(remote, {("yahoo", "quote"): True})
    with pytest.raises(RemoteUnavailableError):
        _run("yahoo", "quote")
    assert direct == []                                            # 서버로 넘기지 않는다


def test_local_route_without_login_is_503(executor):
    direct = executor(_Remote(), {("yahoo", "quote"): True})
    with pytest.raises(RemoteUnavailableError):
        _run("yahoo", "quote")
    assert direct == []


def test_no_transport_runs_everything_in_process(executor, as_user):
    direct = executor(None, {("yahoo", "quote"): True})            # FETCHER_REMOTE_ENABLED=False (개발 PC)
    assert _run("yahoo", "quote") == [{"via": "server"}] and direct


def test_server_route_uses_the_users_key(executor, as_user):
    direct = executor(_Remote(), {("fmp", "quote"): False}, resolver=lambda p, u: {"api_key": f"{u}-{p}"})
    _run("fmp", "quote")
    assert direct[0][3] == {"api_key": "user-1-fmp"}


def test_pascal_case_model_name_finds_the_row(executor, as_user):
    remote = _Remote()
    executor(remote, {("sec", "income_statement"): True})
    _run("sec", "IncomeStatement")
    assert remote.calls


def test_local_results_can_skip_the_server_cache(monkeypatch, executor, as_user):
    executor(_Remote(), {("yahoo", "quote"): True, ("fred", "series"): False})
    monkeypatch.setattr(ServerExecutor, "_cache_local_results", False)
    assert ServerExecutor._ttl("yahoo", "quote", None) == 0
    assert ServerExecutor._ttl("fred", "series", None) == ServerExecutor._ttl_map.get("series", 0)


def test_query_goes_through_the_server_executor(executor, as_user):
    from app.backend.core.command import Query
    from app.backend.core.command.provider_interface import ProviderInterface

    assert isinstance(ProviderInterface.create_executor(), ServerExecutor)
    remote = _Remote()
    executor(remote, {("yahoo", "quote"): True})
    asyncio.run(Query(_model="quote", provider="yahoo", symbol="AAPL").execute())
    assert remote.calls and remote.calls[0][:2] == ("yahoo", "quote")


# ── 표 채우기 · 바꾸기 ────────────────────────────────────────────────────────

def test_sync_routes_first_values_and_keeps_edits(db_session):
    pairs = [("yahoo", "quote"), ("fred", "series"), ("sec", "institutional_13f"), ("sec", "filings")]
    assert routes.sync_routes(db_session, pairs) == 4
    got = {(r.provider, r.model): r.local_yn for r in db_session.query(DataModelRoute)}
    assert got == {("yahoo", "quote"): "Y", ("fred", "series"): "N",
                   ("sec", "institutional_13f"): "Y", ("sec", "filings"): "N"}

    db_session.get(DataModelRoute, ("yahoo", "quote")).local_yn = "N"     # 관리자가 고친 값
    db_session.commit()
    routes.sync_routes(db_session, pairs + [("yahoo", "news"), ("fred", "gdp")])
    got = {(r.provider, r.model): r.local_yn for r in db_session.query(DataModelRoute)}
    assert got[("yahoo", "quote")] == "N"                                 # 덮어쓰지 않는다
    assert got[("yahoo", "news")] == "N"                                  # 같은 provider 가 섞였으면 N
    assert got[("fred", "gdp")] == "N"


def test_new_model_follows_provider_when_all_local(db_session):
    routes.sync_routes(db_session, [("yahoo", "quote"), ("yahoo", "stock_price")])
    routes.sync_routes(db_session, [("yahoo", "options")])
    assert db_session.get(DataModelRoute, ("yahoo", "options")).local_yn == "Y"


def test_admin_api_changes_route_immediately(db_session, monkeypatch):
    from fastapi.testclient import TestClient

    from app.backend.core.config import settings
    from app.backend.core.db import get_db
    from app.backend.main import app

    monkeypatch.setattr(settings, "DEBUG", False)
    monkeypatch.setattr(routes, "_routes", {})
    admin_id = str(uuid.uuid4())
    db_session.add(User(user_id=admin_id, email="a@example.com", username="a", hashed_password="x",
                        is_active=True, role="admin"))
    db_session.commit()
    app.dependency_overrides[get_db] = lambda: db_session
    try:
        c = TestClient(app, headers={"Authorization": f"Bearer {create_access_token({'sub': admin_id})}"})
        r = c.put("/api/admin/data-routes/fred/series", json={"local": True})
        assert r.status_code == 200 and r.json()["local_yn"] == "Y"
        assert routes.is_local("fred", "series") is True
        assert db_session.get(DataModelRoute, ("fred", "series")).updated_by == admin_id
        assert c.put("/api/admin/data-routes/fred/no_such_model", json={"local": True}).status_code == 404
        rows = c.get("/api/admin/data-routes?provider=fred").json()
        assert {"provider": "fred", "model": "series"}.items() <= rows[0].items()
    finally:
        app.dependency_overrides.clear()


# ── fetcher 패키지는 실행 위치를 모른다 ─────────────────────────────────────────

SERVER_CONCEPTS = ("current_user_id", "RemoteTransport", "server_mode", "_remote_only_providers",
                   "_local_only_models", "circuit_breaker", "RemoteUnavailableError", "MissingCredentialsError",
                   "credential_resolver")


def test_fetcher_package_has_no_server_concepts():
    pkg = ROOT / "MarketpulseFetcher" / "data_fetcher"
    hits = []
    for p in pkg.rglob("*.py"):
        if "tests" in p.parts or "__pycache__" in p.parts:
            continue
        text = p.read_text(encoding="utf-8")
        for name in SERVER_CONCEPTS:
            if name in text:
                hits.append(f"{p.relative_to(ROOT)} → {name}")
        for node in ast.walk(ast.parse(text)):
            if isinstance(node, ast.ImportFrom) and (node.module or "").startswith("app."):
                hits.append(f"{p.relative_to(ROOT)} → import {node.module}")
    assert not hits, "fetcher 패키지가 서버 실행 계층을 안다:\n" + "\n".join(hits)


def test_pure_executor_has_openbb_shape():
    ex = QueryExecutor()
    for name in ("get_provider", "get_fetcher", "filter_credentials", "execute"):
        assert callable(getattr(ex, name))
    for name in ("_cache", "_remote", "fetch", "fetch_sync", "configure"):
        assert not hasattr(QueryExecutor, name), name



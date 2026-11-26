"""실행 위치 — fetcher 의 target 이 정한다 (local = 사용자 PC Fetcher, server = 서버).
DB 표 data_model_routes 는 local fetcher 를 서버로 돌리는 긴급 전환만 담는다.

fetcher 는 target 을 선언만 한다: 순수 QueryExecutor 는 캐시 · 위임 · 사용자 키 · 서킷브레이커가 없고,
웹 서버의 core/execution(ServerExecutor)이 target 과 긴급 전환 표를 읽어 위임을 정한다.
PC Fetcher(runner)는 target="local" fetcher 만 실행한다.
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
from app.backend.core.execution import executor as executor_module
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
    """캐시 없음 · 위임 통로 · 긴급 전환 목록을 테스트마다 새로."""
    def make(remote=None, overrides=(), resolver=None):
        monkeypatch.setattr(ServerExecutor, "_cache", None)
        monkeypatch.setattr(ServerExecutor, "_remote", remote)
        monkeypatch.setattr(ServerExecutor, "_credential_resolver", staticmethod(resolver) if resolver else None)
        monkeypatch.setattr(routes, "_overrides", set(overrides))
        # 위임 경로만 본다 — 가짜 행({"via": ...})의 재검증은 tests/test_fetcher_wire.py 가 본다
        monkeypatch.setattr(executor_module, "revalidate", lambda provider, model, raw: raw)
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


# ── target → 어디서 실행하나 ─────────────────────────────────────────────────

def test_targets_come_from_fetchers():
    assert routes.target_of("yahoo", "quote") == "local"                 # YFinanceFetcher — 서버 IP 차단
    assert routes.target_of("sec", "institutional_13f") == "local"       # 13F 원본 파싱 — 서버 메모리
    assert routes.target_of("sec", "filings") == "server"
    assert routes.target_of("fred", "series") == "server"
    assert routes.target_of("yahoo", "no_such_model") is None
    db_targets = {f.target for f in __import__("data_fetcher.abstract_provider.abstract.provider", fromlist=["x"])
                  .ProviderRegistry.get("db").fetcher_dict.values()}
    assert db_targets == {"server"}                                       # DbFetcher 는 서버 고정


def test_local_target_goes_to_users_fetcher_only(executor, as_user):
    remote = _Remote()
    direct = executor(remote)
    assert _run("yahoo", "quote", {"symbol": "AAPL"}) == [{"via": "remote"}]
    assert remote.calls == [("yahoo", "quote", {"symbol": "AAPL"})] and direct == []


def test_emergency_override_runs_local_target_on_server(executor, as_user):
    remote = _Remote()
    direct = executor(remote, overrides={("yahoo", "quote")})            # 긴급 전환 — 서버에서
    assert _run("yahoo", "quote") == [{"via": "server"}]
    assert remote.calls == [] and direct[0][:2] == ("yahoo", "quote")


def test_server_target_runs_in_process(executor, as_user):
    remote = _Remote()
    direct = executor(remote)
    assert _run("fred", "series") == [{"via": "server"}]
    assert remote.calls == [] and direct


def test_local_target_without_fetcher_is_503_not_server(executor, as_user):
    remote = _Remote(exc=RemoteUnavailableError("worker offline"))
    direct = executor(remote)
    with pytest.raises(RemoteUnavailableError):
        _run("yahoo", "quote")
    assert direct == []                                            # 서버로 넘기지 않는다


def test_local_target_without_login_is_503(executor):
    direct = executor(_Remote())
    with pytest.raises(RemoteUnavailableError):
        _run("yahoo", "quote")
    assert direct == []


def test_no_transport_runs_everything_in_process(executor, as_user):
    direct = executor(None)                                        # FETCHER_REMOTE_ENABLED=False (개발 PC)
    assert _run("yahoo", "quote") == [{"via": "server"}] and direct


def test_server_route_uses_the_users_key(executor, as_user):
    direct = executor(_Remote(), resolver=lambda p, u: {"api_key": f"{u}-{p}"})
    _run("fmp", "quote")
    assert direct[0][3] == {"api_key": "user-1-fmp"}


def test_pascal_case_model_name_finds_the_fetcher(executor, as_user):
    remote = _Remote()
    executor(remote)
    _run("yahoo", "StockPrice")
    assert remote.calls


def test_local_results_can_skip_the_server_cache(monkeypatch, executor, as_user):
    executor(_Remote())
    monkeypatch.setattr(ServerExecutor, "_cache_local_results", False)
    assert ServerExecutor._ttl("yahoo", "quote", None) == 0
    assert ServerExecutor._ttl("fred", "series", None) == ServerExecutor._ttl_map.get("series", 0)


def test_query_goes_through_the_server_executor(executor, as_user):
    from app.backend.platform import Query
    from app.backend.platform.provider_interface import ProviderInterface

    assert isinstance(ProviderInterface.create_executor(), ServerExecutor)
    remote = _Remote()
    executor(remote)
    asyncio.run(Query(_model="quote", provider="yahoo", symbol="AAPL").execute())
    assert remote.calls and remote.calls[0][:2] == ("yahoo", "quote")


# ── 긴급 전환 표 ──────────────────────────────────────────────────────────────

def test_cleanup_drops_rows_equal_to_default_and_load_reads_overrides(db_session, monkeypatch):
    monkeypatch.setattr(routes, "_overrides", set())
    for provider, model, yn in [("yahoo", "quote", "Y"),          # local 기본값과 같다 → 지운다
                                ("yahoo", "stock_price", "N"),    # 긴급 전환 → 남긴다
                                ("fred", "series", "N"),          # server 기본값과 같다 → 지운다
                                ("sec", "filings", "Y"),          # server 를 로컬로 — 허용 안 됨, 무시(경고)하고 남긴다
                                ("gone", "model", "Y")]:          # 등록되지 않은 쌍 → 지운다
        db_session.add(DataModelRoute(provider=provider, model=model, local_yn=yn))
    db_session.commit()

    assert routes.cleanup(db_session) == 3
    left = {(r.provider, r.model): r.local_yn for r in db_session.query(DataModelRoute)}
    assert left == {("yahoo", "stock_price"): "N", ("sec", "filings"): "Y"}

    routes.load(db_session)
    assert routes.snapshot() == {("yahoo", "stock_price")}
    assert routes.is_local("yahoo", "stock_price") is False and routes.is_local("yahoo", "quote") is True
    assert routes.is_local("sec", "filings") is False                    # Y 행이 있어도 server 는 server


def test_admin_api_switches_and_rejects_server_to_local(db_session, monkeypatch):
    from fastapi.testclient import TestClient

    from app.backend.core.config import settings
    from app.backend.core.db import get_db
    from app.backend.main import app

    monkeypatch.setattr(settings, "DEBUG", False)
    monkeypatch.setattr(routes, "_overrides", set())
    admin_id = str(uuid.uuid4())
    db_session.add(User(user_id=admin_id, email="a@example.com", username="a", hashed_password="x",
                        is_active=True, role="admin"))
    db_session.commit()
    app.dependency_overrides[get_db] = lambda: db_session
    try:
        c = TestClient(app, headers={"Authorization": f"Bearer {create_access_token({'sub': admin_id})}"})
        r = c.put("/api/admin/data-routes/yahoo/quote", json={"local": False})          # 긴급 전환
        assert r.status_code == 200 and r.json() == {"provider": "yahoo", "model": "quote",
                                                     "target": "local", "local": False}
        assert routes.is_local("yahoo", "quote") is False
        assert db_session.get(DataModelRoute, ("yahoo", "quote")).updated_by == admin_id

        rows = {r["model"]: r for r in c.get("/api/admin/data-routes?provider=yahoo").json()}
        assert rows["quote"]["emergency_server"] is True and rows["stock_price"]["local"] is True

        assert c.put("/api/admin/data-routes/yahoo/quote", json={"local": True}).json()["local"] is True  # 해제
        assert db_session.get(DataModelRoute, ("yahoo", "quote")) is None

        assert c.put("/api/admin/data-routes/fred/series", json={"local": True}).status_code == 400  # server → local 거부
        assert c.put("/api/admin/data-routes/fred/no_such_model", json={"local": False}).status_code == 404
    finally:
        app.dependency_overrides.clear()


# ── target 선언 규칙 · PC Fetcher 실행 제한 ─────────────────────────────────────

def test_target_values_and_db_fetcher_is_server_only():
    from pydantic import BaseModel

    from data_fetcher.abstract_provider.abstract.base_fetchers import ApiFetcher, DbFetcher

    class _Q(BaseModel):
        pass

    with pytest.raises(ValueError):
        class BadTarget(ApiFetcher[_Q, dict]):      # noqa: F841 — 정의만으로 실패해야 한다
            target = "db"                           # db 는 실행 위치가 아니다

            @staticmethod
            def build_url(query, api_key):
                return ""

    with pytest.raises(TypeError):
        class LocalDb(DbFetcher[_Q, dict]):         # noqa: F841
            target = "local"                        # DbFetcher 는 서버 고정

            @staticmethod
            def extract_data(query, credentials=None, **kwargs):
                return []


def test_pc_fetcher_runs_only_local_targets():
    from data_fetcher.query_executor import QueryExecutorError
    from data_fetcher.server import runner

    pairs = runner.local_fetchers()
    assert ("yahoo", "quote") in pairs and ("sec", "institutional_13f") in pairs
    assert all(routes.target_of(p, m) == "local" for p, m in pairs)
    with pytest.raises(QueryExecutorError, match="target='server'"):
        asyncio.run(runner.run("fred", "series", {}))


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


def test_provider_layer_does_not_import_app_layer():
    """OpenBB 처럼 provider 계층(fetcher · 순수 실행기)은 app 계층(app.backend.platform)을 모른다 — 의존은 app → provider.
    data_fetcher.core 에 남은 것(model_schema · warnings)도 provider 계층은 쓰지 않는다."""
    pkg = ROOT / "MarketpulseFetcher" / "data_fetcher"
    layer = [pkg / "query_executor.py", *(pkg / "abstract_provider").rglob("*.py"),
             *(pkg / "providers").rglob("*.py"), *(pkg / "utils").rglob("*.py")]
    hits = []
    for p in layer:
        if "__pycache__" in p.parts:
            continue
        for node in ast.walk(ast.parse(p.read_text(encoding="utf-8"))):
            mods = ([a.name for a in node.names] if isinstance(node, ast.Import)
                    else [node.module or ""] if isinstance(node, ast.ImportFrom) else [])
            hits += [f"{p.relative_to(ROOT)} → {m}" for m in mods if m.startswith("data_fetcher.core")]
    assert not hits, "provider 계층이 app 계층을 import 한다:\n" + "\n".join(hits)

"""동기(`def`) 핸들러 전환 검증 — 인증된 실제 요청으로 확인한다.

배경: DB만 쓰는 핸들러 42개를 `async def` → `def` 로 바꿨다. FastAPI 는 `async def`
핸들러를 이벤트 루프에서 직접 실행하므로, 그 안의 동기 SQLAlchemy 쿼리가 도는 동안
**서버 전체가 멈춘다.** `def` 로 두면 FastAPI 가 스레드풀에서 돌려 루프를 막지 않는다.

전환에서 실제로 깨질 수 있는 지점은 딱 하나다 — **contextvar 전파**.
AuthGateMiddleware 가 `current_user_id` contextvar 를 설정하고, QueryExecutor 가
그 값으로 '이 사용자의 Fetcher 워커'에 위임한다. 스레드풀로 넘어가면서 값이 사라지면
데이터 조회가 조용히 user_id=None 으로 떨어진다. 그래서 여기서 명시적으로 검증한다.
"""
import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.backend.core.auth.security import create_access_token
from app.backend.core.config import settings
from app.backend.core.db import get_db
from app.backend.main import app
from index_analyzer.models.all_models import Base
from index_analyzer.models.orm import User


@pytest.fixture
def db_session(tmp_path):
    """테스트 전용 SQLite — 개발 DB(data/marketpulse.db)를 건드리지 않는다."""
    engine = create_engine(f"sqlite:///{tmp_path / 'test.db'}")
    Base.metadata.create_all(bind=engine)
    session = sessionmaker(bind=engine)()
    try:
        yield session
    finally:
        session.close()
        engine.dispose()


@pytest.fixture
def auth_client(db_session, monkeypatch):
    """로그인된 사용자로 요청하는 클라이언트."""
    monkeypatch.setattr(settings, "DEBUG", False)

    user_id = str(uuid.uuid4())
    db_session.add(User(
        user_id=user_id,
        email="tester@example.com",
        username="tester",
        hashed_password="x",   # 로그인 경로를 타지 않으므로 검증되지 않는다
        is_active=True,
        role="user",
    ))
    db_session.commit()

    app.dependency_overrides[get_db] = lambda: db_session
    token = create_access_token({"sub": user_id})
    client = TestClient(app, headers={"Authorization": f"Bearer {token}"})
    try:
        yield client, user_id
    finally:
        app.dependency_overrides.clear()


# ── 전환된 핸들러가 실제로 동작하는가 ─────────────────────────────────────────

def test_watchlist_endpoints_work(auth_client):
    """전환된 watchlist 핸들러(12개 중 대표) — 목록·생성·내 티커."""
    client, _ = auth_client

    assert client.get("/api/watchlist").status_code == 200
    assert client.get("/api/watchlist/my-tickers").status_code == 200

    r = client.post("/api/watchlist", json={"name": "테스트 관심종목"})
    assert r.status_code == 200, r.text


def test_backtest_items_crud_roundtrip(auth_client):
    """전환된 `def` 핸들러로 생성→조회→수정→삭제가 끝까지 동작해야 한다.

    응답은 OBBject 표준(`results` 배열) — 단건도 배열에 담겨 온다.
    """
    client, _ = auth_client

    r = client.post("/api/backtest/items", json={
        "kind": "variable", "name": "my_var", "spec": {"type": "source"},
    })
    assert r.status_code == 200, r.text
    item_id = r.json()["results"][0]["item_id"]

    r = client.get("/api/backtest/items?kind=variable")
    assert r.status_code == 200
    assert [i["name"] for i in r.json()["results"]] == ["my_var"]

    r = client.put(f"/api/backtest/items/{item_id}", json={"description": "설명"})
    assert r.status_code == 200
    assert r.json()["results"][0]["description"] == "설명"

    assert client.delete(f"/api/backtest/items/{item_id}").status_code == 200
    assert client.get("/api/backtest/items").json()["results"] == []


def test_backtest_responses_use_obbject_envelope(auth_client):
    """모든 backtest 응답이 `{results, provider, ...}` 여야 한다.

    프론트 계약이 `res.results` 다. `{success, data}` 로 되돌아가면 위젯이 빈 채로 뜬다.
    """
    client, _ = auth_client

    for path in ("/api/backtest/items", "/api/backtest/runs"):
        body = client.get(path).json()
        assert "results" in body, f"{path} 응답에 results 가 없다: {list(body)}"
        assert isinstance(body["results"], list)
        assert body.get("provider") == "backtest"
        assert "data" not in body, f"{path} 가 아직 구형 envelope 을 쓴다"


def test_backtest_validation_errors_still_surface(auth_client):
    """route_handler 를 붙인 뒤에도 의도된 4xx 가 그대로 나와야 한다."""
    client, _ = auth_client

    # 식별자 규칙 위반 (수식에서 참조되므로 소문자·밑줄만)
    r = client.post("/api/backtest/items", json={
        "kind": "variable", "name": "Bad Name!", "spec": {},
    })
    assert r.status_code == 400

    # 같은 이름 중복 → 409
    ok = {"kind": "event", "name": "dup_name", "spec": {}}
    assert client.post("/api/backtest/items", json=ok).status_code == 200
    assert client.post("/api/backtest/items", json=ok).status_code == 409

    # 없는 항목 → 404
    assert client.delete("/api/backtest/items/nope").status_code == 404


def test_notes_endpoint_works(auth_client):
    client, _ = auth_client
    assert client.get("/api/notes").status_code == 200


# ── 전환의 유일한 실질 위험: contextvar 전파 ──────────────────────────────────

def test_user_context_survives_threadpool(auth_client):
    """`def` 핸들러(스레드풀)에서도 current_user_id 가 보여야 한다.

    사라지면 QueryExecutor 가 사용자 Fetcher 워커로 위임하지 못하고 조용히 실패한다.
    """
    from data_fetcher.query_executor import current_user_id

    client, user_id = auth_client
    seen = {}

    @app.get("/api/__ctx_probe_sync")
    def probe_sync():                      # 스레드풀에서 실행된다
        seen["sync"] = current_user_id.get()
        return {"ok": True}

    @app.get("/api/__ctx_probe_async")
    async def probe_async():               # 이벤트 루프에서 실행된다
        seen["async"] = current_user_id.get()
        return {"ok": True}

    try:
        assert client.get("/api/__ctx_probe_sync").status_code == 200
        assert client.get("/api/__ctx_probe_async").status_code == 200
        assert seen["sync"] == user_id, (
            f"`def` 핸들러에서 user_id 가 {seen['sync']!r} — 스레드풀로 넘어가며 "
            "contextvar 가 유실됐다. Fetcher 위임이 조용히 깨진다."
        )
        assert seen["async"] == user_id
    finally:
        app.router.routes = [
            r for r in app.router.routes
            if getattr(r, "path", "") not in ("/api/__ctx_probe_sync", "/api/__ctx_probe_async")
        ]


# ── 회귀 방지: 블로킹 핸들러가 다시 async 로 돌아오지 않게 ────────────────────

def test_db_handlers_are_not_async():
    """`get_db` 를 받으면서 await 가 없는 핸들러는 `def` 여야 한다.

    `async def` 로 되돌아오면 그 핸들러의 DB 쿼리가 이벤트 루프를 막는다 —
    단일 워커 운영 환경에서는 그대로 전체 지연이 된다.
    """
    import ast
    import pathlib

    class HasAwait(ast.NodeVisitor):
        def __init__(self):
            self.found = False

        def visit_Await(self, n):
            self.found = True

        def visit_AsyncFor(self, n):
            self.found = True

        def visit_AsyncWith(self, n):
            self.found = True

    offenders = []
    for path in sorted(pathlib.Path("app/backend/api/routes").glob("*.py")):
        tree = ast.parse(path.read_text(encoding="utf-8"))
        for node in ast.walk(tree):
            if not isinstance(node, ast.AsyncFunctionDef):
                continue
            decorators = ast.unparse(node.decorator_list) if node.decorator_list else ""
            if "router." not in decorators:
                continue
            if "get_db" not in ast.unparse(node.args):
                continue
            visitor = HasAwait()
            for child in node.body:
                visitor.visit(child)
            if not visitor.found:
                offenders.append(f"{path.name}:{node.lineno} {node.name}")

    assert not offenders, (
        "await 없이 DB만 쓰는 async 핸들러 — `def` 로 바꿔라 "
        f"(이벤트 루프 블로킹): {offenders}"
    )

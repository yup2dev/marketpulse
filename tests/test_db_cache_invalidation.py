"""F10 — db provider 조회 캐시는 모델별 TTL 에 더해, 배치 적재(/api/ingest)가 끝나면 비운다.

적재 직후 화면이 TTL 이 끝날 때까지 옛 값을 보여 주지 않게 한다. 어느 모델이 어느 표를 읽는지 따로 적지 않고
db provider 캐시(qe:db:*) 전체를 비운다 — 적재는 하루 몇 번뿐이다.
"""
import uuid

import pytest
from fastapi.testclient import TestClient

from app.backend.core.auth.security import create_access_token
from app.backend.core.execution import ServerExecutor
from app.backend.models.orm import User


class _Cache:
    def __init__(self):
        self.data = {"v": 1}
        self.invalidated = []

    async def get(self, key):
        return self.data.get(key)

    async def set(self, key, value, ttl):
        self.data[key] = value

    async def invalidate_prefix(self, prefix):
        self.invalidated.append(prefix)
        return 3


def test_invalidate_provider_uses_the_provider_prefix(monkeypatch):
    import asyncio

    cache = _Cache()
    monkeypatch.setattr(ServerExecutor, "_cache", cache)
    assert asyncio.run(ServerExecutor.invalidate_provider("db")) == 3
    assert cache.invalidated == ["qe:db:"]
    monkeypatch.setattr(ServerExecutor, "_cache", None)                     # 캐시가 없으면 할 일 없음
    assert asyncio.run(ServerExecutor.invalidate_provider("db")) == 0


@pytest.fixture
def admin_client(db_session, monkeypatch):
    from app.backend.core.config import settings
    from app.backend.core.db import get_db
    from app.backend.main import app

    monkeypatch.setattr(settings, "DEBUG", False)
    admin_id = str(uuid.uuid4())
    db_session.add(User(user_id=admin_id, email="adm@example.com", username="adm", hashed_password="x",
                        is_active=True, role="admin"))
    db_session.commit()
    app.dependency_overrides[get_db] = lambda: db_session
    try:
        yield TestClient(app, headers={"Authorization": f"Bearer {create_access_token({'sub': admin_id})}"})
    finally:
        app.dependency_overrides.clear()


def test_ingest_clears_db_provider_cache(admin_client, monkeypatch):
    cache = _Cache()
    monkeypatch.setattr(ServerExecutor, "_cache", cache)
    r = admin_client.post("/api/ingest/mbs_in_stk_profile", json={"rows": [{"stk_cd": "AAPL"}]})
    assert r.status_code == 200 and r.json()["upserted"] == 1
    assert cache.invalidated == ["qe:db:"]


def test_empty_ingest_does_not_clear(admin_client, monkeypatch):
    cache = _Cache()
    monkeypatch.setattr(ServerExecutor, "_cache", cache)
    assert admin_client.post("/api/ingest/mbs_in_stk_profile", json={"rows": []}).json()["upserted"] == 0
    assert cache.invalidated == []

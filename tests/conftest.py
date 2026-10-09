"""백엔드 테스트 공통 픽스처.

여기 있는 테스트는 네트워크도 개발 DB도 쓰지 않는다:
  - 인증 게이트 테스트는 미들웨어가 라우팅 전에 401 을 내므로 DB 에 닿지 않는다.
  - QueryExecutor 테스트는 가짜 캐시 + _upstream_fetch 대체로 외부 호출을 막는다.
  - `db_session`/`auth_client` 는 tmp_path 의 임시 SQLite 를 쓴다(data/marketpulse.db 무관).

그래서 TestClient 를 `with` 없이 만든다 — lifespan 을 실행하면 DB 초기화, Redis 연결,
KIS 스트림, 랭킹 워밍업 태스크가 전부 뜬다. 라우팅·미들웨어 검증에는 필요 없다.
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


@pytest.fixture(scope="session")
def client() -> TestClient:
    """lifespan 을 실행하지 않는 TestClient (startup 부작용 없음)."""
    return TestClient(app)


@pytest.fixture
def prod_mode(monkeypatch):
    """운영과 같은 조건(DEBUG=False).

    AuthGateMiddleware 가 DEBUG 에 따라 /docs 공개 여부를 바꾸므로, 게이트 테스트는
    개발자 로컬 .env(DEBUG=true)에 결과가 좌우되지 않도록 이 픽스처로 고정한다.
    """
    monkeypatch.setattr(settings, "DEBUG", False)
    return settings


@pytest.fixture
def debug_mode(monkeypatch):
    """개발 조건(DEBUG=True)."""
    monkeypatch.setattr(settings, "DEBUG", True)
    return settings


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

"""백엔드 테스트 공통 픽스처.

여기 있는 테스트는 네트워크도 실 DB도 쓰지 않는다:
  - 인증 게이트 테스트는 미들웨어가 라우팅 전에 401 을 내므로 DB 에 닿지 않는다.
  - QueryExecutor 테스트는 가짜 캐시 + _upstream_fetch 대체로 외부 호출을 막는다.

그래서 TestClient 를 `with` 없이 만든다 — lifespan 을 실행하면 DB 초기화, Redis 연결,
KIS 스트림, 랭킹 워밍업 태스크가 전부 뜬다. 라우팅·미들웨어 검증에는 필요 없다.
"""
import pytest
from fastapi.testclient import TestClient

from app.backend.core.config import settings
from app.backend.main import app


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

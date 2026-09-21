"""refresh token 이 httpOnly 쿠키로만 오간다는 계약을 고정한다.

배경: refresh token(7일)이 access token(30분)과 함께 localStorage 에 있었다. XSS 한 건이면
장기 세션이 통째로 넘어간다. 본문에서 빼고 httpOnly 쿠키로 내리면 스크립트가 읽을 수 없다.

여기서 막고 싶은 회귀는 두 가지다:
  1. 편의상 응답 본문에 refresh_token 을 되돌려 놓는 것 (프론트가 다시 저장하게 된다)
  2. httpOnly 를 빼는 것 (쿠키로 옮긴 의미가 사라진다)
"""
import uuid

import pytest
from fastapi.testclient import TestClient

from app.backend.core.config import settings
from app.backend.core.db import get_db
from app.backend.main import app
from app.backend.services.auth_service import AuthService

COOKIE = settings.AUTH_COOKIE_NAME
PASSWORD = "test-password-1234"


@pytest.fixture
def user_client(db_session, monkeypatch):
    """실제로 로그인 가능한 사용자 + 쿠키를 보관하는 클라이언트."""
    monkeypatch.setattr(settings, "DEBUG", False)
    email = f"cookie-{uuid.uuid4().hex[:8]}@example.com"
    AuthService.create_user(
        db=db_session, email=email, username=f"u{uuid.uuid4().hex[:8]}",
        password=PASSWORD, full_name="Cookie Tester",
    )
    app.dependency_overrides[get_db] = lambda: db_session
    # https 로 띄운다 — 쿠키에 Secure 가 붙으므로(운영과 동일) http 클라이언트에는
    # 쿠키가 실리지 않아 갱신 경로를 검증할 수 없다.
    try:
        yield TestClient(app, base_url="https://testserver"), email
    finally:
        app.dependency_overrides.clear()


def _login(client, email):
    r = client.post("/api/auth/login", json={"email": email, "password": PASSWORD})
    assert r.status_code == 200, r.text
    return r


# ── 본문에 refresh token 이 없어야 한다 ───────────────────────────────────────

def test_login_does_not_return_refresh_token_in_body(user_client):
    client, email = user_client
    body = _login(client, email).json()

    assert "refresh_token" not in body, (
        "refresh_token 이 응답 본문에 돌아왔다 — 프론트가 localStorage 에 저장하게 된다"
    )
    # access token 과 fetcher token 은 본문으로 준다(둘 다 JS 가 써야 한다)
    assert body["access_token"]
    assert body["fetcher_token"]
    assert body["user"]["email"] == email


def test_login_sets_httponly_refresh_cookie(user_client):
    client, email = user_client
    r = _login(client, email)

    assert COOKIE in r.cookies, f"로그인이 {COOKIE} 쿠키를 내리지 않았다"

    raw = r.headers.get("set-cookie", "").lower()
    assert "httponly" in raw, "httpOnly 가 빠졌다 — 스크립트가 읽을 수 있게 된다"
    # refresh 이외의 요청에 실려 나가지 않도록 경로를 좁혀 둔다
    assert "path=/api/auth" in raw
    assert f"samesite={settings.AUTH_COOKIE_SAMESITE}".lower() in raw
    assert ("secure" in raw) == settings.auth_cookie_secure


# ── 쿠키만으로 갱신이 돌아야 한다 ────────────────────────────────────────────

def test_refresh_works_with_cookie_only(user_client):
    client, email = user_client
    _login(client, email)

    # 본문을 비워도 쿠키로 갱신된다
    r = client.post("/api/auth/refresh", json={})
    assert r.status_code == 200, r.text
    assert r.json()["access_token"]
    assert "refresh_token" not in r.json()


def test_refresh_reissues_cookie_with_full_lifetime(user_client):
    """갱신하면 refresh 쿠키를 **다시 내려** 세션 수명이 연장돼야 한다.

    주의 — 이건 '회전'이 아니다. 토큰 payload 가 `{sub, exp, type}` 뿐이라 같은 초에
    발급하면 문자열이 동일하고(jti 같은 고유값이 없다), 서버측 폐기 목록도 없어
    예전 토큰이 만료 전까지 계속 유효하다. 진짜 회전/폐기는 서버측 토큰 추적이
    필요하며 이 변경의 범위 밖이다. 여기서는 확인 가능한 것만 고정한다.
    """
    client, email = user_client
    _login(client, email)

    r = client.post("/api/auth/refresh", json={})
    assert r.status_code == 200
    assert COOKIE in r.cookies, "갱신이 refresh 쿠키를 다시 내리지 않았다"

    raw = r.headers.get("set-cookie", "").lower()
    expected = settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 3600
    assert f"max-age={expected}" in raw, "갱신이 수명을 연장하지 않았다"


def test_refresh_without_cookie_or_body_is_401(user_client):
    client, _ = user_client
    client.cookies.clear()

    r = client.post("/api/auth/refresh", json={})
    assert r.status_code == 401
    # 게이트가 아니라 핸들러가 낸 401 이어야 한다(= 엔드포인트에는 도달했다)
    assert "www-authenticate" not in r.headers


# ── 전환기: 본문 경로가 아직 살아 있어야 한다 ────────────────────────────────

def test_refresh_accepts_legacy_body_token(user_client, db_session):
    """구 프론트와 localStorage 에 예전 토큰을 들고 있는 사용자를 위한 경로.

    이게 죽으면 배포 순간 기존 로그인 사용자가 전부 로그아웃된다.
    """
    client, email = user_client
    from index_analyzer.models.orm import User
    user = db_session.query(User).filter(User.email == email).first()
    legacy = AuthService.generate_tokens(user)["refresh_token"]

    client.cookies.clear()
    r = client.post("/api/auth/refresh", json={"refresh_token": legacy})
    assert r.status_code == 200, r.text
    # 본문으로 들어와도 새 토큰은 쿠키로만 나간다
    assert COOKIE in r.cookies
    assert "refresh_token" not in r.json()


# ── 로그아웃 ──────────────────────────────────────────────────────────────────

def test_logout_clears_cookie(user_client):
    client, email = user_client
    access = _login(client, email).json()["access_token"]

    r = client.post("/api/auth/logout", headers={"Authorization": f"Bearer {access}"})
    assert r.status_code == 200
    assert 'path=/api/auth' in r.headers.get("set-cookie", "").lower()

    client.cookies.clear()
    assert client.post("/api/auth/refresh", json={}).status_code == 401

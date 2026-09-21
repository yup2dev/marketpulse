"""AuthGateMiddleware 회귀 테스트 — deny-by-default 가 유지되는지 고정한다.

배경: 예전 게이트는 `/api/` 로 시작하는 경로만 검사했다. 그래서 `/api/` 밖에 추가된
운영 엔드포인트가 조용히 무인증으로 공개됐고, 그중 `DELETE /cache/{prefix}` 는 누구나
운영 캐시를 통째로 날릴 수 있었다. 게이트를 deny-by-default 로 뒤집어 막았다.

이 파일의 핵심은 마지막 테스트다 — **공개 목록에 없는 새 경로는 자동으로 막혀야 한다.**
게이트가 allow-by-default 로 되돌아가면 그 테스트가 먼저 깨진다.
"""
import pytest

# ── 공개여야 하는 경로 ────────────────────────────────────────────────────────
PUBLIC = [
    ("GET", "/health", 200),      # Docker/LB 헬스체크
    ("GET", "/", 200),            # 앱 이름·버전 (업타임 체크)
]

# ── 토큰 없이 막혀야 하는 경로 ────────────────────────────────────────────────
# 구경로(이동 전 주소)도 포함한다 — 게이트가 라우팅보다 앞이라 404 가 아니라 401 이다.
# 즉 어떤 경로가 존재하는지조차 새지 않는다.
GATED = [
    ("GET",    "/api/admin/cache/stats"),
    ("DELETE", "/api/admin/cache/quote"),
    ("POST",   "/api/admin/cache/refresh"),
    ("GET",    "/api/admin/circuit-breakers"),
    ("POST",   "/api/admin/circuit-breakers/fmp/reset"),
    ("GET",    "/api/admin/fetcher-workers"),
    ("GET",    "/cache/stats"),          # 구경로
    ("DELETE", "/cache/quote"),          # 구경로 — 파괴적이었다
    ("GET",    "/fetcher-workers"),      # 구경로 — 워커 목록 노출이었다
    ("GET",    "/circuit-breakers"),     # 구경로
    ("GET",    "/api/stock/AAPL/quote"),
    ("GET",    "/api/watchlist"),
    ("GET",    "/api/backtest/items"),
]


@pytest.mark.parametrize("method,path,expected", PUBLIC)
def test_public_paths_open_without_token(client, prod_mode, method, path, expected):
    assert client.request(method, path).status_code == expected


@pytest.mark.parametrize("method,path", GATED)
def test_gated_paths_reject_without_token(client, prod_mode, method, path):
    r = client.request(method, path)
    assert r.status_code == 401, f"{method} {path} 가 인증 없이 통과했다"
    # 프론트 apiClient 는 401 + WWW-Authenticate 를 보고 refresh → forceLogout 을 수행한다.
    assert r.headers.get("www-authenticate") == "Bearer"


@pytest.mark.parametrize("method,path", GATED)
def test_gated_paths_reject_garbage_token(client, prod_mode, method, path):
    r = client.request(method, path, headers={"Authorization": "Bearer not-a-real-token"})
    assert r.status_code == 401


def test_refresh_token_cannot_be_used_as_access_token(client, prod_mode):
    """refresh 토큰으로 API 를 호출할 수 없어야 한다 (게이트가 type=refresh 를 거른다)."""
    from app.backend.core.auth.security import create_refresh_token

    token = create_refresh_token({"sub": "test-user"})
    r = client.get("/api/watchlist", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 401


def test_auth_endpoints_are_public(client, prod_mode):
    """로그인/가입/갱신은 토큰 없이 도달해야 한다 (422 = 게이트 통과 후 본문 검증)."""
    for path in ("/api/auth/login", "/api/auth/register", "/api/auth/refresh"):
        r = client.post(path, json={})
        assert r.status_code != 401, f"{path} 가 게이트에 막혔다 — 로그인 자체가 불가능해진다"


def test_cors_preflight_passes_gate(client, prod_mode):
    """OPTIONS(프리플라이트)는 토큰 없이 통과해야 브라우저가 실제 요청을 보낸다."""
    r = client.options(
        "/api/watchlist",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "GET",
        },
    )
    assert r.status_code == 200
    assert "access-control-allow-origin" in r.headers


def test_401_carries_cors_headers(client, prod_mode):
    """401 응답에도 CORS 헤더가 붙어야 한다.

    안 붙으면 브라우저가 응답을 막아 프론트가 status 를 읽지 못하고 네트워크 오류로
    처리한다 → refresh/forceLogout/로그인 리다이렉트가 전부 동작하지 않는다.
    (그래서 CORSMiddleware 를 AuthGate 보다 나중에 add 해 최외곽에 둔다)
    """
    r = client.get("/api/watchlist", headers={"Origin": "http://localhost:5173"})
    assert r.status_code == 401
    assert r.headers.get("access-control-allow-origin") == "http://localhost:5173"


def test_openapi_docs_closed_in_production(client, prod_mode):
    """운영에서는 API 스키마를 공개하지 않는다."""
    for path in ("/docs", "/redoc", "/openapi.json"):
        assert client.get(path).status_code == 401, f"{path} 가 운영에서 열려 있다"


def test_openapi_docs_open_in_debug(client, debug_mode):
    """DEBUG=true 면 코드 수정 없이 문서를 열 수 있다."""
    assert client.get("/docs").status_code == 200
    assert client.get("/openapi.json").status_code == 200


def test_unknown_path_is_denied_by_default(client, prod_mode):
    """**이 테스트가 이 파일의 핵심이다.**

    공개 목록에 없는 경로는 등록 여부와 무관하게 막혀야 한다. 게이트가 allow-by-default
    (`not path.startswith('/api/')` → 통과)로 되돌아가면 여기서 404 가 나며 깨진다.
    """
    for path in ("/totally/new/route", "/metrics", "/admin", "/internal/debug"):
        r = client.get(path)
        assert r.status_code == 401, (
            f"{path} 가 401 이 아니라 {r.status_code} — 게이트가 deny-by-default 가 아니다"
        )

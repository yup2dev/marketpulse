"""앱 조립 스모크 — import 와 라우터 등록이 깨지지 않았는지 본다.

CI 게이트의 1차 방어선이다. 라우트 파일 하나가 import 에러를 내거나 main.py 등록을
빠뜨리면 여기서 걸린다 — 배포 후 500 으로 발견하는 것보다 훨씬 싸다.

경로 목록은 `app.routes`(Starlette 내부 구조)가 아니라 **OpenAPI 스키마**에서 읽는다.
fastapi 0.141 에서 라우터 구성이 바뀌어 `app.routes` 순회가 등록된 라우트를 보지
못했다(로컬 0.116 에서는 통과, CI 에서만 실패). 앱 자체는 멀쩡했고 테스트의 내부
구조 의존이 문제였다 — openapi() 는 버전을 넘어 안정적인 공개 계약이다.
"""
import pytest


def _http_paths(app) -> set:
    """앱이 실제로 서빙하는 HTTP 경로 (OpenAPI 스키마 기준).

    include_in_schema=False 인 라우트(/docs, /openapi.json 등)는 포함되지 않는다.
    """
    return set(app.openapi().get("paths", {}))


def test_app_imports_and_has_routes():
    from app.backend.main import app

    assert len(_http_paths(app)) > 50, "라우터 등록이 누락된 것으로 보인다"


def test_every_route_module_is_registered():
    """routes/ 의 모든 라우터 모듈이 실제로 app 에 등록됐는지 확인한다.

    새 라우트 파일을 만들고 main.py 에 include_router 를 빠뜨리는 실수를 잡는다
    (그런 엔드포인트는 조용히 404 가 되고, 보통 프론트에서야 발견된다).
    """
    import importlib
    import pkgutil

    from fastapi import APIRouter

    import app.backend.api.routes as routes_pkg
    from app.backend.main import app

    registered = _http_paths(app)
    missing = []

    for mod_info in pkgutil.iter_modules(routes_pkg.__path__):
        mod = importlib.import_module(f"{routes_pkg.__name__}.{mod_info.name}")
        router = getattr(mod, "router", None)
        if not isinstance(router, APIRouter) or not router.routes:
            continue
        # 라우터의 경로 중 하나라도 app 에 등록된 경로의 suffix 로 나타나면 등록된 것으로 본다
        # (main.py 가 prefix 를 붙여 등록하므로 정확 일치로는 판단할 수 없다)
        paths = [r.path for r in router.routes if getattr(r, "methods", None)]
        if paths and not any(any(p.endswith(rp) for p in registered) for rp in paths):
            missing.append(mod_info.name)

    assert not missing, f"main.py 에 include_router 가 빠진 라우트 모듈: {missing}"


def test_admin_endpoints_live_under_api_admin():
    """운영 엔드포인트는 반드시 /api/admin/* 아래에 있어야 한다.

    루트(`/cache/*` 등)로 되돌아가면 AuthGate 공개 목록 밖이 아니라 '게이트 대상'이긴
    하지만, require_admin 이 빠진 채 루트에 재등장하는 회귀를 막는다.
    """
    from app.backend.main import app

    paths = _http_paths(app)
    expected = {
        "/api/admin/cache/stats",
        "/api/admin/cache/{prefix}",
        "/api/admin/cache/refresh",
        "/api/admin/circuit-breakers",
        "/api/admin/circuit-breakers/{provider}/reset",
        "/api/admin/fetcher-workers",
    }
    assert expected <= paths, f"누락된 admin 경로: {expected - paths}"

    # 루트 운영 경로가 되살아나지 않았는지
    resurrected = {p for p in paths if p.startswith(("/cache", "/circuit-breakers", "/fetcher-workers"))}
    assert not resurrected, f"루트로 되돌아온 운영 경로: {resurrected}"


def test_admin_router_requires_admin():
    """admin 라우터 전체에 require_admin 이 걸려 있어야 한다."""
    from app.backend.api.routes.admin import router
    from app.backend.core.auth.dependencies import require_admin

    deps = [d.dependency for d in router.dependencies]
    assert require_admin in deps, "admin 라우터에 require_admin 이 없다"


def test_non_api_http_paths_are_only_the_known_public_ones():
    """`/api/` 밖 HTTP 경로는 공개 목록 + OpenAPI 문서뿐이어야 한다.

    새 엔드포인트를 무심코 루트에 다는 순간 여기서 걸린다 — 1.1 회귀의 근본 원인이었다.
    """
    from app.backend.main import app, _DOCS_PATHS, _PUBLIC_PATHS

    non_api = {
        p for p in _http_paths(app)
        if not p.startswith("/api/") and not p.startswith("/ws/")
    }
    # OpenAPI 스키마에는 /docs·/openapi.json 이 들어오지 않지만, 혹시 포함되더라도
    # 공개 대상이므로 허용 집합에 함께 둔다.
    allowed = set(_PUBLIC_PATHS) | set(_DOCS_PATHS)
    assert non_api <= allowed, (
        f"공개 목록에 없는 루트 경로가 추가됐다: {non_api - allowed} — "
        "/api/ 아래로 옮기고 필요한 권한 의존성을 걸어라"
    )

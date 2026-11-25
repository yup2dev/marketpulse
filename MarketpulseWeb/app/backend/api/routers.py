"""라우터 등록 — routes/ 폴더를 훑어 router 가 있는 모듈을 전부 붙인다 (자동 탐색).

새 라우트 파일은 routes/ 에 두기만 하면 등록된다. 모듈이 정할 수 있는 값 (모두 선택):

    router   APIRouter, 또는 .router 로 APIRouter 를 감싼 객체 (CommandRouter)
    PREFIX   붙일 주소 앞부분 — 기본 "/api". 모듈 이름은 붙지 않는다: 대부분의 라우트가
             APIRouter(prefix="/alerts") 처럼 자기 구간을 이미 갖고 있어서다.
    TAGS     OpenAPI 태그 — 기본 [모듈 이름의 _ 를 - 로]
    ORDER    등록 순서 — 기본 100, 작을수록 먼저. 경로가 겹치면 먼저 붙은 라우트가 이긴다.
             {provider}/{model} 처럼 넓게 받는 범용 라우트는 크게 둬서 뒤로 보낸다.

이름이 _ 로 시작하는 모듈은 건너뛴다. import 가 실패하면 앱이 뜨지 않는다 — 조용히 빠진
엔드포인트는 404 가 되고 보통 프론트에서야 발견되므로, 경고로 넘기지 않는다.

PyInstaller 로 백엔드를 묶게 되면 자동 탐색 모듈은 번들에서 빠진다 →
hiddenimports=collect_submodules("app.backend.api.routes"). (지금 exe 는 Fetcher 만 묶는다.)
"""
import importlib
import logging
import pkgutil
from typing import List, NamedTuple, Optional

from fastapi import APIRouter, FastAPI

from app.backend.api import routes as routes_pkg

log = logging.getLogger(__name__)

DEFAULT_PREFIX = "/api"
DEFAULT_ORDER = 100


class RouteModule(NamedTuple):
    order: int
    name: str
    router: APIRouter
    prefix: str
    tags: List[str]


def _api_router(obj) -> Optional[APIRouter]:
    if isinstance(obj, APIRouter):
        return obj
    inner = getattr(obj, "router", None)   # CommandRouter 등
    return inner if isinstance(inner, APIRouter) else None


def discover() -> List[RouteModule]:
    """routes/ 의 라우터 모듈 — 등록 순서 (ORDER, 이름) 로 정렬."""
    found = []
    for info in pkgutil.iter_modules(routes_pkg.__path__):
        if info.name.startswith("_"):
            continue
        mod = importlib.import_module(f"{routes_pkg.__name__}.{info.name}")
        router = _api_router(getattr(mod, "router", None))
        if router is None:
            continue
        found.append(RouteModule(
            order=getattr(mod, "ORDER", DEFAULT_ORDER),
            name=info.name,
            router=router,
            prefix=getattr(mod, "PREFIX", DEFAULT_PREFIX),
            tags=list(getattr(mod, "TAGS", [info.name.replace("_", "-")])),
        ))
    return sorted(found, key=lambda m: (m.order, m.name))


def register_routers(app: FastAPI) -> None:
    for m in discover():
        app.include_router(m.router, prefix=m.prefix, tags=m.tags)
        log.debug("router %s → %s%s", m.name, m.prefix, m.router.prefix)

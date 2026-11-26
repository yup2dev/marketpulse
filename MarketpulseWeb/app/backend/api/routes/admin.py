"""운영(admin) API — 캐시·서킷브레이커·Fetcher 워커 풀 점검 및 조작.

이 엔드포인트들은 원래 main.py 에 `/cache/*`, `/circuit-breakers/*`, `/fetcher-workers`
로 등록되어 있었다. AuthGateMiddleware 가 `/api/` 프리픽스만 검사했기 때문에 전부
무인증으로 공개되어 있었고, 특히 `DELETE /cache/{prefix}` 는 누구나 운영 캐시를 통째로
날릴 수 있었다(512MB 인스턴스에서는 곧바로 provider 폭주로 이어진다).

그래서 `/api/admin/*` 아래로 옮기고 라우터 전체에 require_admin 을 건다.
같은 실수가 재발하지 않도록 AuthGateMiddleware 도 deny-by-default 로 바꿨다.

엔드포인트:
    GET    /api/admin/cache/stats                       캐시 적중률·크기
    DELETE /api/admin/cache/{prefix}                    prefix 단위 캐시 무효화
    POST   /api/admin/cache/refresh                     심볼 마스터 재적재
    GET    /api/admin/circuit-breakers                  provider별 서킷브레이커 상태
    POST   /api/admin/circuit-breakers/{provider}/reset 서킷브레이커 수동 리셋(OPEN → CLOSED)
    GET    /api/admin/fetcher-workers                   /ws/fetcher 접속 워커 풀 상태
    POST   /api/admin/widget-types                      위젯 종류 추가 (설정 화면 '보여 줄 위젯' 목록)
    PUT    /api/admin/widget-types/{type_code}          이름·그리는 방식·사용 여부·순서
    DELETE /api/admin/widget-types/{type_code}          쓰는 위젯이 있으면 409
    POST   /api/admin/data-catalog/sync                 데이터 카탈로그를 Fetcher 등록 정보와 다시 맞춤
    GET    /api/admin/data-catalog/broken-widgets       빠진 API · 필드 · 파라미터를 쓰는 위젯
    GET    /api/admin/data-routes                       (provider, model) 실행 위치 Y/N 목록
    PUT    /api/admin/data-routes/{provider}/{model}    실행 위치 바꾸기 {local: true|false}
    GET    /api/admin/monitor/{dataset}                 운영 모니터링 (/admin 화면 위젯)
           summary · system · traffic · endpoints · inflight · slow
"""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.backend.core.auth.dependencies import require_admin
from app.backend.core.db import get_db

router = APIRouter(prefix="/admin", dependencies=[Depends(require_admin)])


# ── 캐시 ──────────────────────────────────────────────────────────────────────

@router.get("/cache/stats", summary="캐시 통계")
async def cache_stats():
    from app.backend.core.cache import cache, CACHE_VERSION
    return {"version": CACHE_VERSION, **cache.stats()}


@router.delete("/cache/{prefix}", summary="prefix 단위 캐시 무효화")
async def cache_invalidate(prefix: str):
    from app.backend.core.cache import cache
    count = await cache.invalidate_prefix(prefix)
    return {"invalidated": count, "prefix": prefix}


@router.post("/cache/refresh", summary="심볼 마스터 재적재")
async def cache_refresh_stocks():
    from app.backend.commands.stock.universe import refresh_cache
    count = await refresh_cache()
    return {"status": "ok", "count": count}


# ── 서킷브레이커 ──────────────────────────────────────────────────────────────

@router.get("/circuit-breakers", summary="provider 서킷브레이커 상태 조회")
async def circuit_breaker_stats():
    from app.backend.core.execution.circuit_breaker import all_stats
    return all_stats()


@router.post("/circuit-breakers/{provider}/reset", summary="서킷브레이커 수동 리셋")
async def circuit_breaker_reset(provider: str):
    from app.backend.core.execution.circuit_breaker import reset
    reset(provider)
    return {"status": "reset", "provider": provider}


# ── Fetcher 워커 풀 ───────────────────────────────────────────────────────────

@router.get("/fetcher-workers", summary="접속 중인 사용자 PC Fetcher 워커 풀 상태")
async def fetcher_workers():
    from app.backend.core.fetcher_pool import fetcher_pool
    return {"connected": fetcher_pool.count(), "workers": fetcher_pool.status()}


# ── 운영 모니터링 ─────────────────────────────────────────────────────────────
# 값은 프로세스 메모리에만 있다 (services/monitor_service.py). async 로 둔다 — 동기 라우트가 스레드 풀을
# 다 붙잡아 서버가 느려졌을 때도 이 화면은 이벤트 루프에서 바로 답해야 원인을 볼 수 있다.

MONITOR_PROVIDER = "server"   # 출처 표기 (common/widget/sources.js)


@router.get("/monitor/{dataset}", summary="운영 모니터링 — 부하 · 메모리 · 요청 성능")
async def monitor(dataset: str):
    from app.backend.services import monitor_service as mon
    readers = {
        "summary": mon.summary,
        "system": mon.system_series,
        "traffic": mon.traffic_series,
        "endpoints": mon.endpoints,
        "inflight": mon.inflight,
        "slow": mon.slow_requests,
    }
    reader = readers.get(dataset)
    if reader is None:
        raise HTTPException(status_code=404, detail=f"모르는 항목이에요: {dataset}")
    return {"results": reader(), "provider": MONITOR_PROVIDER}


# ── 위젯 종류 목록 ────────────────────────────────────────────────────────────
# 읽기는 모든 사용자(/api/user-widgets/codes 의 VIEW_TYPE), 쓰기만 여기.

class WidgetTypeCreate(BaseModel):
    type_code: str = Field(..., max_length=30)
    name: str = Field(..., max_length=100)
    renderer: str
    use_yn: str = "Y"
    sort_seq: Optional[int] = None


class WidgetTypeUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=100)
    renderer: Optional[str] = None
    use_yn: Optional[str] = None
    sort_seq: Optional[int] = None


@router.post("/widget-types", status_code=201, summary="위젯 종류 추가")
def create_widget_type(body: WidgetTypeCreate, db: Session = Depends(get_db)):
    from app.backend.services.user_widget_service import UserWidgetError, WidgetTypeService
    try:
        return WidgetTypeService.to_code(WidgetTypeService.create(db, body.model_dump()))
    except UserWidgetError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/widget-types/{type_code}", summary="위젯 종류 수정")
def update_widget_type(type_code: str, body: WidgetTypeUpdate, db: Session = Depends(get_db)):
    from app.backend.services.user_widget_service import UserWidgetError, WidgetTypeService
    try:
        t = WidgetTypeService.update(db, type_code, body.model_dump(exclude_unset=True))
    except UserWidgetError as e:
        raise HTTPException(status_code=400, detail=str(e))
    if not t:
        raise HTTPException(status_code=404, detail="Widget type not found")
    return WidgetTypeService.to_code(t)


@router.delete("/widget-types/{type_code}", status_code=204, summary="위젯 종류 삭제")
def delete_widget_type(type_code: str, db: Session = Depends(get_db)):
    from app.backend.services.user_widget_service import WidgetTypeInUse, WidgetTypeService
    try:
        found = WidgetTypeService.delete(db, type_code)
    except WidgetTypeInUse as e:
        raise HTTPException(status_code=409, detail=str(e))
    if not found:
        raise HTTPException(status_code=404, detail="Widget type not found")


# ── 데이터 카탈로그 ───────────────────────────────────────────────────────────
# 기동할 때 한 번 맞춘다 (core/lifespan). Fetcher 를 고친 뒤 재기동 없이 맞출 때 쓴다.

@router.post("/data-catalog/sync", summary="데이터 카탈로그 동기화")
def sync_data_catalog(db: Session = Depends(get_db)):
    from app.backend.services.data_catalog import sync_catalog
    return sync_catalog(db)


@router.get("/data-catalog/broken-widgets", summary="깨진 위젯 점검")
def broken_widgets(db: Session = Depends(get_db)):
    from app.backend.services.data_catalog import find_broken_widgets
    return find_broken_widgets(db)


# ── 실행 위치 (data_model_routes) ─────────────────────────────────────────────
# (provider, model) 를 사용자 PC Fetcher 에서만 돌릴지(Y) 서버에서 돌릴지(N). 바꾸면 바로 적용된다 (메모리도 함께).

class RouteBody(BaseModel):
    local: bool = Field(description="True = 로컬 전용 (PC Fetcher 위임), False = 서버 실행")


@router.get("/data-routes", summary="실행 위치 목록")
def list_data_routes(provider: Optional[str] = None, db: Session = Depends(get_db)):
    from app.backend.models.orm import DataModelRoute

    q = db.query(DataModelRoute)
    if provider:
        q = q.filter(DataModelRoute.provider == provider)
    return [
        {"provider": r.provider, "model": r.model, "local_yn": r.local_yn,
         "updated_at": r.updated_at.isoformat() if r.updated_at else None, "updated_by": r.updated_by}
        for r in q.order_by(DataModelRoute.provider, DataModelRoute.model)
    ]


@router.put("/data-routes/{provider}/{model}", summary="실행 위치 바꾸기")
def set_data_route(provider: str, model: str, body: RouteBody, db: Session = Depends(get_db),
                   admin=Depends(require_admin)):
    from app.backend.core.execution import routes

    if (provider, model) not in set(routes.registered_pairs()):
        raise HTTPException(status_code=404, detail=f"'{provider}/{model}' 는 등록된 fetcher 가 아니다")
    routes.set_route(db, provider, model, body.local, user_id=str(getattr(admin, "user_id", "")) or None)
    return {"provider": provider, "model": model, "local_yn": "Y" if body.local else "N"}

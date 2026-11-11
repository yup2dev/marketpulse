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
    from app.backend.services.stock_list_service import refresh_cache
    count = await refresh_cache()
    return {"status": "ok", "count": count}


# ── 서킷브레이커 ──────────────────────────────────────────────────────────────

@router.get("/circuit-breakers", summary="provider 서킷브레이커 상태 조회")
async def circuit_breaker_stats():
    from data_fetcher.utils.circuit_breaker import all_stats
    return all_stats()


@router.post("/circuit-breakers/{provider}/reset", summary="서킷브레이커 수동 리셋")
async def circuit_breaker_reset(provider: str):
    from data_fetcher.utils.circuit_breaker import reset
    reset(provider)
    return {"status": "reset", "provider": provider}


# ── Fetcher 워커 풀 ───────────────────────────────────────────────────────────

@router.get("/fetcher-workers", summary="접속 중인 사용자 PC Fetcher 워커 풀 상태")
async def fetcher_workers():
    from app.backend.core.fetcher_pool import fetcher_pool
    return {"connected": fetcher_pool.count(), "workers": fetcher_pool.status()}


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

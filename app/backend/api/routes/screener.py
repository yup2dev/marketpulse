"""
종목 스크리너 API

응답은 프로젝트 표준인 OBBject(`{results, provider, metadata}`)로 통일한다.
행 목록은 `results` 에, 조회 조건·건수 같은 부가 정보는 `metadata` 에 담는다.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Dict, Any, Optional

from app.backend.api.deps import route_handler
from app.backend.core.db import get_db
from app.backend.core.auth.dependencies import get_current_active_user, get_optional_user
from app.backend.services.screener_service import ScreenerService
from data_fetcher.core import OBBject
from index_analyzer.models.orm import User

router = APIRouter(prefix="/screener", tags=["Screener"])

_PROVIDER = "screener"


# Request/Response Models
class ScreenRequest(BaseModel):
    filters: Dict[str, Any]
    limit: int = 100


class SavedScreenerCreate(BaseModel):
    name: str
    filters: Dict[str, Any]
    description: Optional[str] = None
    run_frequency: str = "manual"


class SavedScreenerUpdate(BaseModel):
    filters: Dict[str, Any]
    name: Optional[str] = None


@router.post("/screen")
@route_handler
async def screen_stocks(
    screen_request: ScreenRequest,
    current_user: Optional[User] = Depends(get_optional_user),
):
    """종목 스크리닝 — FMP stock-screener API 기반 (로그인 선택)"""
    results = await ScreenerService.screen_stocks(
        filters=screen_request.filters,
        limit=screen_request.limit,
    )
    return OBBject(
        results=results, provider=_PROVIDER,
        metadata={"count": len(results), "filters": screen_request.filters},
    )


@router.post("/save", status_code=status.HTTP_201_CREATED)
@route_handler
def save_screener(
    screener_data: SavedScreenerCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    스크리너 조건 저장 (로그인 필요)
    """
    screener = ScreenerService.save_screener(
        db=db,
        user_id=current_user.user_id,
        name=screener_data.name,
        filters=screener_data.filters,
        description=screener_data.description,
        run_frequency=screener_data.run_frequency
    )

    return OBBject(results=[screener.to_dict()], provider=_PROVIDER)


@router.get("/saved")
@route_handler
def get_my_screeners(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    저장된 스크리너 목록 조회
    """
    screeners = ScreenerService.get_user_screeners(db, current_user.user_id)
    return OBBject(results=[s.to_dict() for s in screeners], provider=_PROVIDER)


@router.post("/saved/{screener_id}/run")
@route_handler
async def run_saved_screener(
    screener_id: str,
    limit: int = 100,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """저장된 스크리너 실행"""
    result = await ScreenerService.run_saved_screener(
        db=db, screener_id=screener_id,
        user_id=current_user.user_id, limit=limit,
    )
    if not result:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Screener not found")
    return OBBject(results=[result], provider=_PROVIDER)


@router.put("/saved/{screener_id}")
@route_handler
def update_screener(
    screener_id: str,
    screener_data: SavedScreenerUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """기존 스크리너 필터 조건 업데이트"""
    screener = ScreenerService.update_screener(
        db=db,
        screener_id=screener_id,
        user_id=current_user.user_id,
        filters=screener_data.filters,
        name=screener_data.name,
    )
    if not screener:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Screener not found")
    return OBBject(results=[screener.to_dict()], provider=_PROVIDER)


@router.delete("/saved/{screener_id}")
@route_handler
def delete_screener(
    screener_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    저장된 스크리너 삭제
    """
    success = ScreenerService.delete_screener(db, screener_id, current_user.user_id)

    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Screener not found"
        )

    return OBBject(results=[], provider=_PROVIDER, metadata={"deleted": screener_id})


@router.get("/sectors")
@route_handler
def get_sectors():
    """사용 가능한 섹터 목록 조회"""
    return OBBject(results=ScreenerService.get_available_sectors(), provider=_PROVIDER)


@router.get("/presets")
@route_handler
def get_screener_presets():
    """
    사전 정의된 스크리너 프리셋 목록 조회 (로그인 불필요)
    """
    presets = ScreenerService.get_presets()
    return OBBject(results=presets, provider=_PROVIDER)


@router.get("/presets/{preset_id}")
@route_handler
def get_screener_preset(preset_id: str):
    """
    특정 프리셋 조회 (로그인 불필요)
    """
    preset = ScreenerService.get_preset_by_id(preset_id)

    if not preset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Preset not found"
        )

    return OBBject(results=[preset], provider=_PROVIDER)


@router.post("/presets/{preset_id}/run")
@route_handler
async def run_preset_screener(
    preset_id: str,
    limit: int = 100,
    current_user: Optional[User] = Depends(get_optional_user),
):
    """프리셋으로 스크리닝 실행 (로그인 선택)"""
    preset = ScreenerService.get_preset_by_id(preset_id)
    if not preset:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Preset not found")
    results = await ScreenerService.screen_stocks(filters=preset["filters"], limit=limit)
    return OBBject(
        results=results, provider=_PROVIDER,
        metadata={"preset": preset, "count": len(results)},
    )

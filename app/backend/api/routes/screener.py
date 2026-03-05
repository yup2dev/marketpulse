"""
종목 스크리너 API
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Dict, Any, Optional

from app.backend.database.db_dependency import get_db
from app.backend.auth.dependencies import get_current_active_user, get_optional_user
from app.backend.services.screener_service import ScreenerService
from index_analyzer.models.orm import User

router = APIRouter(prefix="/screener", tags=["Screener"])


# Request/Response Models
class ScreenRequest(BaseModel):
    filters: Dict[str, Any]
    limit: int = 100


class SavedScreenerCreate(BaseModel):
    name: str
    filters: Dict[str, Any]
    description: Optional[str] = None
    run_frequency: str = "manual"


@router.post("/screen")
def screen_stocks(
    screen_request: ScreenRequest,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user)
):
    """
    종목 스크리닝 (로그인 선택)

    filters 예시:
    {
        "sector": ["Technology", "Healthcare"],
        "market_cap_min": 1000000000,
        "market_cap_max": 100000000000,
        "pe_ratio_min": 5,
        "pe_ratio_max": 30,
        "price_min": 10,
        "price_max": 500,
        "change_rate_min": -5,
        "change_rate_max": 10,
        "roe_min": 10,
        "debt_to_equity_max": 1.5
    }
    """
    results = ScreenerService.screen_stocks(
        db=db,
        filters=screen_request.filters,
        limit=screen_request.limit
    )

    return {
        "results": results,
        "count": len(results),
        "filters": screen_request.filters
    }


@router.post("/save", status_code=status.HTTP_201_CREATED)
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

    return screener.to_dict()


@router.get("/saved")
def get_my_screeners(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    저장된 스크리너 목록 조회
    """
    screeners = ScreenerService.get_user_screeners(db, current_user.user_id)
    return [s.to_dict() for s in screeners]


@router.post("/saved/{screener_id}/run")
def run_saved_screener(
    screener_id: str,
    limit: int = 100,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    저장된 스크리너 실행
    """
    result = ScreenerService.run_saved_screener(
        db=db,
        screener_id=screener_id,
        user_id=current_user.user_id,
        limit=limit
    )

    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Screener not found"
        )

    return result


@router.delete("/saved/{screener_id}")
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

    return {"message": "Screener deleted successfully"}


@router.get("/sectors")
def get_sectors(db: Session = Depends(get_db)):
    """
    사용 가능한 섹터 목록 조회 (로그인 불필요)
    """
    sectors = ScreenerService.get_available_sectors(db)
    return {"sectors": sectors}


@router.get("/presets")
def get_screener_presets():
    """
    사전 정의된 스크리너 프리셋 목록 조회 (로그인 불필요)
    """
    presets = ScreenerService.get_presets()
    return {"presets": presets}


@router.get("/presets/{preset_id}")
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

    return preset


@router.post("/presets/{preset_id}/run")
def run_preset_screener(
    preset_id: str,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user)
):
    """
    프리셋을 사용하여 스크리닝 실행 (로그인 선택)
    """
    preset = ScreenerService.get_preset_by_id(preset_id)

    if not preset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Preset not found"
        )

    # 프리셋 필터로 스크리닝 실행
    results = ScreenerService.screen_stocks(
        db=db,
        filters=preset["filters"],
        limit=limit
    )

    return {
        "preset": preset,
        "results": results,
        "count": len(results)
    }

"""
Watchlist API Routes
관심종목 관리 엔드포인트
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel

from app.backend.database.db_dependency import get_db
from app.backend.auth.dependencies import get_current_user
from app.backend.services.watchlist_service import WatchlistService

router = APIRouter(prefix="/watchlist", tags=["watchlist"])


# =============================================================================
# Request/Response Models
# =============================================================================

class CreateWatchlistRequest(BaseModel):
    """관심종목 리스트 생성 요청"""
    name: str
    description: Optional[str] = None


class UpdateWatchlistRequest(BaseModel):
    """관심종목 리스트 수정 요청"""
    name: Optional[str] = None
    description: Optional[str] = None


class AddTickerRequest(BaseModel):
    """종목 추가 요청"""
    ticker_cd: str
    notes: Optional[str] = None


class ReorderItemsRequest(BaseModel):
    """항목 순서 변경 요청"""
    ticker_orders: List[dict]  # [{"ticker_cd": "AAPL", "sort_order": 0}, ...]


# =============================================================================
# Watchlist Management Endpoints
# =============================================================================

@router.get("")
async def get_watchlists(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """
    사용자의 모든 관심종목 리스트 조회

    Returns:
        관심종목 리스트 목록
    """
    try:
        user_id = current_user.get("user_id")
        watchlists = WatchlistService.get_user_watchlists(db, user_id)
        return {"success": True, "data": watchlists}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch watchlists: {str(e)}"
        )


@router.post("")
async def create_watchlist(
    request: CreateWatchlistRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """
    새 관심종목 리스트 생성

    Args:
        request: 생성 요청 데이터

    Returns:
        생성된 관심종목 리스트
    """
    try:
        user_id = current_user.get("user_id")
        watchlist = WatchlistService.create_watchlist(
            db,
            user_id,
            request.name,
            request.description
        )
        return {"success": True, "data": watchlist}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create watchlist: {str(e)}"
        )


@router.get("/{watchlist_id}")
async def get_watchlist(
    watchlist_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """
    특정 관심종목 리스트 조회

    Args:
        watchlist_id: 관심종목 리스트 ID

    Returns:
        관심종목 리스트
    """
    try:
        user_id = current_user.get("user_id")
        watchlist = WatchlistService.get_watchlist_by_id(db, watchlist_id, user_id)

        if not watchlist:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Watchlist not found"
            )

        return {"success": True, "data": watchlist}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch watchlist: {str(e)}"
        )


@router.put("/{watchlist_id}")
async def update_watchlist(
    watchlist_id: str,
    request: UpdateWatchlistRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """
    관심종목 리스트 정보 수정

    Args:
        watchlist_id: 관심종목 리스트 ID
        request: 수정 요청 데이터

    Returns:
        수정된 관심종목 리스트
    """
    try:
        user_id = current_user.get("user_id")
        watchlist = WatchlistService.update_watchlist(
            db,
            watchlist_id,
            user_id,
            request.name,
            request.description
        )

        if not watchlist:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Watchlist not found"
            )

        return {"success": True, "data": watchlist}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update watchlist: {str(e)}"
        )


@router.delete("/{watchlist_id}")
async def delete_watchlist(
    watchlist_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """
    관심종목 리스트 삭제

    Args:
        watchlist_id: 관심종목 리스트 ID

    Returns:
        성공 메시지
    """
    try:
        user_id = current_user.get("user_id")
        success = WatchlistService.delete_watchlist(db, watchlist_id, user_id)

        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Watchlist not found"
            )

        return {"success": True, "message": "Watchlist deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete watchlist: {str(e)}"
        )


# =============================================================================
# Watchlist Items Endpoints
# =============================================================================

@router.get("/{watchlist_id}/items")
async def get_watchlist_items(
    watchlist_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """
    관심종목 리스트의 항목들 조회

    Args:
        watchlist_id: 관심종목 리스트 ID

    Returns:
        관심종목 항목 리스트 (가격 정보 포함)
    """
    try:
        user_id = current_user.get("user_id")
        items = WatchlistService.get_watchlist_items(db, watchlist_id, user_id)
        return {"success": True, "data": items}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch watchlist items: {str(e)}"
        )


@router.post("/{watchlist_id}/items")
async def add_ticker_to_watchlist(
    watchlist_id: str,
    request: AddTickerRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """
    관심종목 리스트에 종목 추가

    Args:
        watchlist_id: 관심종목 리스트 ID
        request: 추가 요청 데이터

    Returns:
        추가된 항목
    """
    try:
        user_id = current_user.get("user_id")
        item = WatchlistService.add_ticker_to_watchlist(
            db,
            watchlist_id,
            user_id,
            request.ticker_cd,
            request.notes
        )

        if not item:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Ticker already exists in watchlist or watchlist not found"
            )

        return {"success": True, "data": item}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to add ticker to watchlist: {str(e)}"
        )


@router.delete("/{watchlist_id}/items/{ticker_cd}")
async def remove_ticker_from_watchlist(
    watchlist_id: str,
    ticker_cd: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """
    관심종목 리스트에서 종목 제거

    Args:
        watchlist_id: 관심종목 리스트 ID
        ticker_cd: 종목 코드

    Returns:
        성공 메시지
    """
    try:
        user_id = current_user.get("user_id")
        success = WatchlistService.remove_ticker_from_watchlist(
            db,
            watchlist_id,
            user_id,
            ticker_cd
        )

        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Ticker not found in watchlist or watchlist not found"
            )

        return {"success": True, "message": "Ticker removed successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to remove ticker from watchlist: {str(e)}"
        )


@router.put("/{watchlist_id}/items/reorder")
async def reorder_watchlist_items(
    watchlist_id: str,
    request: ReorderItemsRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """
    관심종목 항목 순서 변경

    Args:
        watchlist_id: 관심종목 리스트 ID
        request: 순서 변경 요청 데이터

    Returns:
        성공 메시지
    """
    try:
        user_id = current_user.get("user_id")
        success = WatchlistService.reorder_watchlist_items(
            db,
            watchlist_id,
            user_id,
            request.ticker_orders
        )

        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Watchlist not found"
            )

        return {"success": True, "message": "Items reordered successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to reorder items: {str(e)}"
        )

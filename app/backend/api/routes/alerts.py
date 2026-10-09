"""
알림 시스템 API
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from decimal import Decimal

from app.backend.api.deps import route_handler
from data_fetcher.core import OBBject
from app.backend.core.db import get_db
from app.backend.core.auth.dependencies import get_current_active_user
from app.backend.services.alert_service import AlertService
from index_analyzer.models.orm import User

router = APIRouter(prefix="/alerts", tags=["Alerts"])

_PROVIDER = "db"


# Request/Response Models
class AlertCreate(BaseModel):
    alert_type: str  # price, news, technical
    ticker_cd: Optional[str] = None
    condition_type: str  # above, below, percent_change
    threshold_value: Decimal
    notification_method: str = "email"
    message: Optional[str] = None


class AlertUpdate(BaseModel):
    threshold_value: Optional[Decimal] = None
    is_active: Optional[bool] = None
    notification_method: Optional[str] = None
    message: Optional[str] = None


@router.post("/", status_code=status.HTTP_201_CREATED)
@route_handler
def create_alert(
    alert_data: AlertCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    새 알림 생성
    """
    alert = AlertService.create_alert(
        db=db,
        user_id=current_user.user_id,
        alert_type=alert_data.alert_type,
        ticker_cd=alert_data.ticker_cd,
        condition_type=alert_data.condition_type,
        threshold_value=alert_data.threshold_value,
        notification_method=alert_data.notification_method,
        message=alert_data.message
    )

    return OBBject(results=[alert.to_dict()], provider=_PROVIDER)


@router.get("/")
@route_handler
def get_my_alerts(
    is_active: Optional[bool] = None,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    내 알림 목록 조회
    """
    alerts = AlertService.get_user_alerts(db, current_user.user_id, is_active)
    return OBBject(results=[a.to_dict() for a in alerts], provider=_PROVIDER)


@router.put("/{alert_id}")
@route_handler
def update_alert(
    alert_id: str,
    alert_data: AlertUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    알림 업데이트
    """
    updates = alert_data.dict(exclude_unset=True)

    alert = AlertService.update_alert(
        db, alert_id, current_user.user_id, **updates
    )

    if not alert:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Alert not found"
        )

    return OBBject(results=[alert.to_dict()], provider=_PROVIDER)


@router.post("/{alert_id}/toggle")
@route_handler
def toggle_alert(
    alert_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    알림 활성화/비활성화
    """
    alert = AlertService.toggle_alert(db, alert_id, current_user.user_id)

    if not alert:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Alert not found"
        )

    return OBBject(results=[alert.to_dict()], provider=_PROVIDER)


@router.delete("/{alert_id}")
@route_handler
def delete_alert(
    alert_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    알림 삭제
    """
    success = AlertService.delete_alert(db, alert_id, current_user.user_id)

    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Alert not found"
        )

    return OBBject(results=[], provider=_PROVIDER, metadata={"deleted": alert_id})


@router.get("/history")
@route_handler
def get_alert_history(
    alert_id: Optional[str] = None,
    limit: int = 50,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    알림 발생 이력 조회

    Args:
        alert_id: 특정 알림 ID (선택사항)
        limit: 조회 개수 제한 (기본 50)
    """
    history = AlertService.get_alert_history(
        db, current_user.user_id, alert_id, limit
    )

    return OBBject(results=history, provider=_PROVIDER, metadata={"count": len(history)})


@router.post("/{alert_id}/test")
@route_handler
def test_alert(
    alert_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    알림 테스트 발송
    """
    result = AlertService.test_alert(db, alert_id, current_user.user_id)

    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Alert not found"
        )

    return OBBject(results=[result], provider=_PROVIDER)

"""위젯 설정 API — 설정 화면(/settings?tab=widgets)과 위젯 메뉴가 쓴다.

    GET    /api/user-widgets/codes      코드값·위젯 종류·화면 변수 (설정 화면의 선택지)
    GET    /api/user-widgets/prefs      기본 제공 위젯의 내 설정 (기본값과 다른 것만)
    PUT    /api/user-widgets/prefs/{widget_type}   사용 여부·내놓을 화면
    GET    /api/user-widgets[?screen=]  내 위젯. screen 을 주면 그 화면에 내놓은 것만
    POST   /api/user-widgets            만들기
    PUT    /api/user-widgets/{id}       부분 수정 (안 보낸 항목은 그대로)
    DELETE /api/user-widgets/{id}

위젯 종류 목록을 고치는 건 관리자만 — /api/admin/widget-types (routes/admin.py).

API 목록·파라미터·응답 필드는 여기서 다시 만들지 않는다 — 게이트웨이가 이미 준다:
    GET /api/data/                           provider·model 목록
    GET /api/data/{provider}/{model}/schema  파라미터 폼 스펙 + 응답 필드
"""
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.backend.core.auth.dependencies import get_current_user
from app.backend.core.db import get_db
from app.backend.models.orm import User
from app.backend.services.user_widget_service import (
    UserWidgetError, UserWidgetService, WidgetPrefService, get_codes, serialize,
)

router = APIRouter(prefix="/user-widgets", tags=["user-widgets"])


class ParamIn(BaseModel):
    param_name: str = Field(..., max_length=100)
    bind_type: str
    param_value: Optional[str] = Field(None, max_length=500)
    var_name: Optional[str] = None


class FieldIn(BaseModel):
    field_name: str = Field(..., max_length=100)
    field_role: str = "COLUMN"
    label: Optional[str] = Field(None, max_length=200)
    format: str = "auto"


class WidgetCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = Field(None, max_length=500)
    group_name: Optional[str] = Field(None, max_length=100)
    provider: str
    model: str
    view_type: str = "table"
    use_yn: str = "Y"
    sort_seq: int = 0
    params: List[ParamIn] = []
    fields: List[FieldIn] = []
    screens: List[str] = []


class WidgetUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = Field(None, max_length=500)
    group_name: Optional[str] = Field(None, max_length=100)
    provider: Optional[str] = None
    model: Optional[str] = None
    view_type: Optional[str] = None
    use_yn: Optional[str] = None
    sort_seq: Optional[int] = None
    params: Optional[List[ParamIn]] = None
    fields: Optional[List[FieldIn]] = None
    screens: Optional[List[str]] = None


class PrefIn(BaseModel):
    use_yn: Optional[str] = None
    screens: Optional[List[str]] = None


@router.get("/codes")
def codes(_: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return get_codes(db)


@router.get("/prefs")
def list_prefs(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return {"prefs": WidgetPrefService.list(db, current_user.user_id)}


@router.put("/prefs/{widget_type}")
def set_pref(
    widget_type: str,
    body: PrefIn,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        return WidgetPrefService.set(db, current_user.user_id, widget_type, body.use_yn, body.screens)
    except UserWidgetError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("")
def list_widgets(
    screen: Optional[str] = Query(None, description="화면 경로 — 주면 그 화면에 내놓은 위젯만"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    rows = UserWidgetService.list(db, current_user.user_id, screen)
    return {"widgets": serialize(db, rows)}


@router.post("", status_code=201)
def create_widget(
    body: WidgetCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        w = UserWidgetService.create(db, current_user.user_id, body.model_dump())
    except UserWidgetError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return serialize(db, [w])[0]


@router.put("/{widget_id}")
def update_widget(
    widget_id: str,
    body: WidgetUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        w = UserWidgetService.update(
            db, current_user.user_id, widget_id, body.model_dump(exclude_unset=True),
        )
    except UserWidgetError as e:
        raise HTTPException(status_code=400, detail=str(e))
    if not w:
        raise HTTPException(status_code=404, detail="Widget not found")
    return serialize(db, [w])[0]


@router.delete("/{widget_id}", status_code=204)
def delete_widget(
    widget_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not UserWidgetService.delete(db, current_user.user_id, widget_id):
        raise HTTPException(status_code=404, detail="Widget not found")

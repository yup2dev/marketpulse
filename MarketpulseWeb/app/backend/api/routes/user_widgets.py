"""위젯 설정 API — 설정 화면(/settings?tab=widgets)과 위젯 메뉴가 쓴다.

    GET    /api/user-widgets/codes      코드값·위젯 종류·화면 변수 (설정 화면의 선택지)
    GET    /api/user-widgets/catalog    고를 수 있는 데이터 (provider, model) 목록 — DB 카탈로그
    GET    /api/user-widgets/catalog/{provider}/{model}   그 데이터의 파라미터 · 응답 필드
    GET    /api/user-widgets/builtin    기본 제공 위젯의 정의 (모든 사용자 공통 — 홈 위젯 등)
    GET    /api/user-widgets/prefs      기본 제공 위젯의 내 설정 (기본값과 다른 것만)
    PUT    /api/user-widgets/prefs/{widget_type}   사용 여부·내놓을 화면
    GET    /api/user-widgets[?screen=]  내 위젯. screen 을 주면 그 화면에 내놓은 것만
    POST   /api/user-widgets            만들기
    PUT    /api/user-widgets/{id}       부분 수정 (안 보낸 항목은 그대로)
    DELETE /api/user-widgets/{id}

위젯 종류 목록을 고치는 건 관리자만 — /api/admin/widget-types (routes/admin.py).

카탈로그(services/data_catalog)는 Fetcher 등록 정보를 기동할 때 DB 에 적은 것이다. 동적 선택지
(dynamic_yn=Y)와 지금 막 바뀐 스키마는 게이트웨이가 그때그때 준다:
    GET /api/data/{provider}/{model}/schema  파라미터 폼 스펙 + 응답 필드
"""
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.backend.core.auth.dependencies import get_current_user
from app.backend.core.db import get_db
from app.backend.models.orm import User
from app.backend.services import data_catalog
from app.backend.services.user_widget_service import (
    BuiltinWidgetService, ScreenGroupService, UserWidgetError, UserWidgetService, WidgetPrefService,
    get_codes, serialize,
)
from app.backend.platform.obbject import OBBject

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
    origin_widget_id: Optional[str] = Field(None, max_length=50)   # 고쳐 저장한 원본 위젯 (복사)


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


@router.get("/catalog")
def list_catalog(_: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return {"items": data_catalog.list_catalog(db)}


@router.get("/catalog/{provider}/{model}")
def get_catalog_entry(provider: str, model: str, _: User = Depends(get_current_user),
                      db: Session = Depends(get_db)):
    entry = data_catalog.get_entry(db, provider, model)
    if entry is None:
        raise HTTPException(status_code=404, detail=f"'{provider}/{model}' 은(는) 카탈로그에 없습니다")
    return entry


@router.get("/builtin")
def list_builtin(_: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return {"widgets": BuiltinWidgetService.list(db)}


class ScreenGroupOut(BaseModel):
    screen: str = Field(description="화면 경로 (예: /industry)")
    tab: str = Field(description="탭 — 탭이 없으면 ''")
    group_code: str = Field(description="그룹 코드 (예: dataset)")
    widget_id: str = Field(description="그룹에 묶인 위젯")
    param_name: str = Field(description="그 위젯에서의 파라미터 이름")
    is_source: bool = Field(description="행을 누르면 값을 내보내는 위젯")
    is_required: bool = Field(default=True, description="값이 생길 때까지 요청하지 않는다 (False 면 비어도 부른다)")


@router.get("/screen-groups", summary="화면 단위 파라미터 그룹")
def list_screen_groups(
    _: User = Depends(get_current_user), db: Session = Depends(get_db),
) -> OBBject[List[ScreenGroupOut]]:
    """OpenBB apps.json 의 groups — 한 화면(+탭)의 위젯들이 같이 따르는 파라미터."""
    return OBBject[List[ScreenGroupOut]](results=ScreenGroupService.list(db), provider="registry")


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

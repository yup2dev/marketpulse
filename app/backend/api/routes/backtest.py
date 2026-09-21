"""
Backtest Lab API Routes
사용자별 백테스트 정의(변수·이벤트·전략)와 실행 결과 저장.

계산(수식 평가·이벤트 탐지·백테스트)은 브라우저 엔진이 수행하고, 서버는 정의와 결과
스냅샷만 저장한다 — 작은 운영 서버의 메모리를 쓰지 않기 위해서다. 그래서 요청 크기와
사용자당 저장 개수에 상한을 둔다.

응답은 프로젝트 표준인 OBBject(`{results, provider, metadata}`)로 통일한다.
단건도 `results` 리스트에 담는다 — 프론트가 엔드포인트마다 다른 껍데기를 알 필요가 없다.

핸들러는 `def`(동기)다. DB만 쓰고 await 할 것이 없으므로 `async def` 로 두면 동기
SQLAlchemy 쿼리가 이벤트 루프를 막는다. `def` 면 FastAPI 가 스레드풀에서 돌린다.
"""
import json
import re
import uuid
from typing import Any, Dict, List, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.backend.api.deps import route_handler
from app.backend.core.auth.dependencies import get_current_active_user
from app.backend.core.db import get_db
from data_fetcher.core.obbject import OBBject
from index_analyzer.models.orm import User, UserBacktestItem, UserBacktestRun

router = APIRouter(prefix="/backtest", tags=["backtest"])

Kind = Literal["variable", "event", "strategy"]

# 응답 provider 라벨 — 프론트는 모든 엔드포인트에서 res.results 로 읽는다.
_PROVIDER = "backtest"

# 수식에서 이름으로 참조되므로 식별자 규칙을 강제한다(strategy 는 표시용 이름이라 자유).
_IDENT_RE = re.compile(r"^[a-z_][a-z0-9_]{0,39}$")
_MAX_SPEC_BYTES = 20_000
_MAX_ITEMS_PER_KIND = 200
_MAX_RUNS = 100
_MAX_RUN_POINTS = 1_000


class ItemRequest(BaseModel):
    kind: Kind
    name: str = Field(min_length=1, max_length=80)
    description: Optional[str] = Field(default=None, max_length=500)
    spec: Dict[str, Any] = Field(default_factory=dict)


class ItemUpdateRequest(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=80)
    description: Optional[str] = Field(default=None, max_length=500)
    spec: Optional[Dict[str, Any]] = None


class RunRequest(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    strategy_id: Optional[str] = None
    config: Dict[str, Any] = Field(default_factory=dict)
    metrics: Dict[str, Any] = Field(default_factory=dict)
    equity: List[Dict[str, Any]] = Field(default_factory=list, max_length=_MAX_RUN_POINTS)
    trades: List[Dict[str, Any]] = Field(default_factory=list, max_length=_MAX_RUN_POINTS)


def _check_name(kind: str, name: str) -> str:
    name = name.strip()
    if kind in ("variable", "event") and not _IDENT_RE.match(name):
        raise HTTPException(
            status_code=400,
            detail="이름은 영문 소문자로 시작하고 소문자·숫자·밑줄만 쓸 수 있습니다(최대 40자) — 수식에서 참조됩니다",
        )
    return name


def _dump(obj: Any, limit: int, label: str) -> str:
    raw = json.dumps(obj, ensure_ascii=False, separators=(",", ":"))
    if len(raw.encode("utf-8")) > limit:
        raise HTTPException(status_code=413, detail=f"{label} 크기가 너무 큽니다")
    return raw


def _name_taken(db: Session, user_id: str, kind: str, name: str, exclude_id: Optional[str] = None) -> bool:
    q = db.query(UserBacktestItem).filter(
        UserBacktestItem.user_id == user_id,
        UserBacktestItem.kind == kind,
        UserBacktestItem.name == name,
    )
    if exclude_id:
        q = q.filter(UserBacktestItem.item_id != exclude_id)
    return db.query(q.exists()).scalar()


def _get_item(db: Session, user_id: str, item_id: str) -> UserBacktestItem:
    item = db.query(UserBacktestItem).filter(
        UserBacktestItem.item_id == item_id,
        UserBacktestItem.user_id == user_id,
    ).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    return item


# ── 정의(변수·이벤트·전략) ──────────────────────────────────────────────────────

@router.get("/items")
@route_handler
def list_items(
    kind: Optional[Kind] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> OBBject:
    q = db.query(UserBacktestItem).filter(UserBacktestItem.user_id == current_user.user_id)
    if kind:
        q = q.filter(UserBacktestItem.kind == kind)
    items = q.order_by(UserBacktestItem.kind, UserBacktestItem.name).all()
    return OBBject(results=[i.to_dict() for i in items], provider=_PROVIDER)


@router.post("/items")
@route_handler
def create_item(
    request: ItemRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> OBBject:
    name = _check_name(request.kind, request.name)
    count = db.query(UserBacktestItem).filter(
        UserBacktestItem.user_id == current_user.user_id,
        UserBacktestItem.kind == request.kind,
    ).count()
    if count >= _MAX_ITEMS_PER_KIND:
        raise HTTPException(status_code=400, detail=f"{request.kind}는 최대 {_MAX_ITEMS_PER_KIND}개까지 저장할 수 있습니다")
    if _name_taken(db, current_user.user_id, request.kind, name):
        raise HTTPException(status_code=409, detail=f"같은 이름의 {request.kind}가 이미 있습니다: {name}")

    item = UserBacktestItem(
        item_id=str(uuid.uuid4()),
        user_id=current_user.user_id,
        kind=request.kind,
        name=name,
        description=request.description,
        spec=_dump(request.spec, _MAX_SPEC_BYTES, "spec"),
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return OBBject(results=[item.to_dict()], provider=_PROVIDER)


@router.put("/items/{item_id}")
@route_handler
def update_item(
    item_id: str,
    request: ItemUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> OBBject:
    item = _get_item(db, current_user.user_id, item_id)
    if request.name is not None:
        name = _check_name(item.kind, request.name)
        if _name_taken(db, current_user.user_id, item.kind, name, exclude_id=item.item_id):
            raise HTTPException(status_code=409, detail=f"같은 이름의 {item.kind}가 이미 있습니다: {name}")
        item.name = name
    if request.description is not None:
        item.description = request.description
    if request.spec is not None:
        item.spec = _dump(request.spec, _MAX_SPEC_BYTES, "spec")
    db.commit()
    db.refresh(item)
    return OBBject(results=[item.to_dict()], provider=_PROVIDER)


@router.delete("/items/{item_id}")
@route_handler
def delete_item(
    item_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> OBBject:
    item = _get_item(db, current_user.user_id, item_id)
    db.delete(item)
    db.commit()
    return OBBject(results=[], provider=_PROVIDER, metadata={"deleted": item_id})


# ── 실행 결과 ──────────────────────────────────────────────────────────────────

@router.get("/runs")
@route_handler
def list_runs(
    strategy_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> OBBject:
    q = db.query(UserBacktestRun).filter(UserBacktestRun.user_id == current_user.user_id)
    if strategy_id:
        q = q.filter(UserBacktestRun.strategy_id == strategy_id)
    runs = q.order_by(UserBacktestRun.created_at.desc()).all()
    return OBBject(results=[r.to_dict(full=False) for r in runs], provider=_PROVIDER)


@router.get("/runs/{run_id}")
@route_handler
def get_run(
    run_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> OBBject:
    run = db.query(UserBacktestRun).filter(
        UserBacktestRun.run_id == run_id,
        UserBacktestRun.user_id == current_user.user_id,
    ).first()
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    return OBBject(results=[run.to_dict()], provider=_PROVIDER)


@router.post("/runs")
@route_handler
def save_run(
    request: RunRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> OBBject:
    count = db.query(UserBacktestRun).filter(UserBacktestRun.user_id == current_user.user_id).count()
    if count >= _MAX_RUNS:
        raise HTTPException(status_code=400, detail=f"실행 결과는 최대 {_MAX_RUNS}개까지 저장됩니다 — 오래된 결과를 삭제하세요")
    run = UserBacktestRun(
        run_id=str(uuid.uuid4()),
        user_id=current_user.user_id,
        strategy_id=request.strategy_id,
        name=request.name,
        config=_dump(request.config, _MAX_SPEC_BYTES, "config"),
        metrics=_dump(request.metrics, _MAX_SPEC_BYTES, "metrics"),
        equity=_dump(request.equity, 200_000, "equity"),
        trades=_dump(request.trades, 200_000, "trades"),
    )
    db.add(run)
    db.commit()
    db.refresh(run)
    return OBBject(results=[run.to_dict()], provider=_PROVIDER)


@router.delete("/runs/{run_id}")
@route_handler
def delete_run(
    run_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> OBBject:
    run = db.query(UserBacktestRun).filter(
        UserBacktestRun.run_id == run_id,
        UserBacktestRun.user_id == current_user.user_id,
    ).first()
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    db.delete(run)
    db.commit()
    return OBBject(results=[], provider=_PROVIDER, metadata={"deleted": run_id})

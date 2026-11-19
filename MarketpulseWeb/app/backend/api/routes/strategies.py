"""포트폴리오 전략 API — 웹에서 전략을 만들고 고치고, 서버가 바로 백테스트한다.

    GET    /api/strategies                 기본 제공 + 내 전략 (metadata: 선택지 catalog · 패널 상태)
    POST   /api/strategies                 새 전략
    PUT    /api/strategies/{strategy_id}   내 전략 고치기 (기본 제공은 복제해서 고친다)
    DELETE /api/strategies/{strategy_id}   내 전략 지우기
    GET    /api/strategies/result          백테스트 실행 결과 (백테스트 결과 위젯이 그리는 실행 모양)
           ?strategy=&start=&end=&benchmark=^GSPC|equal&cost=10
    GET    /api/strategies/compare         같은 조건으로 전략마다 실행한 손익 (전략별 손익 위젯)
           ?start=&end=&benchmark=&cost=  (전략은 고르지 않는다 — 위젯이 고른 것만 그린다)

계산 재료(월별 패널)는 로컬 배치가 적재한다 — services/quant_strategy_service.py.
"""
from datetime import date
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.backend.api.deps import route_handler
from app.backend.core.auth.dependencies import get_current_active_user
from app.backend.core.db import get_db
from app.backend.models.orm import User
from app.backend.services import quant_strategy_service as svc
from data_fetcher.core.obbject import OBBject

router = APIRouter(prefix="/strategies", tags=["strategies"])

PROVIDER = "db"   # 패널은 배치가 적재한 DB 값 — 출처 표기


class FactorWeight(BaseModel):
    factor_id: str
    weight: float = 1.0


class StrategyBody(BaseModel):
    name: str = Field(..., max_length=100)
    description: Optional[str] = Field(None, max_length=300)
    score_kind: str = "factor"
    model: Optional[str] = None
    factors: List[FactorWeight] = []
    top_n: int = 30
    rebalance: str = "M"


def _errors(fn):
    """서비스 예외 → HTTP (찾을 수 없음 404 · 기본 제공 수정 403)."""
    try:
        return fn()
    except LookupError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))


@router.get("")
@route_handler
def list_strategies(db: Session = Depends(get_db), user: User = Depends(get_current_active_user)) -> OBBject:
    uid = str(user.user_id)
    rows = svc.list_strategies(db, uid)
    status = svc.panel_status(svc.load_panel(db, "sp500"))
    return OBBject(
        results=[svc.to_dict(r, uid) for r in rows],
        provider=PROVIDER,
        metadata={**svc.catalog(), "panel": status, "default": svc.DEFAULT_STRATEGY},
    )


@router.get("/result")
@route_handler
def strategy_result(
    strategy: Optional[str] = Query(None, description="전략 id — 비우면 첫 기본 제공 전략"),
    start: Optional[date] = Query(None),
    end: Optional[date] = Query(None),
    benchmark: str = Query("^GSPC", description="^GSPC | equal"),
    cost: float = Query(10.0, ge=0, le=svc.MAX_COST_BPS, description="편도 거래비용 (bp)"),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_active_user),
) -> OBBject:
    result, status = _errors(lambda: svc.backtest(db, str(user.user_id), strategy, start, end, benchmark or "^GSPC", cost))
    return OBBject(results=[result] if result else [], provider=PROVIDER, metadata={"panel": status})


@router.get("/compare")
@route_handler
def strategy_compare(
    start: Optional[date] = Query(None),
    end: Optional[date] = Query(None),
    benchmark: str = Query("^GSPC", description="^GSPC | equal"),
    cost: float = Query(10.0, ge=0, le=svc.MAX_COST_BPS, description="편도 거래비용 (bp)"),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_active_user),
) -> OBBject:
    """같은 조건으로 전략마다 실행한 손익 (기본 제공 + 내 전략) — 전략별 손익 위젯."""
    rows, status = svc.compare(db, str(user.user_id), start, end, benchmark or "^GSPC", cost)
    return OBBject(results=rows, provider=PROVIDER, metadata={"panel": status})


@router.post("")
@route_handler
def create_strategy(body: StrategyBody, db: Session = Depends(get_db),
                    user: User = Depends(get_current_active_user)) -> OBBject:
    uid = str(user.user_id)
    row = svc.create_strategy(db, uid, body.model_dump())
    return OBBject(results=[svc.to_dict(row, uid)], provider=PROVIDER)


@router.put("/{strategy_id}")
@route_handler
def update_strategy(strategy_id: str, body: StrategyBody, db: Session = Depends(get_db),
                    user: User = Depends(get_current_active_user)) -> OBBject:
    uid = str(user.user_id)
    row = _errors(lambda: svc.update_strategy(db, uid, strategy_id, body.model_dump()))
    return OBBject(results=[svc.to_dict(row, uid)], provider=PROVIDER)


@router.delete("/{strategy_id}")
@route_handler
def delete_strategy(strategy_id: str, db: Session = Depends(get_db),
                    user: User = Depends(get_current_active_user)) -> OBBject:
    _errors(lambda: svc.delete_strategy(db, str(user.user_id), strategy_id))
    return OBBject(results=[{"deleted": strategy_id}], provider=PROVIDER)

"""퀀트 포트폴리오 API — 유니버스 안에서 직접 고른 종목 · 비중 · 리밸런싱 (전략과 무관).

    GET    /api/quant-portfolios                  내 포트폴리오 (metadata: 선택지 catalog)
    GET    /api/quant-portfolios/universe         고를 수 있는 종목 (?universe=sp500) — 이름 · 섹터 · 시가총액 · 변동성
    POST   /api/quant-portfolios                  새 포트폴리오
    PUT    /api/quant-portfolios/{portfolio_id}   고치기
    DELETE /api/quant-portfolios/{portfolio_id}   지우기

백테스트는 전략과 같은 길로 본다: /api/strategies/result?strategy=pf:<portfolio_id>.
"""
from typing import List, Optional

from app.backend.platform import OBBject, Router
from fastapi import Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.backend.core.auth.dependencies import get_current_active_user
from app.backend.core.db import get_db
from app.backend.models.orm import User
from app.backend.commands.strategies import portfolios as svc

router = Router(prefix="/quant-portfolios", tags=["quant-portfolios"])
PROVIDER = "db"


class Item(BaseModel):
    symbol: str = Field(..., max_length=20)
    weight: Optional[float] = None


class PortfolioBody(BaseModel):
    name: str = Field(..., max_length=100)
    universe: str = "sp500"
    weighting: str = "equal"
    cash_pct: float = 0.0
    rebalance: str = "Q"
    cost_bps: float = 10.0
    items: List[Item] = []


def _own(fn):
    try:
        return fn()
    except LookupError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.command(path="", methods=["GET"])
def list_portfolios(db: Session = Depends(get_db), user: User = Depends(get_current_active_user)) -> OBBject:
    rows = svc.list_portfolios(db, str(user.user_id))
    return OBBject(results=[svc.to_dict(r) for r in rows], provider=PROVIDER, metadata=svc.catalog())


@router.command(path="/universe", methods=["GET"])
def universe(universe: str = Query("sp500", max_length=30), db: Session = Depends(get_db),
             user: User = Depends(get_current_active_user)) -> OBBject:
    rows, meta = svc.universe_members(db, universe)
    return OBBject(results=rows, provider=PROVIDER, metadata={**meta, "universe": universe})


@router.command(path="", methods=["POST"])
def create_portfolio(body: PortfolioBody, db: Session = Depends(get_db),
                     user: User = Depends(get_current_active_user)) -> OBBject:
    row = svc.create_portfolio(db, str(user.user_id), body.model_dump())
    return OBBject(results=[svc.to_dict(row)], provider=PROVIDER)


@router.command(path="/{portfolio_id}", methods=["PUT"])
def update_portfolio(portfolio_id: str, body: PortfolioBody, db: Session = Depends(get_db),
                     user: User = Depends(get_current_active_user)) -> OBBject:
    row = _own(lambda: svc.update_portfolio(db, str(user.user_id), portfolio_id, body.model_dump()))
    return OBBject(results=[svc.to_dict(row)], provider=PROVIDER)


@router.command(path="/{portfolio_id}", methods=["DELETE"])
def delete_portfolio(portfolio_id: str, db: Session = Depends(get_db),
                     user: User = Depends(get_current_active_user)) -> OBBject:
    _own(lambda: svc.delete_portfolio(db, str(user.user_id), portfolio_id))
    return OBBject(results=[{"deleted": portfolio_id}], provider=PROVIDER)

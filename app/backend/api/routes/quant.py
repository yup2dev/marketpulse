"""
Quant Strategy API Routes
- POST /api/quant/analyze        — single-ticker strategy backtest
- POST /api/quant/scan           — parameter sweep / optimizer
- GET  /api/quant/strategies     — user's saved strategy notes
- POST /api/quant/strategies     — create strategy note
- PUT  /api/quant/strategies/{id} — update
- DELETE /api/quant/strategies/{id} — delete
"""
import json
import logging
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Any, Dict, List, Optional
from sqlalchemy.orm import Session

from app.backend.services import quant_service
from app.backend.database.db_dependency import get_db
from app.backend.auth.dependencies import get_current_user
from index_analyzer.models.quant_strategy import QuantStrategy

log = logging.getLogger(__name__)
router = APIRouter()


# ─── Pydantic Models ──────────────────────────────────────────────────────────

class StrategyConfig(BaseModel):
    model_config = {"extra": "allow"}   # pass-through buy/sell condition blocks

    type: str = "ema_cross"
    # Preset params (optional — none when type=custom)
    fast: Optional[int] = None
    slow: Optional[int] = None
    rsi_period: Optional[int] = None
    oversold: Optional[float] = None
    overbought: Optional[float] = None
    signal: Optional[int] = None
    period: Optional[int] = None
    std_dev: Optional[float] = None
    # Custom block strategy
    buy_conditions: Optional[List] = None
    sell_conditions: Optional[List] = None
    buy_logic: Optional[str] = "AND"
    sell_logic: Optional[str] = "OR"
    # Risk
    stop_loss_pct: Optional[float] = 0.0
    take_profit_pct: Optional[float] = 0.0
    initial_capital: Optional[float] = 10000.0


class QuantAnalyzeRequest(BaseModel):
    ticker: str
    start_date: str
    end_date: str
    strategy: StrategyConfig


class ParamRange(BaseModel):
    min: float
    max: float
    step: float = 1.0


class ScanRequest(BaseModel):
    ticker: str
    start_date: str
    end_date: str
    strategy_type: str = "ema_cross"
    param_ranges: Dict[str, ParamRange]
    stop_loss_pct: float = 0.0
    take_profit_pct: float = 0.0
    initial_capital: float = 10000.0


class StrategyNoteCreate(BaseModel):
    name: str
    strategy_type: str = "custom"
    formula: Optional[str] = None
    variables: Optional[str] = None   # JSON string
    buy_condition: Optional[str] = None
    sell_condition: Optional[str] = None
    parameters: Optional[str] = None  # JSON string
    notes: Optional[str] = None


# ─── Backtest Endpoint ────────────────────────────────────────────────────────

@router.post("/analyze")
async def quant_analyze(request: QuantAnalyzeRequest):
    try:
        result = await quant_service.analyze(
            ticker=request.ticker,
            start_date=request.start_date,
            end_date=request.end_date,
            strategy=request.strategy.model_dump(),
        )
        return {"data": result}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        log.error(f"Quant analyze error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# ─── Scanner Endpoint ─────────────────────────────────────────────────────────

@router.post("/scan")
async def quant_scan(request: ScanRequest):
    try:
        param_ranges = {k: v.model_dump() for k, v in request.param_ranges.items()}
        result = await quant_service.scan(
            ticker=request.ticker,
            start_date=request.start_date,
            end_date=request.end_date,
            strategy_type=request.strategy_type,
            param_ranges=param_ranges,
            stop_loss_pct=request.stop_loss_pct,
            take_profit_pct=request.take_profit_pct,
            initial_capital=request.initial_capital,
        )
        return {"data": result}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        log.error(f"Quant scan error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# ─── Strategy CRUD ────────────────────────────────────────────────────────────

@router.get("/strategies")
def list_strategies(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    strategies = (
        db.query(QuantStrategy)
        .filter(QuantStrategy.user_id == current_user.user_id)
        .order_by(QuantStrategy.created_at.desc())
        .all()
    )
    return {"data": [s.to_dict() for s in strategies]}


@router.post("/strategies")
def create_strategy(
    body: StrategyNoteCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    strategy = QuantStrategy(
        user_id=current_user.user_id,
        name=body.name,
        strategy_type=body.strategy_type,
        formula=body.formula,
        variables=body.variables,
        buy_condition=body.buy_condition,
        sell_condition=body.sell_condition,
        parameters=body.parameters,
        notes=body.notes,
    )
    db.add(strategy)
    db.commit()
    db.refresh(strategy)
    return {"data": strategy.to_dict()}


@router.put("/strategies/{strategy_id}")
def update_strategy(
    strategy_id: int,
    body: StrategyNoteCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    strategy = (
        db.query(QuantStrategy)
        .filter(QuantStrategy.id == strategy_id, QuantStrategy.user_id == current_user.user_id)
        .first()
    )
    if not strategy:
        raise HTTPException(status_code=404, detail="Strategy not found")
    for field, val in body.model_dump(exclude_unset=True).items():
        setattr(strategy, field, val)
    db.commit()
    db.refresh(strategy)
    return {"data": strategy.to_dict()}


@router.delete("/strategies/{strategy_id}")
def delete_strategy(
    strategy_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    strategy = (
        db.query(QuantStrategy)
        .filter(QuantStrategy.id == strategy_id, QuantStrategy.user_id == current_user.user_id)
        .first()
    )
    if not strategy:
        raise HTTPException(status_code=404, detail="Strategy not found")
    db.delete(strategy)
    db.commit()
    return {"message": "deleted"}

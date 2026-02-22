"""
Backtest API Routes
Endpoints for portfolio backtesting and performance analytics
"""
import logging
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Optional, Dict
from sqlalchemy.orm import Session

from app.backend.services.backtest_service import backtest_service
from app.backend.database.db_dependency import get_db

log = logging.getLogger(__name__)
router = APIRouter()


class BacktestRequest(BaseModel):
    """Request model for running a backtest"""
    symbols: List[str]
    weights: Optional[Dict[str, float]] = None  # symbol → weight_pct (0-100); if None → equal weight
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    rebalancing_period: Optional[str] = 'monthly'
    initial_capital: Optional[float] = 10000.0
    benchmark_symbol: Optional[str] = 'SPY'


@router.get("/universe/{universe_id}")
async def get_universe_stocks(universe_id: str):
    """
    Get stocks from a predefined universe

    Universe IDs: sp500, nasdaq100, dow30
    """
    try:
        stocks = await backtest_service.get_universe_stocks(universe_id)
        if not stocks:
            raise HTTPException(status_code=404, detail=f"No stocks found for universe {universe_id}")
        return {"universe": universe_id, "stocks": stocks}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/run")
async def run_backtest(request: BacktestRequest):
    """
    Run a backtest on selected stocks

    Returns portfolio performance, statistics, and yearly returns
    """
    try:
        if not request.symbols:
            raise HTTPException(status_code=400, detail="No symbols provided")

        if not request.start_date or not request.end_date:
            raise HTTPException(status_code=400, detail="start_date and end_date are required")

        results = await backtest_service.run_backtest(
            symbols=request.symbols,
            weights=request.weights,
            start_date=request.start_date,
            end_date=request.end_date,
            rebalancing_period=request.rebalancing_period,
            initial_capital=request.initial_capital,
            benchmark_symbol=request.benchmark_symbol
        )

        # Format response to match frontend expectations
        return {
            'data': {
                'portfolio_values': results['portfolio_values'],
                'benchmark_values': results['benchmark_values'],
                'statistics': results['statistics'],
                'yearly_returns': results['yearly_returns']
            }
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/universes")
async def list_universes(db: Session = Depends(get_db)):
    """List available stock universes from database"""
    try:
        from index_analyzer.models.database import MBS_IN_INDX_STBD
        from data_fetcher.fetchers.database.index_constituents import DBIndexConstituentsFetcher

        # Query active universes from database
        universes_db = db.query(MBS_IN_INDX_STBD).filter_by(
            indx_type='universe',
            is_active=True
        ).order_by(MBS_IN_INDX_STBD.display_order).all()

        universes = []
        for universe in universes_db:
            try:
                # Fetch constituents from DB to get current count
                constituents = await DBIndexConstituentsFetcher.fetch_data({'index': universe.indx_cd})
                count = len(constituents) if constituents else 0

                universes.append({
                    "id": universe.indx_cd,
                    "name": universe.indx_nm,
                    "description": universe.description,
                    "category": universe.category,
                    "count": count
                })
            except Exception as e:
                # Fallback to 0 count if fetch fails
                log.warning(f"Error fetching constituents for {universe.indx_cd}: {e}")
                universes.append({
                    "id": universe.indx_cd,
                    "name": universe.indx_nm,
                    "description": universe.description,
                    "category": universe.category,
                    "count": 0
                })

        return {"universes": universes}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

"""
Quantitative Analysis API Routes
yfinance 시계열 위에서 통계 분석을 수행하는 엔드포인트.
"""
import logging
from datetime import date as date_type
from typing import Literal, Optional

from fastapi import APIRouter, Query

from app.backend.api.deps import route_handler
from app.backend.services.quantitative import analysis_service

log = logging.getLogger(__name__)
router = APIRouter()


_TARGET = Literal["close", "open", "high", "low", "adj_close", "return"]


def _common(symbol: str, target: _TARGET, start_date: Optional[date_type], end_date: Optional[date_type]):
    p = {"symbol": symbol.upper(), "target": target}
    if start_date:
        p["start_date"] = start_date
    if end_date:
        p["end_date"] = end_date
    return p


@router.get("/summary")
@route_handler
async def summary(
    symbol: str = Query(..., description="Ticker symbol"),
    target: _TARGET = Query("close"),
    start_date: Optional[date_type] = Query(None),
    end_date: Optional[date_type] = Query(None),
):
    """기술 통계 (count/mean/std/quantiles/skew/kurtosis)."""
    result = await analysis_service.get_summary(_common(symbol, target, start_date, end_date))
    return {"result": result.model_dump(mode="json") if result else None}


@router.get("/normality")
@route_handler
async def normality(
    symbol: str = Query(...),
    target: _TARGET = Query("close"),
    start_date: Optional[date_type] = Query(None),
    end_date: Optional[date_type] = Query(None),
):
    """정규성 검정 5종 (kurtosis / skewness / Jarque-Bera / Shapiro-Wilk / KS)."""
    result = await analysis_service.get_normality(_common(symbol, target, start_date, end_date))
    return {"result": result.model_dump(mode="json") if result else None}


@router.get("/capm")
@route_handler
async def capm(
    symbol: str = Query(...),
    benchmark: str = Query("^GSPC", description="시장 벤치마크 (기본: S&P 500)"),
    risk_free_rate: float = Query(0.04, description="연율 RF (소수점)"),
    start_date: Optional[date_type] = Query(None),
    end_date: Optional[date_type] = Query(None),
):
    """CAPM — α, β, R², 체계적/비체계적 위험."""
    params = _common(symbol, "close", start_date, end_date)
    params.update({"benchmark": benchmark.upper(), "risk_free_rate": risk_free_rate})
    result = await analysis_service.get_capm(params)
    return {"result": result.model_dump(mode="json") if result else None}


@router.get("/rolling")
@route_handler
async def rolling(
    symbol: str = Query(...),
    metric: Literal["sharpe", "sortino", "stdev", "mean", "skew", "kurtosis", "quantile"] = Query("sharpe"),
    window: int = Query(21, ge=2),
    target: _TARGET = Query("return"),
    risk_free_rate: float = Query(0.04),
    quantile_pct: float = Query(0.5, ge=0.0, le=1.0),
    start_date: Optional[date_type] = Query(None),
    end_date: Optional[date_type] = Query(None),
):
    """롤링 지표 시계열 (sharpe/sortino/stdev/mean/skew/kurtosis/quantile)."""
    params = _common(symbol, target, start_date, end_date)
    params.update({
        "metric": metric,
        "window": window,
        "risk_free_rate": risk_free_rate,
        "quantile_pct": quantile_pct,
    })
    result = await analysis_service.get_rolling(params)
    return {"result": result.model_dump(mode="json") if result else None}


@router.get("/unitroot")
@route_handler
async def unitroot(
    symbol: str = Query(...),
    target: _TARGET = Query("close"),
    regression: Literal["c", "ct", "ctt", "n"] = Query("c"),
    start_date: Optional[date_type] = Query(None),
    end_date: Optional[date_type] = Query(None),
):
    """ADF 단위근 검정 — 시계열 안정성(stationarity)."""
    params = _common(symbol, target, start_date, end_date)
    params["regression"] = regression
    result = await analysis_service.get_unitroot(params)
    return {"result": result.model_dump(mode="json") if result else None}

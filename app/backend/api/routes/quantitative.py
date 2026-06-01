"""Quantitative Analysis API Routes — OBBject pattern"""
import logging
from datetime import date as date_type
from typing import Literal, Optional

from fastapi import APIRouter, Query

from data_fetcher.core.obbject import OBBject
from data_fetcher.abstract_provider.abstract.fetcher import AnnotatedResult
from data_fetcher.query_executor import QueryExecutor
from app.backend.api.deps import route_handler

log = logging.getLogger(__name__)
router = APIRouter()

_TARGET = Literal["close", "open", "high", "low", "adj_close", "return"]


def _common(symbol: str, target: _TARGET, start_date, end_date):
    p = {"symbol": symbol.upper(), "target": target}
    if start_date:
        p["start_date"] = start_date
    if end_date:
        p["end_date"] = end_date
    return p


def _first(raw):
    items = raw.result if isinstance(raw, AnnotatedResult) else (raw or [])
    result = items[0] if items else None
    return [result.model_dump(mode="json")] if result else []


@router.get("/summary")
@route_handler
async def summary(
    symbol: str = Query(...),
    target: _TARGET = Query("close"),
    start_date: Optional[date_type] = Query(None),
    end_date: Optional[date_type] = Query(None),
    provider: str = "quantitative",
) -> OBBject:
    raw = await QueryExecutor.fetch("quantitative", "summary", _common(symbol, target, start_date, end_date))
    return OBBject(results=_first(raw), provider=provider)


@router.get("/normality")
@route_handler
async def normality(
    symbol: str = Query(...),
    target: _TARGET = Query("close"),
    start_date: Optional[date_type] = Query(None),
    end_date: Optional[date_type] = Query(None),
    provider: str = "quantitative",
) -> OBBject:
    raw = await QueryExecutor.fetch("quantitative", "normality", _common(symbol, target, start_date, end_date))
    return OBBject(results=_first(raw), provider=provider)


@router.get("/capm")
@route_handler
async def capm(
    symbol: str = Query(...),
    benchmark: str = Query("^GSPC"),
    risk_free_rate: float = Query(0.04),
    start_date: Optional[date_type] = Query(None),
    end_date: Optional[date_type] = Query(None),
    provider: str = "quantitative",
) -> OBBject:
    params = _common(symbol, "close", start_date, end_date)
    params.update({"benchmark": benchmark.upper(), "risk_free_rate": risk_free_rate})
    raw = await QueryExecutor.fetch("quantitative", "capm", params)
    return OBBject(results=_first(raw), provider=provider)


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
    provider: str = "quantitative",
) -> OBBject:
    params = _common(symbol, target, start_date, end_date)
    params.update({
        "metric": metric,
        "window": window,
        "risk_free_rate": risk_free_rate,
        "quantile_pct": quantile_pct,
    })
    raw = await QueryExecutor.fetch("quantitative", "rolling", params)
    return OBBject(results=_first(raw), provider=provider)


@router.get("/unitroot")
@route_handler
async def unitroot(
    symbol: str = Query(...),
    target: _TARGET = Query("close"),
    regression: Literal["c", "ct", "ctt", "n"] = Query("c"),
    start_date: Optional[date_type] = Query(None),
    end_date: Optional[date_type] = Query(None),
    provider: str = "quantitative",
) -> OBBject:
    params = _common(symbol, target, start_date, end_date)
    params["regression"] = regression
    raw = await QueryExecutor.fetch("quantitative", "unitroot", params)
    return OBBject(results=_first(raw), provider=provider)


@router.get("/correlation")
@route_handler
async def correlation(
    symbols: str = Query(..., description="Comma-separated ticker symbols (2-10)"),
    start_date: Optional[date_type] = Query(None),
    end_date: Optional[date_type] = Query(None),
    period: str = Query("1y"),
    provider: str = "yahoo",
) -> OBBject:
    import numpy as np
    import yfinance as yf
    from datetime import datetime, timedelta

    tickers = [s.strip().upper() for s in symbols.split(",") if s.strip()]
    if len(tickers) < 2:
        raise ValueError("At least 2 symbols required")
    if len(tickers) > 10:
        raise ValueError("Maximum 10 symbols allowed")

    period_map = {"1mo": 30, "3mo": 90, "6mo": 180, "1y": 365, "2y": 730, "5y": 1825}
    if not start_date:
        days = period_map.get(period, 365)
        start_date = (datetime.now() - timedelta(days=days)).date()
    if not end_date:
        end_date = datetime.now().date()

    data = yf.download(tickers, start=str(start_date), end=str(end_date), auto_adjust=True, progress=False)
    if data.empty:
        raise ValueError("No price data found for given symbols")

    closes = data["Close"] if len(tickers) > 1 else data[["Close"]].rename(columns={"Close": tickers[0]})
    returns = closes.pct_change().dropna()
    if returns.empty:
        raise ValueError("Insufficient data for correlation")

    corr = returns.corr()
    labels = list(corr.columns)
    matrix = [
        [round(float(corr.loc[s, s2]), 4) if np.isfinite(corr.loc[s, s2]) else 0 for s2 in labels]
        for s in labels
    ]
    return OBBject(
        results=[{"labels": labels, "matrix": matrix, "rows": len(returns)}],
        provider=provider,
        metadata={"period": period},
    )

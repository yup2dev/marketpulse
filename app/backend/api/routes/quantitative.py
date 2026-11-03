"""Quantitative Analysis API Routes — OBBject pattern"""
import logging
from datetime import date as date_type
from typing import Literal, Optional

from fastapi import APIRouter, Query

from data_fetcher.abstract_provider.abstract.fetcher import AnnotatedResult
from data_fetcher.core import OBBject
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


def _first_dict(raw) -> dict:
    """fetcher 결과(리스트)에서 첫 번째 항목을 dict로 반환 — 프론트는 dataPath: 'results.0' 으로 읽는다."""
    items = raw.result if isinstance(raw, AnnotatedResult) else (raw or [])
    item = items[0] if items else None
    return item.model_dump(mode="json") if item else {}


def _wrap(data: dict, provider: str = "quantitative") -> OBBject:
    """프로젝트 표준 OBBject 로 래핑 — 단건이라 results 는 1개짜리 배열."""
    return OBBject(results=[data], provider=provider)


@router.get("/summary")
@route_handler
async def summary(
    symbol: str = Query(...),
    target: _TARGET = Query("close"),
    start_date: Optional[date_type] = Query(None),
    end_date: Optional[date_type] = Query(None),
    provider: str = "quantitative",
):
    raw = await QueryExecutor.fetch("quantitative", "summary", _common(symbol, target, start_date, end_date))
    return _wrap(_first_dict(raw), provider)


@router.get("/normality")
@route_handler
async def normality(
    symbol: str = Query(...),
    target: _TARGET = Query("close"),
    start_date: Optional[date_type] = Query(None),
    end_date: Optional[date_type] = Query(None),
    provider: str = "quantitative",
):
    raw = await QueryExecutor.fetch("quantitative", "normality", _common(symbol, target, start_date, end_date))
    return _wrap(_first_dict(raw), provider)


@router.get("/capm")
@route_handler
async def capm(
    symbol: str = Query(...),
    benchmark: str = Query("^GSPC"),
    risk_free_rate: float = Query(0.04),
    start_date: Optional[date_type] = Query(None),
    end_date: Optional[date_type] = Query(None),
    provider: str = "quantitative",
):
    params = _common(symbol, "close", start_date, end_date)
    params.update({"benchmark": benchmark.upper(), "risk_free_rate": risk_free_rate})
    raw = await QueryExecutor.fetch("quantitative", "capm", params)
    return _wrap(_first_dict(raw), provider)


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
):
    params = _common(symbol, target, start_date, end_date)
    params.update({
        "metric": metric,
        "window": window,
        "risk_free_rate": risk_free_rate,
        "quantile_pct": quantile_pct,
    })
    raw = await QueryExecutor.fetch("quantitative", "rolling", params)
    return _wrap(_first_dict(raw), provider)


@router.get("/unitroot")
@route_handler
async def unitroot(
    symbol: str = Query(...),
    target: _TARGET = Query("close"),
    regression: Literal["c", "ct", "ctt", "n"] = Query("c"),
    start_date: Optional[date_type] = Query(None),
    end_date: Optional[date_type] = Query(None),
    provider: str = "quantitative",
):
    params = _common(symbol, target, start_date, end_date)
    params["regression"] = regression
    raw = await QueryExecutor.fetch("quantitative", "unitroot", params)
    return _wrap(_first_dict(raw), provider)


@router.get("/correlation")
@route_handler
async def correlation(
    symbols: str = Query(..., description="Comma-separated ticker symbols (2-10)"),
    start_date: Optional[date_type] = Query(None),
    end_date: Optional[date_type] = Query(None),
    period: str = Query("1y"),
    provider: str = "quantitative",
) -> dict:
    """종목 간 일간수익률 상관행렬 — 계산은 quantitative:correlation fetcher.

    fetcher가 시세를 yahoo provider(QueryExecutor)로 받으므로 배포 환경에선 사용자
    Fetcher(exe)로 위임된다. Fetcher 미실행 시 RemoteUnavailableError → 503.
    응답은 프론트 CorrelationWidget이 읽는 results[0] = {labels, matrix, rows}.
    """
    tickers = list(dict.fromkeys(s.strip().upper() for s in symbols.split(",") if s.strip()))
    if len(tickers) < 2:
        raise ValueError("At least 2 symbols required")
    if len(tickers) > 10:
        raise ValueError("Maximum 10 symbols allowed")

    params = {"symbols": tickers, "period": period}
    if start_date:
        params["start_date"] = start_date
    if end_date:
        params["end_date"] = end_date
    raw = await QueryExecutor.fetch("quantitative", "correlation", params)
    return _wrap(_first_dict(raw), provider)

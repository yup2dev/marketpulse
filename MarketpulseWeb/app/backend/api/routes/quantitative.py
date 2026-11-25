"""Quantitative Analysis API Routes — OBBject pattern

계산은 command(app/backend/commands/quant.py), 시세는 PRICES 출처 하나 — 서버에서는 yahoo 가 사용자 PC
Fetcher 로 위임된다(꺼져 있으면 503). 응답은 단건이라 results 는 1개짜리 배열 (프론트는 results.0 을 읽는다).
"""
import logging
from datetime import date as date_type
from typing import Literal, Optional

from fastapi import APIRouter, Query

from data_fetcher.core import OBBject
from app.backend.api.deps import route_handler
from app.backend.commands import quant as quant_cmd
from app.backend.commands._base import Source

log = logging.getLogger(__name__)
router = APIRouter()

_TARGET = Literal["close", "open", "high", "low", "adj_close", "return"]
PRICES = Source("yahoo", "stock_price")


def _wrap(rows, provider: str) -> OBBject:
    return OBBject(results=[r.model_dump(mode="json") for r in rows][:1] or [{}], provider=provider)


@router.get("/summary")
@route_handler
async def summary(
    symbol: str = Query(...),
    target: _TARGET = Query("close"),
    start_date: Optional[date_type] = Query(None),
    end_date: Optional[date_type] = Query(None),
    provider: str = "quantitative",
):
    return _wrap(await quant_cmd.summary(PRICES, symbol.upper(), target, start_date, end_date), provider)


@router.get("/normality")
@route_handler
async def normality(
    symbol: str = Query(...),
    target: _TARGET = Query("close"),
    start_date: Optional[date_type] = Query(None),
    end_date: Optional[date_type] = Query(None),
    provider: str = "quantitative",
):
    return _wrap(await quant_cmd.normality(PRICES, symbol.upper(), target, start_date, end_date), provider)


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
    rows = await quant_cmd.capm(PRICES, symbol.upper(), benchmark.upper(), risk_free_rate, start_date, end_date)
    return _wrap(rows, provider)


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
    rows = await quant_cmd.rolling(PRICES, symbol.upper(), metric, window, target, risk_free_rate, quantile_pct,
                                   start_date, end_date)
    return _wrap(rows, provider)


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
    return _wrap(await quant_cmd.unitroot(PRICES, symbol.upper(), target, regression, start_date, end_date), provider)


@router.get("/correlation")
@route_handler
async def correlation(
    symbols: str = Query(..., description="Comma-separated ticker symbols (2-10)"),
    start_date: Optional[date_type] = Query(None),
    end_date: Optional[date_type] = Query(None),
    period: str = Query("1y"),
    provider: str = "quantitative",
) -> dict:
    """종목 간 일간수익률 상관행렬 — 프론트 CorrelationWidget 이 results[0] = {labels, matrix, rows} 를 읽는다."""
    tickers = quant_cmd.normalize_symbols(symbols)
    if len(tickers) < 2:
        raise ValueError("At least 2 symbols required")
    if len(tickers) > 10:
        raise ValueError("Maximum 10 symbols allowed")

    return _wrap(await quant_cmd.correlation(PRICES, tickers, period, start_date, end_date), provider)

"""Quantitative Analysis API Routes — OBBject pattern"""
import logging
from datetime import date as date_type
from typing import Literal, Optional

from fastapi import APIRouter, Query

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


def _first_dict(raw) -> dict:
    """fetcher 결과(리스트)에서 첫 번째 항목을 dict로 반환 — frontend dataPath: 'result' 에 대응."""
    items = raw.result if isinstance(raw, AnnotatedResult) else (raw or [])
    item = items[0] if items else None
    return item.model_dump(mode="json") if item else {}


def _wrap(data: dict, provider: str = "quantitative") -> dict:
    """{ result: {...}, provider: '...' } 형태로 래핑."""
    return {"result": data, "provider": provider}


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
    provider: str = "yahoo",
) -> dict:
    """종목 간 일간수익률 상관행렬.

    가격 시계열은 yahoo provider를 QueryExecutor로 조회한다 → 배포 환경에선
    RemoteTransport가 사용자 Fetcher(exe)로 위임한다. Fetcher 미실행 시
    RemoteUnavailableError가 전파되어 route_handler가 503 "Fetcher 연결 실패"로
    처리한다(서버에서 yfinance 직접 호출 금지: 고정 IP 차단/OOM).

    응답은 프론트 CorrelationWidget이 읽는 최상위 {labels, matrix, rows} 형태.
    """
    import asyncio
    import numpy as np
    import pandas as pd

    tickers = [s.strip().upper() for s in symbols.split(",") if s.strip()]
    # 중복 제거(순서 보존)
    tickers = list(dict.fromkeys(tickers))
    if len(tickers) < 2:
        raise ValueError("At least 2 symbols required")
    if len(tickers) > 10:
        raise ValueError("Maximum 10 symbols allowed")

    def _params(sym: str) -> dict:
        p = {"symbol": sym, "period": period}
        if start_date:
            p["start_date"] = str(start_date)
        if end_date:
            p["end_date"] = str(end_date)
        return p

    # 종목별 가격 시계열을 yahoo provider 경유로 병렬 조회.
    # RemoteUnavailableError(Fetcher 미가용)는 잡지 않고 전파 → 503으로 통일 처리.
    raws = await asyncio.gather(
        *[QueryExecutor.fetch("yahoo", "stock_price", _params(t)) for t in tickers]
    )

    series: dict[str, pd.Series] = {}
    for ticker, raw in zip(tickers, raws):
        items = raw.result if isinstance(raw, AnnotatedResult) else (raw or [])
        closes = {}
        for it in items:
            d = getattr(it, "date", None)
            c = getattr(it, "close", None)
            if d is not None and c is not None:
                closes[str(d)] = float(c)
        if closes:
            series[ticker] = pd.Series(closes)

    if len(series) < 2:
        raise ValueError("Insufficient price data for correlation")

    closes_df = pd.DataFrame(series).sort_index()
    returns = closes_df.pct_change().dropna()
    if returns.empty or returns.shape[0] < 2:
        raise ValueError("Insufficient data for correlation")

    corr = returns.corr()
    labels = list(corr.columns)
    matrix = [
        [round(float(corr.loc[a, b]), 4) if np.isfinite(corr.loc[a, b]) else 0 for b in labels]
        for a in labels
    ]
    return {"labels": labels, "matrix": matrix, "rows": int(returns.shape[0]), "provider": provider}

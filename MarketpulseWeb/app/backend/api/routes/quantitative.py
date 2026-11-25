"""Quantitative Analysis (/api/quantitative) — 시세 inputs → commands/quant 순수 함수.

시세는 yahoo stock_price — 서버에서는 사용자 PC Fetcher 로 위임된다 (꺼져 있으면 503).
응답은 단건이라 results 는 1개짜리 배열 (프론트는 results.0 을 읽는다).
"""
from datetime import date as date_type
from typing import Literal, Optional

from fastapi import Query

from data_fetcher.core import Fetch, Router
from app.backend.commands import quant

router = Router(prefix="", tags=["quantitative"], description="Quantitative analysis.")

Target = Literal["close", "open", "high", "low", "adj_close", "return"]
PRICE_PROVIDER = "yahoo"


def prices(symbol: str, start=None, end=None) -> Fetch:
    return Fetch(PRICE_PROVIDER, "stock_price", quant.price_params(symbol.upper(), start, end), required=True)


def _one(symbol: str = Query(...), start_date: Optional[date_type] = Query(None),
         end_date: Optional[date_type] = Query(None)):
    return {"prices": prices(symbol, start_date, end_date)}


@router.command(path="/summary", inputs=_one)
def summary(data, symbol: str, target: Target = "close"):
    series, _ = quant.series_from_rows(data["prices"], symbol.upper(), target)
    return [quant.summarize(symbol.upper(), target, series)]


@router.command(path="/normality", inputs=_one)
def normality(data, symbol: str, target: Target = "close"):
    series, _ = quant.series_from_rows(data["prices"], symbol.upper(), target)
    x = series.values.astype(float)
    return [quant.NormalityData(symbol=symbol.upper(), target=target, n=int(len(x)), tests=quant.normality_tests(x))]


def _capm_inputs(symbol: str = Query(...), benchmark: str = "^GSPC", start_date: Optional[date_type] = None,
                 end_date: Optional[date_type] = None):
    return {"asset": prices(symbol, start_date, end_date), "market": prices(benchmark, start_date, end_date)}


@router.command(path="/capm", inputs=_capm_inputs)
def capm(data, symbol: str, benchmark: str = "^GSPC", risk_free_rate: float = 0.04):
    _, asset = quant.series_from_rows(data["asset"], symbol.upper(), "close")
    _, market = quant.series_from_rows(data["market"], benchmark.upper(), "close")
    return [quant.capm_from_returns(symbol.upper(), benchmark.upper(), asset, market, risk_free_rate)]


@router.command(path="/rolling", inputs=_one)
def rolling(
    data,
    symbol: str,
    metric: Literal["sharpe", "sortino", "stdev", "mean", "skew", "kurtosis", "quantile"] = "sharpe",
    window: int = Query(21, ge=2),
    target: Target = "return",
    risk_free_rate: float = 0.04,
    quantile_pct: float = Query(0.5, ge=0.0, le=1.0),
):
    series, returns = quant.series_from_rows(data["prices"], symbol.upper(), target)
    return [quant.rolling_from(symbol.upper(), target, series, returns, metric, window, risk_free_rate, quantile_pct)]


@router.command(path="/unitroot", inputs=_one)
def unitroot(data, symbol: str, target: Target = "close", regression: Literal["c", "ct", "ctt", "n"] = "c"):
    series, _ = quant.series_from_rows(data["prices"], symbol.upper(), target)
    return [quant.adf(symbol.upper(), target, series, regression)]


def _correlation_inputs(symbols: str = Query(..., description="Comma-separated ticker symbols (2-10)"),
                        period: str = "1y", start_date: Optional[date_type] = None,
                        end_date: Optional[date_type] = None):
    tickers = quant.normalize_symbols(symbols)
    if len(tickers) < 2:
        raise ValueError("At least 2 symbols required")
    if len(tickers) > 10:
        raise ValueError("Maximum 10 symbols allowed")
    # interval 명시: 미지정 시 2y 이상은 주봉으로 바뀐다 (yahoo 기본값)
    rng = {k: str(v) for k, v in (("start_date", start_date), ("end_date", end_date)) if v}
    return {s: Fetch(PRICE_PROVIDER, "stock_price", {"symbol": s, "period": period, "interval": "1d", **rng})
            for s in tickers}


@router.command(path="/correlation", inputs=_correlation_inputs)
def correlation(data):
    """종목 간 일간수익률 상관행렬 — 프론트 CorrelationWidget 이 results[0] = {labels, matrix, rows} 를 읽는다."""
    return [quant.correlation_from(data)]

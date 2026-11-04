"""Shared price loader for quantitative fetchers.

시세는 yfinance를 직접 부르지 않고 `QueryExecutor.fetch("yahoo", "stock_price")`로 받는다.
quantitative provider는 웹 서버에서도 실행되므로, 직접 부르면 서버 고정 IP에서 yfinance를
호출하게 된다(차단/OOM) — 게다가 sync extract_data는 이벤트 루프 위에서 그대로 돌아 서버를
블로킹했다. QueryExecutor를 거치면 서버에선 사용자 Fetcher(exe)로 위임되고, Fetcher·로컬
배치(leaf)에선 그대로 직접 실행된다. Fetcher 미실행 시 RemoteUnavailableError → 503.

Returns a clean pd.Series of the target column (or daily returns), indexed by date.
"""
import asyncio
from datetime import date as date_type, datetime, timedelta
from typing import Any, List, Mapping, Optional, Tuple

import numpy as np
import pandas as pd


_TARGET_MAP = {
    "close":     "close",
    "open":      "open",
    "high":      "high",
    "low":       "low",
    "adj_close": "adj_close",
}


def _parse_date(d) -> Optional[datetime]:
    if d is None:
        return None
    if isinstance(d, datetime):
        return d
    if isinstance(d, date_type):
        return datetime.combine(d, datetime.min.time())
    if isinstance(d, str):
        return datetime.strptime(d, "%Y-%m-%d")
    return None


def _get(item: Any, key: str) -> Any:
    return item.get(key) if isinstance(item, Mapping) else getattr(item, key, None)


def prices_to_frame(items: List[Any]) -> pd.DataFrame:
    """stock_price 결과(pydantic/dict 혼재) → date 인덱스 OHLC DataFrame."""
    rows = []
    for it in items:
        d = _get(it, "date")
        if d is None:
            continue
        rows.append({
            "date": pd.Timestamp(str(d)[:10]),
            **{col: _get(it, col) for col in ("open", "high", "low", "close", "adj_close")},
        })
    if not rows:
        return pd.DataFrame()
    df = pd.DataFrame(rows).drop_duplicates("date", keep="last").set_index("date").sort_index()
    return df.astype(float)


def series_from_frame(
    df: pd.DataFrame, symbol: str, target: str
) -> Tuple[pd.Series, pd.Series]:
    """OHLC DataFrame → (target series, daily returns)."""
    if df.empty or "close" not in df:
        raise ValueError(f"No price data for {symbol}")

    close = df["close"].dropna()
    returns = close.pct_change().dropna()

    if target == "return":
        target_series = returns
    else:
        col = _TARGET_MAP.get(target, "close")
        if col not in df.columns or df[col].dropna().empty:
            col = "close"
        target_series = df[col].dropna()

    if len(target_series) < 2:
        raise ValueError(f"Insufficient data for {symbol} (got {len(target_series)} points)")

    return target_series, returns


async def aload_series(
    symbol: str,
    target: str,
    start_date=None,
    end_date=None,
) -> Tuple[pd.Series, pd.Series]:
    """Load a (price, returns) series tuple for `symbol` via yahoo stock_price (QueryExecutor).

    `target == "return"` → price still loaded from close; series_for_target = returns.
    Otherwise the requested column is returned. 기본 기간: 종료일 기준 2년.
    """
    from data_fetcher.query_executor import QueryExecutor  # 순환 import 방지

    end = _parse_date(end_date) or datetime.now()
    start = _parse_date(start_date) or (end - timedelta(days=365 * 2))
    params = {
        "symbol": symbol,
        "start_date": start.strftime("%Y-%m-%d"),
        # yfinance history(end=)는 종료일 미포함 → +1일로 종료일까지 포함
        "end_date": (end + timedelta(days=1)).strftime("%Y-%m-%d"),
        "interval": "1d",
    }
    raw = await QueryExecutor.fetch("yahoo", "stock_price", params)
    items = getattr(raw, "result", raw) or []
    if not items:
        raise ValueError(f"No price data for {symbol} between {start.date()} and {end.date()}")
    return series_from_frame(prices_to_frame(items), symbol, target)


async def aload_many(symbols: List[str], target: str, start_date=None, end_date=None):
    """여러 종목 병렬 로드 — 결과 순서는 symbols 순서."""
    return await asyncio.gather(*[aload_series(s, target, start_date, end_date) for s in symbols])


def to_returns(series: pd.Series) -> pd.Series:
    """Force series → daily simple returns (no-op if already returns)."""
    s = series.dropna()
    if (s.abs() < 1.0).all():
        return s
    return s.pct_change().dropna()


def annualise_return(daily_ret: pd.Series) -> float:
    return float(daily_ret.mean() * 252)


def annualise_vol(daily_ret: pd.Series) -> float:
    return float(daily_ret.std(ddof=1) * np.sqrt(252))

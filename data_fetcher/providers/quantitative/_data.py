"""Shared yfinance loader for quantitative fetchers.

Returns a clean pd.Series of the target column (or daily returns), indexed by date.
"""
from datetime import date as date_type, datetime, timedelta
from typing import Optional, Tuple

import numpy as np
import pandas as pd
import yfinance as yf


_TARGET_MAP = {
    "close":     "Close",
    "open":      "Open",
    "high":      "High",
    "low":       "Low",
    "adj_close": "Adj Close",
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


def load_series(
    symbol: str,
    target: str,
    start_date=None,
    end_date=None,
) -> Tuple[pd.Series, pd.Series]:
    """Load a (price, returns) series tuple for `symbol` from yfinance.

    `target == "return"` → price still loaded from Close; series_for_target = returns.
    Otherwise the requested column is returned.
    """
    end = _parse_date(end_date) or datetime.now()
    start = _parse_date(start_date) or (end - timedelta(days=365 * 2))

    df = yf.Ticker(symbol).history(start=start, end=end + timedelta(days=1), auto_adjust=False)
    if df.empty:
        raise ValueError(f"No price data for {symbol} between {start.date()} and {end.date()}")

    df.index = pd.to_datetime(df.index).tz_localize(None).normalize()

    close = df["Close"].astype(float).dropna()
    returns = close.pct_change().dropna()

    if target == "return":
        target_series = returns
    else:
        col = _TARGET_MAP.get(target, "Close")
        if col not in df.columns:
            col = "Close"
        target_series = df[col].astype(float).dropna()

    if len(target_series) < 2:
        raise ValueError(f"Insufficient data for {symbol} (got {len(target_series)} points)")

    return target_series, returns


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

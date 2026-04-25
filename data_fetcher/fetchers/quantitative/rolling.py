"""Rolling metric fetcher — sharpe / sortino / stdev / mean / skew / kurtosis / quantile."""
import logging
from typing import Any, Dict, List, Optional

import numpy as np
import pandas as pd

from data_fetcher.fetchers.base import Fetcher
from data_fetcher.fetchers.quantitative._data import load_series, to_returns
from data_fetcher.models.quantitative.analysis import (
    RollingData,
    RollingPoint,
    RollingQueryParams,
)

log = logging.getLogger(__name__)


def _rolling_sharpe(returns: pd.Series, window: int, rf_annual: float) -> pd.Series:
    rf_daily = (1.0 + rf_annual) ** (1.0 / 252) - 1.0
    excess = returns - rf_daily
    mean = excess.rolling(window).mean()
    std = returns.rolling(window).std(ddof=1)
    return (mean / std) * np.sqrt(252)


def _rolling_sortino(returns: pd.Series, window: int, rf_annual: float) -> pd.Series:
    rf_daily = (1.0 + rf_annual) ** (1.0 / 252) - 1.0
    excess = returns - rf_daily
    downside = returns.where(returns < 0, 0.0)
    down_std = downside.rolling(window).std(ddof=1)
    return (excess.rolling(window).mean() / down_std) * np.sqrt(252)


class QuantRollingFetcher(Fetcher[RollingQueryParams, RollingData]):
    """Single-line rolling metrics suitable for a chart widget."""

    require_credentials = False

    @staticmethod
    def transform_query(params: Dict[str, Any]) -> RollingQueryParams:
        return RollingQueryParams(**params)

    @staticmethod
    def extract_data(
        query: RollingQueryParams,
        credentials: Optional[Dict[str, str]] = None,
        **kwargs: Any,
    ) -> Dict[str, Any]:
        series, returns = load_series(
            query.symbol, query.target, query.start_date, query.end_date
        )

        # Sharpe/sortino always operate on returns; others on the chosen target.
        if query.metric in ("sharpe", "sortino"):
            data_for_metric = returns if query.target != "return" else to_returns(series)
        else:
            data_for_metric = series

        if len(data_for_metric) <= query.window:
            raise ValueError(
                f"window ({query.window}) must be < data length ({len(data_for_metric)})"
            )

        w = query.window

        if query.metric == "sharpe":
            out = _rolling_sharpe(data_for_metric, w, query.risk_free_rate)
        elif query.metric == "sortino":
            out = _rolling_sortino(data_for_metric, w, query.risk_free_rate)
        elif query.metric == "stdev":
            out = data_for_metric.rolling(w).std(ddof=1)
        elif query.metric == "mean":
            out = data_for_metric.rolling(w).mean()
        elif query.metric == "skew":
            out = data_for_metric.rolling(w).skew()
        elif query.metric == "kurtosis":
            out = data_for_metric.rolling(w).kurt()
        elif query.metric == "quantile":
            out = data_for_metric.rolling(w).quantile(query.quantile_pct)
        else:
            raise ValueError(f"Unknown metric: {query.metric}")

        out = out.dropna()
        return {
            "symbol": query.symbol,
            "target": query.target,
            "metric": query.metric,
            "window": query.window,
            "points": [
                {"date": idx.date(), "value": (None if pd.isna(v) else float(v))}
                for idx, v in out.items()
            ],
        }

    @staticmethod
    def transform_data(
        query: RollingQueryParams,
        data: Dict[str, Any],
        **kwargs: Any,
    ) -> List[RollingData]:
        return [
            RollingData(
                symbol=data["symbol"],
                target=data["target"],
                metric=data["metric"],
                window=data["window"],
                points=[RollingPoint.model_validate(p) for p in data["points"]],
            )
        ]

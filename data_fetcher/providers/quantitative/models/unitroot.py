"""Augmented Dickey-Fuller unit root test fetcher."""
import logging
from typing import Any, Dict, List, Optional

from statsmodels.tsa.stattools import adfuller

from data_fetcher.abstract_provider.abstract.base_fetchers import ComputeFetcher
from data_fetcher.providers.quantitative._data import load_series
from data_fetcher.providers.quantitative.analysis import (
    UnitRootData,
    UnitRootQueryParams,
)

log = logging.getLogger(__name__)


class QuantUnitRootFetcher(ComputeFetcher[UnitRootQueryParams, UnitRootData]):
    """Run an ADF test on the chosen series."""

    require_credentials = False

    @staticmethod
    def transform_query(params: Dict[str, Any]) -> UnitRootQueryParams:
        return UnitRootQueryParams(**params)

    @staticmethod
    def extract_data(
        query: UnitRootQueryParams,
        credentials: Optional[Dict[str, str]] = None,
        **kwargs: Any,
    ) -> Dict[str, Any]:
        series, _ = load_series(query.symbol, query.target, query.start_date, query.end_date)
        if len(series) < 30:
            raise ValueError(f"ADF needs ≥30 obs (got {len(series)})")

        stat, p, used_lag, n_obs, crit, _ = adfuller(
            series.values, regression=query.regression, autolag="AIC"
        )

        return {
            "symbol": query.symbol,
            "target": query.target,
            "n": int(len(series)),
            "test": "adf",
            "statistic": float(stat),
            "p_value": float(p),
            "used_lag": int(used_lag),
            "n_obs": int(n_obs),
            "critical_1pct": float(crit["1%"]),
            "critical_5pct": float(crit["5%"]),
            "critical_10pct": float(crit["10%"]),
            "stationary": bool(p < 0.05),
        }

    @staticmethod
    def transform_data(
        query: UnitRootQueryParams,
        data: Dict[str, Any],
        **kwargs: Any,
    ) -> List[UnitRootData]:
        return [UnitRootData.model_validate(data)]

"""Normality test fetcher — Jarque-Bera / Shapiro-Wilk / KS / skew / kurtosis."""
import logging
from typing import Any, Dict, List, Optional

import numpy as np
from scipy import stats

from data_fetcher.fetchers.base import Fetcher
from data_fetcher.fetchers.quantitative._data import load_series
from data_fetcher.models.quantitative.analysis import (
    NormalityData,
    NormalityQueryParams,
    NormalityTest,
)

log = logging.getLogger(__name__)
_ALPHA = 0.05


class QuantNormalityFetcher(Fetcher[NormalityQueryParams, NormalityData]):
    """5 normality tests on a price (or returns) series."""

    require_credentials = False

    @staticmethod
    def transform_query(params: Dict[str, Any]) -> NormalityQueryParams:
        return NormalityQueryParams(**params)

    @staticmethod
    def extract_data(
        query: NormalityQueryParams,
        credentials: Optional[Dict[str, str]] = None,
        **kwargs: Any,
    ) -> Dict[str, Any]:
        series, _ = load_series(query.symbol, query.target, query.start_date, query.end_date)
        x = series.values.astype(float)

        # Kurtosis test (Anscombe-Glynn) — needs ≥20 samples
        kurt_stat, kurt_p = (np.nan, np.nan)
        if len(x) >= 20:
            kurt_stat, kurt_p = stats.kurtosistest(x)

        skew_stat, skew_p = stats.skewtest(x) if len(x) >= 8 else (np.nan, np.nan)
        jb_stat, jb_p = stats.jarque_bera(x)
        sw_stat, sw_p = stats.shapiro(x)
        # KS vs N(mean, std)
        z = (x - x.mean()) / (x.std(ddof=1) or 1.0)
        ks_stat, ks_p = stats.kstest(z, "norm")

        def _row(name, stat, p):
            stat_v = None if np.isnan(stat) else float(stat)
            p_v = None if np.isnan(p) else float(p)
            return {
                "test": name,
                "statistic": stat_v if stat_v is not None else 0.0,
                "p_value": p_v if p_v is not None else 0.0,
                "normal": (p_v is not None) and (p_v >= _ALPHA),
            }

        tests = [
            _row("kurtosis", kurt_stat, kurt_p),
            _row("skewness", skew_stat, skew_p),
            _row("jarque_bera", jb_stat, jb_p),
            _row("shapiro_wilk", sw_stat, sw_p),
            _row("kolmogorov_smirnov", ks_stat, ks_p),
        ]

        return {
            "symbol": query.symbol,
            "target": query.target,
            "n": int(len(x)),
            "tests": tests,
        }

    @staticmethod
    def transform_data(
        query: NormalityQueryParams,
        data: Dict[str, Any],
        **kwargs: Any,
    ) -> List[NormalityData]:
        return [
            NormalityData(
                symbol=data["symbol"],
                target=data["target"],
                n=data["n"],
                tests=[NormalityTest.model_validate(t) for t in data["tests"]],
            )
        ]

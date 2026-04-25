"""Summary fetcher — descriptive statistics on a yfinance time series."""
import logging
from typing import Any, Dict, List, Optional

from scipy import stats

from data_fetcher.fetchers.base import Fetcher
from data_fetcher.fetchers.quantitative._data import load_series
from data_fetcher.models.quantitative.analysis import (
    SummaryData,
    SummaryQueryParams,
)

log = logging.getLogger(__name__)


class QuantSummaryFetcher(Fetcher[SummaryQueryParams, SummaryData]):
    """Mean/std/min/max/quantiles/skew/kurtosis on a price (or returns) series."""

    require_credentials = False

    @staticmethod
    def transform_query(params: Dict[str, Any]) -> SummaryQueryParams:
        return SummaryQueryParams(**params)

    @staticmethod
    def extract_data(
        query: SummaryQueryParams,
        credentials: Optional[Dict[str, str]] = None,
        **kwargs: Any,
    ) -> Dict[str, Any]:
        series, _ = load_series(query.symbol, query.target, query.start_date, query.end_date)
        s = series.values

        return {
            "symbol": query.symbol,
            "target": query.target,
            "count": int(len(s)),
            "mean": float(series.mean()),
            "std": float(series.std(ddof=1)),
            "min": float(series.min()),
            "max": float(series.max()),
            "p_25": float(series.quantile(0.25)),
            "p_50": float(series.quantile(0.50)),
            "p_75": float(series.quantile(0.75)),
            "skew": float(stats.skew(s, bias=False)),
            "kurtosis": float(stats.kurtosis(s, fisher=True, bias=False)),
        }

    @staticmethod
    def transform_data(
        query: SummaryQueryParams,
        data: Dict[str, Any],
        **kwargs: Any,
    ) -> List[SummaryData]:
        return [SummaryData.model_validate(data)]

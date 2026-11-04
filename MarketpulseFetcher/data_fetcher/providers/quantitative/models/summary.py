"""Summary fetcher — descriptive statistics on a daily price/return series (yahoo via QueryExecutor)."""
import logging
from typing import Any, Dict, List, Optional

from scipy import stats

from data_fetcher.abstract_provider.abstract.base_fetchers import ComputeFetcher
from data_fetcher.providers.quantitative.utils.prices import aload_series
from data_fetcher.abstract_provider.standard_models.quant_analysis import (
    SummaryData,
    SummaryQueryParams,
)

log = logging.getLogger(__name__)


class QuantSummaryFetcher(ComputeFetcher[SummaryQueryParams, SummaryData]):
    """Mean/std/min/max/quantiles/skew/kurtosis on a price (or returns) series."""

    require_credentials = False

    @staticmethod
    def transform_query(params: Dict[str, Any]) -> SummaryQueryParams:
        return SummaryQueryParams(**params)

    @staticmethod
    async def aextract_data(
        query: SummaryQueryParams,
        credentials: Optional[Dict[str, str]] = None,
        **kwargs: Any,
    ) -> Dict[str, Any]:
        series, _ = await aload_series(query.symbol, query.target, query.start_date, query.end_date)
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

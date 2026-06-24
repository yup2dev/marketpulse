"""Yield Curve History Models"""
from datetime import date as date_type
from typing import Optional
from pydantic import Field
from data_fetcher.abstract_provider.standard_models.yield_curve import (
    YieldCurveQueryParams,
    YieldCurveHistoryData,
)


class YieldCurveHistoryQueryParams(YieldCurveQueryParams):
    """standard YieldCurve 파라미터 경유 (start_date/end_date)."""


"""Yield Curve History Fetcher — 7개 만기 수익률 시계열 병합."""
import logging
from typing import Any, Dict, List, Optional

from data_fetcher.abstract_provider.abstract.fetcher import Fetcher
from data_fetcher.providers.fred.utils.helpers import FredSeriesHelper as FredSeriesFetcher
from data_fetcher.utils.api_keys import get_api_key

log = logging.getLogger(__name__)

_SERIES_MAP = {
    "3m":  "DTB3",
    "6m":  "DTB6",
    "1y":  "DGS1",
    "2y":  "DGS2",
    "5y":  "DGS5",
    "10y": "DGS10",
    "30y": "DGS30",
}
_FIELD_MAP = {"3m": "m3", "6m": "m6", "1y": "y1", "2y": "y2", "5y": "y5", "10y": "y10", "30y": "y30"}


class FREDYieldCurveHistoryFetcher(Fetcher[YieldCurveHistoryQueryParams, YieldCurveHistoryData]):
    """미국채 수익률 곡선 시계열 — 7개 만기 병합."""

    @staticmethod
    def transform_query(params: Dict[str, Any]) -> YieldCurveHistoryQueryParams:
        return YieldCurveHistoryQueryParams(**params)

    @staticmethod
    async def aextract_data(
        query: YieldCurveHistoryQueryParams,
        credentials: Optional[Dict[str, str]] = None,
        **kwargs: Any,
    ) -> Dict[str, List[Dict]]:
        api_key = get_api_key(credentials=credentials, api_name="FRED", env_var="FRED_API_KEY")
        raw: Dict[str, List[Dict]] = {}
        for key, series_id in _SERIES_MAP.items():
            try:
                raw[key] = await FredSeriesFetcher.fetch_series(
                    series_id=series_id,
                    api_key=api_key,
                    start_date=query.start_date,
                    end_date=query.end_date,
                    sort_order="asc",
                )
            except Exception as e:
                log.warning(f"[YieldCurveHistory] {series_id} failed: {e}")
                raw[key] = []
        return raw

    @staticmethod
    def transform_data(
        query: YieldCurveHistoryQueryParams,
        data: Dict[str, List[Dict]],
        **kwargs: Any,
    ) -> List[YieldCurveHistoryData]:
        # Build {date: {field: value}} lookup
        by_date: Dict[str, Dict[str, float]] = {}
        for key, obs_list in data.items():
            field = _FIELD_MAP[key]
            for obs in obs_list:
                date_str = obs.get("date")
                val = obs.get("value")
                if not date_str or val in (None, ".", ""):
                    continue
                try:
                    by_date.setdefault(date_str, {})[field] = round(float(val), 2)
                except (TypeError, ValueError):
                    pass

        # Anchor on 10y (densest series), include rows with at least one yield
        anchor_dates = sorted(d for d, f in by_date.items() if "y10" in f)
        results = []
        for date_str in anchor_dates:
            fields = by_date[date_str]
            if len(fields) >= 2:  # at least 2 maturities
                results.append(YieldCurveHistoryData(date=date_str, **fields))
        return results

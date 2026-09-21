"""Real Rates Models (TIPS + Breakeven)"""
from datetime import date as date_type
from typing import Optional
from pydantic import Field
from data_fetcher.abstract_provider.standard_models.fred_series import (
    FredSeriesQueryParams,
    FredSeriesData,
)


class RealRatesQueryParams(FredSeriesQueryParams):
    start_date: Optional[date_type] = None
    end_date: Optional[date_type] = None


class RealRatesData(FredSeriesData):
    date: str = Field(description="날짜 (YYYY-MM-DD)")
    nominal_10y: Optional[float] = Field(default=None, description="명목 10년 수익률 (%)")
    nominal_5y: Optional[float] = Field(default=None, description="명목 5년 수익률 (%)")
    real_10y: Optional[float] = Field(default=None, description="TIPS 10년 실질금리 (%)")
    real_5y: Optional[float] = Field(default=None, description="TIPS 5년 실질금리 (%)")
    breakeven_5y: Optional[float] = Field(default=None, description="5년 손익분기 인플레이션 (%)")
    breakeven_10y: Optional[float] = Field(default=None, description="10년 손익분기 인플레이션 (%)")


"""Real Rates Fetcher — TIPS yields + breakeven inflation (6 FRED series merged by date)."""
import logging
from typing import Any, Dict, List, Optional

from data_fetcher.abstract_provider.abstract.base_fetchers import ApiFetcher
from data_fetcher.providers.fred.utils.helpers import FredSeriesHelper as FredSeriesFetcher
from data_fetcher.utils.api_keys import get_api_key

log = logging.getLogger(__name__)

_SERIES_MAP = {
    "nominal_10y": "DGS10",
    "nominal_5y":  "DGS5",
    "real_10y":    "DFII10",
    "real_5y":     "DFII5",
    "breakeven_5y":  "T5YIE",
    "breakeven_10y": "T10YIE",
}


class FREDRealRatesFetcher(ApiFetcher[RealRatesQueryParams, RealRatesData]):
    """실질금리 — 명목/TIPS/손익분기 수익률 통합 시계열."""

    api_name = "FRED"
    api_key_env = "FRED_API_KEY"

    @staticmethod
    def transform_query(params: Dict[str, Any]) -> RealRatesQueryParams:
        return RealRatesQueryParams(**params)

    @staticmethod
    async def aextract_data(
        query: RealRatesQueryParams,
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
                log.warning(f"[RealRates] {series_id} fetch failed: {e}")
                raw[key] = []
        return raw

    @staticmethod
    def transform_data(
        query: RealRatesQueryParams,
        data: Dict[str, List[Dict]],
        **kwargs: Any,
    ) -> List[RealRatesData]:
        # date → {field: value} lookup
        by_date: Dict[str, Dict[str, float]] = {}
        for key, obs_list in data.items():
            for obs in obs_list:
                date_str = obs.get("date")
                val = obs.get("value")
                if not date_str or val in (None, ".", ""):
                    continue
                try:
                    by_date.setdefault(date_str, {})[key] = round(float(val), 3)
                except (TypeError, ValueError):
                    pass

        # anchor on nominal_10y dates (densest series)
        anchor_dates = sorted(
            d for d, fields in by_date.items() if "nominal_10y" in fields
        )
        results = []
        for date_str in anchor_dates:
            fields = by_date[date_str]
            results.append(RealRatesData(date=date_str, **fields))
        return results

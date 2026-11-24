"""FRED Financial Conditions History — QueryParams + Data + Fetcher"""
import logging
from datetime import date as date_type
from typing import Any, Dict, List, Optional

from pydantic import Field

from data_fetcher.abstract_provider.standard_models.fred_series import (
    FredSeriesQueryParams,
    FredSeriesData,
)
from data_fetcher.abstract_provider.abstract.base_fetchers import ApiFetcher
from data_fetcher.providers.fred.models.generic_series import FREDGenericSeriesFetcher

log = logging.getLogger(__name__)


# ── QueryParams ───────────────────────────────────────────────────────────────

class FinancialConditionsHistoryQueryParams(FredSeriesQueryParams):
    start_date: Optional[date_type] = None
    end_date: Optional[date_type] = None


# ── Data ──────────────────────────────────────────────────────────────────────

class FinancialConditionsHistoryData(FredSeriesData):
    date: str = Field(description="날짜 (YYYY-MM-DD)")
    value: float = Field(description="NFCI 지수값")


# ── Fetcher ───────────────────────────────────────────────────────────────────

class FREDFinancialConditionsHistoryFetcher(
    ApiFetcher[FinancialConditionsHistoryQueryParams, FinancialConditionsHistoryData]
):
    """금융 여건 지수 시계열 — Chicago Fed NFCI."""

    api_name = "FRED"
    api_key_env = "FRED_API_KEY"

    @staticmethod
    def transform_query(params: Dict[str, Any]) -> FinancialConditionsHistoryQueryParams:
        return FinancialConditionsHistoryQueryParams(**params)

    @staticmethod
    async def aextract_data(
        query: FinancialConditionsHistoryQueryParams,
        credentials: Optional[Dict[str, str]] = None,
        **kwargs: Any,
    ) -> List[Dict]:
        return [d.model_dump() for d in await FREDGenericSeriesFetcher.fetch_data(dict(
            series_id="NFCI",
            start_date=query.start_date,
            end_date=query.end_date,
            sort_order="asc",
        ), credentials)]

    @staticmethod
    def transform_data(
        query: FinancialConditionsHistoryQueryParams,
        data: List[Dict],
        **kwargs: Any,
    ) -> List[FinancialConditionsHistoryData]:
        results = []
        for obs in data:
            val = obs.get("value")
            date_str = obs.get("date")
            if not date_str or val in (None, ".", ""):
                continue
            try:
                results.append(FinancialConditionsHistoryData(date=date_str, value=round(float(val), 4)))
            except (TypeError, ValueError):
                pass
        return results

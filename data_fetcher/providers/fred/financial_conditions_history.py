"""FRED Financial Conditions History — QueryParams + Data + Fetcher"""
import logging
from datetime import date as date_type
from typing import Any, Dict, List, Optional

from pydantic import Field

from data_fetcher.abstract_provider.abstract import BaseQueryParams, BaseData
from data_fetcher.abstract_provider.abstract.fetcher import Fetcher
from data_fetcher.providers.fred.utils.helpers import FredSeriesHelper as FredSeriesFetcher
from data_fetcher.utils.api_keys import get_api_key

log = logging.getLogger(__name__)


# ── QueryParams ───────────────────────────────────────────────────────────────

class FinancialConditionsHistoryQueryParams(BaseQueryParams):
    start_date: Optional[date_type] = None
    end_date: Optional[date_type] = None


# ── Data ──────────────────────────────────────────────────────────────────────

class FinancialConditionsHistoryData(BaseData):
    date: str = Field(description="날짜 (YYYY-MM-DD)")
    value: float = Field(description="NFCI 지수값")


# ── Fetcher ───────────────────────────────────────────────────────────────────

class FREDFinancialConditionsHistoryFetcher(
    Fetcher[FinancialConditionsHistoryQueryParams, FinancialConditionsHistoryData]
):
    """금융 여건 지수 시계열 — Chicago Fed NFCI."""

    @staticmethod
    def transform_query(params: Dict[str, Any]) -> FinancialConditionsHistoryQueryParams:
        return FinancialConditionsHistoryQueryParams(**params)

    @staticmethod
    async def aextract_data(
        query: FinancialConditionsHistoryQueryParams,
        credentials: Optional[Dict[str, str]] = None,
        **kwargs: Any,
    ) -> List[Dict]:
        api_key = get_api_key(credentials=credentials, api_name="FRED", env_var="FRED_API_KEY")
        return await FredSeriesFetcher.fetch_series(
            series_id="NFCI",
            api_key=api_key,
            start_date=query.start_date,
            end_date=query.end_date,
            sort_order="asc",
        )

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

"""Fed Balance Sheet Models"""
from datetime import date as date_type
from typing import Optional
from pydantic import Field
from data_fetcher.abstract_provider.standard_models.fred_series import (
    FredSeriesQueryParams,
    FredSeriesData,
)


class FedBalanceSheetQueryParams(FredSeriesQueryParams):
    start_date: Optional[date_type] = None
    end_date: Optional[date_type] = None


class FedBalanceSheetData(FredSeriesData):
    date: str = Field(description="날짜 (YYYY-MM-DD)")
    value: float = Field(description="총자산 (조 달러)")


"""Federal Reserve Balance Sheet (Total Assets) Fetcher — FRED WALCL series."""
import logging
from typing import Any, Dict, List, Optional

from data_fetcher.abstract_provider.abstract.fetcher import Fetcher
from data_fetcher.providers.fred.utils.helpers import FredSeriesHelper as FredSeriesFetcher
from data_fetcher.utils.api_keys import get_api_key

log = logging.getLogger(__name__)

# WALCL: Total Assets, Eliminations from Consolidation (weekly, millions of dollars)
_SERIES_ID = "WALCL"
_MILLIONS_TO_TRILLIONS = 1_000_000


class FREDFedBalanceSheetFetcher(Fetcher[FedBalanceSheetQueryParams, FedBalanceSheetData]):
    """연준 총자산(대차대조표) 시계열 — WALCL."""

    require_credentials = True

    @staticmethod
    def transform_query(params: Dict[str, Any]) -> FedBalanceSheetQueryParams:
        return FedBalanceSheetQueryParams(**params)

    @staticmethod
    async def aextract_data(
        query: FedBalanceSheetQueryParams,
        credentials: Optional[Dict[str, str]] = None,
        **kwargs: Any,
    ) -> List[Dict[str, Any]]:
        api_key = get_api_key(credentials=credentials, api_name="FRED", env_var="FRED_API_KEY")
        return await FredSeriesFetcher.fetch_series(
            series_id=_SERIES_ID,
            api_key=api_key,
            start_date=query.start_date,
            end_date=query.end_date,
            sort_order="asc",
        )

    @staticmethod
    def transform_data(
        query: FedBalanceSheetQueryParams,
        data: List[Dict[str, Any]],
        **kwargs: Any,
    ) -> List[FedBalanceSheetData]:
        results = []
        for obs in data:
            raw_value = obs.get("value")
            date_str = obs.get("date")
            if not date_str or raw_value in (None, ".", ""):
                continue
            try:
                value_trillions = round(float(raw_value) / _MILLIONS_TO_TRILLIONS, 3)
            except (TypeError, ValueError):
                continue
            results.append(FedBalanceSheetData(date=date_str, value=value_trillions))
        return results

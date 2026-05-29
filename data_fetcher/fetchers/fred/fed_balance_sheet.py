"""Federal Reserve Balance Sheet (Total Assets) Fetcher — FRED WALCL series."""
import logging
from typing import Any, Dict, List, Optional

from data_fetcher.fetchers.base import Fetcher
from data_fetcher.fetchers.fred.series import FredSeriesFetcher
from data_fetcher.models.fred.fed_balance_sheet import FedBalanceSheetData, FedBalanceSheetQueryParams
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
    def extract_data(
        query: FedBalanceSheetQueryParams,
        credentials: Optional[Dict[str, str]] = None,
        **kwargs: Any,
    ) -> List[Dict[str, Any]]:
        api_key = get_api_key(credentials=credentials, api_name="FRED", env_var="FRED_API_KEY")
        return FredSeriesFetcher.fetch_series(
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

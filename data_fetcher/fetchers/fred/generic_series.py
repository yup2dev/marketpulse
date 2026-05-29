"""FRED Generic Series Fetcher — arbitrary series_id via QueryExecutor."""
import asyncio
import logging
from typing import Any, Dict, List, Optional

from data_fetcher.fetchers.base import Fetcher
from data_fetcher.fetchers.fred.series import FredSeriesFetcher
from data_fetcher.models.fred.series import FREDGenericSeriesQueryParams, FREDGenericSeriesData
from data_fetcher.utils.api_keys import get_api_key

log = logging.getLogger(__name__)


class FREDGenericSeriesFetcher(Fetcher[FREDGenericSeriesQueryParams, FREDGenericSeriesData]):
    """임의의 FRED series_id를 QueryExecutor 파이프라인으로 조회."""

    require_credentials = True

    @staticmethod
    def transform_query(params: Dict[str, Any]) -> FREDGenericSeriesQueryParams:
        return FREDGenericSeriesQueryParams(**params)

    @staticmethod
    def extract_data(
        query: FREDGenericSeriesQueryParams,
        credentials: Optional[Dict[str, str]] = None,
        **kwargs: Any,
    ) -> List[Dict[str, Any]]:
        api_key = get_api_key(credentials=credentials, api_name="FRED", env_var="FRED_API_KEY")
        return FredSeriesFetcher.fetch_series(
            series_id=query.series_id,
            api_key=api_key,
            start_date=query.start_date,
            end_date=query.end_date,
            frequency=query.frequency,
            aggregation_method=query.aggregation_method,
            units=query.units,
            limit=query.limit,
            sort_order=query.sort_order,
        )

    @staticmethod
    def transform_data(
        query: FREDGenericSeriesQueryParams,
        data: List[Dict[str, Any]],
        **kwargs: Any,
    ) -> List[FREDGenericSeriesData]:
        result = []
        for obs in (data or []):
            date_str = obs.get('date')
            value_str = obs.get('value')
            if not date_str or value_str in (None, '.', ''):
                continue
            try:
                result.append(FREDGenericSeriesData(date=date_str, value=float(value_str)))
            except (TypeError, ValueError):
                continue
        return result
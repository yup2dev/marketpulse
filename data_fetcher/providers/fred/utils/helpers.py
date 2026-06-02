"""FRED Helpers Module — FredSeriesHelper (was FredSeriesFetcher in fetchers/series.py)."""
import asyncio
import logging
from datetime import date
from typing import Any, Dict, List, Optional

from data_fetcher.utils.async_http_client import amake_request, HTTPClientError

log = logging.getLogger(__name__)

FRED_BASE_URL = "https://api.stlouisfed.org/fred"
FRED_SERIES_OBSERVATIONS_URL = f"{FRED_BASE_URL}/series/observations"

# FRED allows ~120 req/min; cap concurrent requests to avoid bursts
_FRED_SEMAPHORE = asyncio.Semaphore(3)


class FredSeriesHelper:
    """FRED 시계열 데이터 공통 Helper — 캐싱은 QueryExecutor(Redis)에 위임.

    이전 이름: FredSeriesFetcher (fetchers/series.py)
    """

    @staticmethod
    async def fetch_series(
        series_id: str,
        api_key: str,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        frequency: Optional[str] = None,
        aggregation_method: Optional[str] = None,
        units: Optional[str] = None,
        limit: int = 10000,
        sort_order: str = 'desc',
        **kwargs: Any,
    ) -> List[Dict[str, Any]]:
        """FRED API에서 단일 시계열 데이터 조회 (비동기).

        Returns:
            [{'date': '2020-01-01', 'value': '100.0'}, ...]
        """
        params: Dict[str, Any] = {
            'series_id': series_id,
            'api_key': api_key,
            'file_type': 'json',
            'limit': limit,
            'sort_order': sort_order,
        }
        if start_date:
            params['observation_start'] = start_date.isoformat()
        if end_date:
            params['observation_end'] = end_date.isoformat()
        if frequency:
            params['frequency'] = frequency
        if aggregation_method:
            params['aggregation_method'] = aggregation_method
        if units:
            params['units'] = units
        for key, value in kwargs.items():
            if value is not None:
                params[key] = value

        try:
            log.debug("[FRED] fetching series: %s", series_id)
            async with _FRED_SEMAPHORE:
                data = await amake_request(FRED_SERIES_OBSERVATIONS_URL, params=params, timeout=30)
            if 'error_message' in data:
                raise ValueError(f"FRED API Error: {data['error_message']}")
            observations = data.get('observations', [])
            if not observations:
                log.warning("[FRED] no observations for series %s", series_id)
            return observations
        except HTTPClientError as e:
            log.error("[FRED] HTTP error for %s: %s", series_id, e)
            raise
        except Exception as e:
            log.error("[FRED] error for %s: %s", series_id, e)
            raise

    @staticmethod
    async def fetch_multiple_series(
        series_ids: List[str],
        api_key: str,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        **kwargs: Any,
    ) -> Dict[str, List[Dict[str, Any]]]:
        """여러 FRED 시리즈를 asyncio.gather로 동시 조회."""
        async def _safe_fetch(series_id: str) -> tuple[str, List[Dict]]:
            try:
                obs = await FredSeriesHelper.fetch_series(
                    series_id=series_id,
                    api_key=api_key,
                    start_date=start_date,
                    end_date=end_date,
                    **kwargs,
                )
                return series_id, obs
            except Exception as e:
                log.error("[FRED] fetch_multiple failed for %s: %s", series_id, e)
                return series_id, []

        pairs = await asyncio.gather(*[_safe_fetch(sid) for sid in series_ids])
        return dict(pairs)

    @staticmethod
    async def get_series_info(series_id: str, api_key: str) -> Dict[str, Any]:
        """FRED 시리즈 메타데이터 조회."""
        params = {'series_id': series_id, 'api_key': api_key, 'file_type': 'json'}
        try:
            data = await amake_request(f"{FRED_BASE_URL}/series", params=params, timeout=10)
            series_list = data.get('seriess', [])
            return series_list[0] if series_list else {}
        except Exception as e:
            log.error("[FRED] get_series_info error for %s: %s", series_id, e)
            return {}


# Backwards compatibility alias
FredSeriesFetcher = FredSeriesHelper

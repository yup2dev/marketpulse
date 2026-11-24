"""FRED Series Model — 임의의 FRED series_id 시계열 (series/observations).

FRED 로 HTTP 요청을 보내는 곳은 이 fetcher 하나다. 지표 모델(CPI · GDP · 수익률곡선 …)은
series_id 를 골라 FREDGenericSeriesFetcher.fetch_data 를 부른다 (OpenBB fred 의 FredSeriesFetcher 와 같은 구조).
series_id 를 쉼표로 여러 개 주면 동시에 요청한다 — 행마다 series_id 가 붙는다.
"""
# pylint: disable=unused-argument
import asyncio
import logging
from datetime import date as date_type
from typing import Any, Dict, List, Optional

from pydantic import Field

from data_fetcher.abstract_provider.abstract.base_fetchers import ApiFetcher
from data_fetcher.abstract_provider.standard_models.fred_series import (
    FredSeriesData,
    FredSeriesQueryParams,
)
from data_fetcher.providers.fred.utils.helpers import FRED_SERIES_OBSERVATIONS_URL
from data_fetcher.utils.api_keys import get_api_key

log = logging.getLogger(__name__)

# FRED 제한: ~120 req/min (= ~2 req/sec)
# Semaphore(2) + sleep(0.5s) → 슬롯당 최소 0.5s 점유 → 최대 ~2 req/sec
# 모듈 로드 시점에 생성하면 FastAPI 이벤트 루프와 다를 수 있으므로 lazy init 사용
_FRED_SEMAPHORE: Optional[asyncio.Semaphore] = None


def _get_fred_semaphore() -> asyncio.Semaphore:
    global _FRED_SEMAPHORE
    if _FRED_SEMAPHORE is None:
        _FRED_SEMAPHORE = asyncio.Semaphore(2)
    return _FRED_SEMAPHORE


class FREDGenericSeriesQueryParams(FredSeriesQueryParams):
    """FRED Series Query (standard FredSeries 경유)."""

    __json_schema_extra__ = {
        "series_id": {"multiple_items_allowed": True},
    }

    series_id: str = Field(description="FRED 시리즈 ID — 쉼표로 여러 개 (예: 'GDP', 'DGS2,DGS10')")
    start_date: Optional[date_type] = Field(default=None, description="시작일")
    end_date: Optional[date_type] = Field(default=None, description="종료일")
    frequency: Optional[str] = Field(default=None, description="빈도 (d/w/m/q/sa/a)")
    aggregation_method: Optional[str] = Field(default=None, description="집계 방법 (avg/sum/eop)")
    units: Optional[str] = Field(default=None, description="단위 변환 (lin/chg/pch 등)")
    limit: int = Field(default=10000, description="시리즈마다 최대 관찰값 수")
    sort_order: str = Field(default="asc", description="정렬 순서 (asc/desc)")


class FREDGenericSeriesData(FredSeriesData):
    """FRED Series Data — 관찰값 하나 (standard FredSeries 경유)."""

    date: str = Field(description="날짜 (YYYY-MM-DD)")
    value: float = Field(description="관찰값")


class FREDGenericSeriesFetcher(ApiFetcher[FREDGenericSeriesQueryParams, FREDGenericSeriesData]):
    """Transform the query, extract and transform the data from the FRED endpoint."""

    api_name = "FRED"
    api_key_env = "FRED_API_KEY"

    require_credentials = True

    @staticmethod
    def transform_query(params: Dict[str, Any]) -> FREDGenericSeriesQueryParams:
        """Transform query."""
        return FREDGenericSeriesQueryParams(**params)

    @staticmethod
    async def aextract_data(
        query: FREDGenericSeriesQueryParams,
        credentials: Optional[Dict[str, str]] = None,
        **kwargs: Any,
    ) -> List[Dict[str, Any]]:
        """Extract data — 시리즈마다 요청 하나, 여러 개면 동시에.

        시리즈 하나면 실패를 그대로 올린다. 여러 개면 실패한 시리즈만 비운다 (나머지는 보여 준다).
        """
        # pylint: disable=import-outside-toplevel
        from data_fetcher.utils.provider_helpers import amake_json_request

        api_key = get_api_key(credentials=credentials, api_name="FRED", env_var="FRED_API_KEY")
        series_ids = [s.strip() for s in query.series_id.split(",") if s.strip()]

        async def fetch_one(series_id: str) -> List[Dict[str, Any]]:
            params: Dict[str, Any] = {
                "series_id": series_id,
                "api_key": api_key,
                "file_type": "json",
                "limit": query.limit,
                "sort_order": query.sort_order,
            }
            if query.start_date:
                params["observation_start"] = query.start_date.isoformat()
            if query.end_date:
                params["observation_end"] = query.end_date.isoformat()
            if query.frequency:
                params["frequency"] = query.frequency
            if query.aggregation_method:
                params["aggregation_method"] = query.aggregation_method
            if query.units:
                params["units"] = query.units
            try:
                log.debug("[FRED] fetching series: %s", series_id)
                async with _get_fred_semaphore():
                    data = await amake_json_request(FRED_SERIES_OBSERVATIONS_URL, params=params, timeout=30)
                    await asyncio.sleep(0.5)  # 슬롯 점유 중 최소 간격 → ~2 req/sec 상한
                if "error_message" in data:
                    raise ValueError(f"FRED API Error: {data['error_message']}")
            except Exception as e:
                log.error("[FRED] error for %s: %s", series_id, e)
                raise
            observations = data.get("observations", [])
            if not observations:
                log.warning("[FRED] no observations for series %s", series_id)
            return [{**obs, "series_id": series_id} for obs in observations]

        if len(series_ids) == 1:
            return await fetch_one(series_ids[0])

        async def safe(series_id: str) -> List[Dict[str, Any]]:
            try:
                return await fetch_one(series_id)
            except Exception:  # noqa: BLE001 — 여러 시리즈 중 하나가 실패해도 나머지는 보여 준다
                return []

        results = await asyncio.gather(*[safe(s) for s in series_ids])
        return [obs for rows in results for obs in rows]

    @staticmethod
    def transform_data(
        query: FREDGenericSeriesQueryParams,
        data: List[Dict[str, Any]],
        **kwargs: Any,
    ) -> List[FREDGenericSeriesData]:
        """Transform data — 미발표('.') · 빈 값은 뺀다."""
        result = []
        for obs in (data or []):
            date_str = obs.get('date')
            value_str = obs.get('value')
            if not date_str or value_str in (None, '.', ''):
                continue
            try:
                result.append(FREDGenericSeriesData(
                    date=date_str, value=float(value_str), series_id=obs.get("series_id"),
                ))
            except (TypeError, ValueError):
                continue
        return result

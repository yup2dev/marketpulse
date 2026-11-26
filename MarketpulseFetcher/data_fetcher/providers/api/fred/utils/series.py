"""FRED series/observations HTTP — FRED 로 요청을 보내는 곳은 여기 하나다.

    fred_series(params, credentials)   series_id(쉼표로 여러 개) 관찰값 → [FREDGenericSeriesData]
    fetch_observations(query, ...)     HTTP 만 (원시 관찰값 dict 목록)
    to_series_rows(data)               원시 관찰값 → FREDGenericSeriesData (미발표 '.' · 빈 값은 뺀다)

지표 모델(CPI · GDP · 수익률곡선 …)은 series_id 를 골라 fred_series 를 부른다. 다른 fetcher 를 부르지 않는다
(fetcher 안에서 다른 fetcher 를 부르지 않는다 — tests/test_module_boundaries.py). 범용 FREDGenericSeriesFetcher 도
이 함수들을 쓴다. 여러 시리즈는 동시에 요청하고, 그중 하나가 실패하면 그 시리즈만 비운다.
"""
import asyncio
import logging
from typing import Any, Dict, List, Optional

from data_fetcher.providers.api.fred.utils.helpers import FRED_SERIES_OBSERVATIONS_URL
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


async def fetch_observations(query: Any, credentials: Optional[Dict[str, str]] = None) -> List[Dict[str, Any]]:
    """시리즈마다 요청 하나, 여러 개면 동시에. 시리즈 하나면 실패를 그대로 올린다."""
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


def to_series_rows(data: List[Dict[str, Any]]) -> list:
    """원시 관찰값 → FREDGenericSeriesData. 미발표('.') · 빈 값은 뺀다."""
    from data_fetcher.providers.api.fred.models.generic_series import FREDGenericSeriesData  # 순환 import 방지

    result = []
    for obs in (data or []):
        date_str = obs.get("date")
        value_str = obs.get("value")
        if not date_str or value_str in (None, ".", ""):
            continue
        try:
            result.append(FREDGenericSeriesData(
                date=date_str, value=float(value_str), series_id=obs.get("series_id"),
            ))
        except (TypeError, ValueError):
            continue
    return result


async def fred_series(params: Dict[str, Any], credentials: Optional[Dict[str, str]] = None) -> list:
    """series_id(쉼표로 여러 개) 관찰값 — FREDGenericSeriesFetcher.fetch_data 와 같은 결과 (다른 fetcher 를 거치지 않는다)."""
    from data_fetcher.providers.api.fred.models.generic_series import FREDGenericSeriesQueryParams  # 순환 import 방지

    return to_series_rows(await fetch_observations(FREDGenericSeriesQueryParams(**params), credentials))

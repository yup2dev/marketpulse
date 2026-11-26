"""KOSIS statisticsParameterData HTTP — KOSIS 로 요청을 보내는 곳은 여기 하나다.

    kosis_series(params, credentials)   통계표 시계열 → AnnotatedResult(KOSISSeriesData 목록, 통계표 metadata)
    fetch_rows(query, credentials)      HTTP 만 (원시 행 목록 — 오류 코드는 예외로)
    to_series_result(query, rows)       원시 행 → AnnotatedResult (시점순 정렬 · 콤마 제거 · 통계부호는 None)

지표 모델(광공업생산지수 · 가동률 · 수출 …)은 파라미터를 코드로 바꿔 kosis_series 를 부른다. 다른 fetcher 를
부르지 않는다 (tests/test_module_boundaries.py). 범용 KOSISSeriesFetcher 도 이 함수들을 쓴다.
항목 · 분류 코드를 '+' 로 이으면 여러 계열을 요청 한 번에 받는다.
"""
import asyncio
import logging
from typing import Any, Dict, List, Optional

from data_fetcher.abstract_provider.abstract.annotated_result import AnnotatedResult
from data_fetcher.providers.api.kosis.utils.helpers import (
    KOSIS_ERRORS,
    KOSIS_KEY_ERRORS,
    KOSIS_NO_DATA,
    KOSIS_PARAM_DATA_URL,
    KOSIS_RATE_ERRORS,
    default_range,
    from_period,
    to_float,
    to_period,
    to_unit,
)
from data_fetcher.utils.api_keys import CredentialsError, get_api_key
from data_fetcher.utils.http_client import RateLimitError

log = logging.getLogger(__name__)

# KOSIS 제한: 분당 200건 (오류코드 40). 같은 요청은 서버 실행 계층 캐시가 흡수하고,
# 이건 캐시가 비었을 때 몰리는 요청의 완충 — 동시 2건, 슬롯마다 0.3s 점유.
# 모듈 로드 시점에 만들면 FastAPI 이벤트 루프와 다를 수 있으므로 lazy init
_KOSIS_SEMAPHORE: Optional[asyncio.Semaphore] = None


def _get_kosis_semaphore() -> asyncio.Semaphore:
    global _KOSIS_SEMAPHORE
    if _KOSIS_SEMAPHORE is None:
        _KOSIS_SEMAPHORE = asyncio.Semaphore(2)
    return _KOSIS_SEMAPHORE


async def fetch_rows(query: Any, credentials: Optional[Dict[str, str]] = None) -> List[Dict[str, Any]]:
    """Extract data — 요청 한 번. 정상 = 행 배열, 오류 = 최상위 {err, errMsg}."""
    # pylint: disable=import-outside-toplevel
    from data_fetcher.utils.provider_helpers import amake_json_request

    api_key = get_api_key(credentials=credentials, api_name="KOSIS", env_var="KOSIS_API_KEY")
    params: Dict[str, Any] = {
        "method": "getList",
        "apiKey": api_key,
        "orgId": query.org_id,
        "tblId": query.tbl_id,
        "itmId": query.itm_id,
        "objL1": query.obj_l1,
        "objL2": query.obj_l2 or "",
        "objL3": query.obj_l3 or "",
        "prdSe": query.prd_se,
        "format": "json",
        "jsonVD": "Y",
    }
    if query.start_date:
        params["startPrdDe"] = to_period(query.start_date, query.prd_se)
    if query.end_date:
        params["endPrdDe"] = to_period(query.end_date, query.prd_se)

    log.debug("[KOSIS] %s/%s itm=%s obj=%s|%s", query.org_id, query.tbl_id, query.itm_id, query.obj_l1, query.obj_l2)
    try:
        async with _get_kosis_semaphore():
            data = await amake_json_request(KOSIS_PARAM_DATA_URL, params=params, timeout=30)
            await asyncio.sleep(0.3)   # 슬롯 점유 중 최소 간격 (분당 200건 제한)
    except Exception as e:
        log.error("[KOSIS] request failed for %s/%s: %s", query.org_id, query.tbl_id, e)
        raise

    if isinstance(data, dict):
        code = str(data.get("err", ""))
        if code == KOSIS_NO_DATA:
            log.warning("[KOSIS] no data for %s/%s", query.org_id, query.tbl_id)
            return []
        msg = data.get("errMsg") or KOSIS_ERRORS.get(code, "unknown error")
        log.error("[KOSIS] API error %s for %s/%s: %s", code, query.org_id, query.tbl_id, msg)
        if code in KOSIS_KEY_ERRORS:
            raise CredentialsError(f"KOSIS API key error {code}: {msg}")
        if code in KOSIS_RATE_ERRORS:
            raise RateLimitError(f"KOSIS rate limit {code}: {msg}", status_code=429)
        raise ValueError(f"KOSIS API Error {code}: {msg}")
    return data if isinstance(data, list) else []


def to_series_result(query: Any, data: List[Dict[str, Any]]) -> AnnotatedResult:
    from data_fetcher.providers.api.kosis.models.series import KOSISSeriesData  # 순환 import 방지

    """Transform data — 시점순 정렬 · 콤마 제거 · 통계부호는 None. 통계표 정보는 metadata 로.

    빈 결과는 EmptyDataError 가 아니라 빈 목록 — 게이트웨이가 예외를 400 으로 바꿔 위젯이 '오류'를 띄우므로.
    """
    rows = data or []
    result: List[KOSISSeriesData] = []
    units: Dict[str, str] = {}
    for row in rows:
        d = from_period(row.get("PRD_DE"), row.get("PRD_SE") or query.prd_se)
        if d is None:
            continue
        unit = to_unit(row.get("UNIT_NM"))
        if row.get("ITM_ID") and unit:
            units[row["ITM_ID"]] = unit
        result.append(KOSISSeriesData(
            date=d,
            value=to_float(row.get("DT")),
            item_id=row.get("ITM_ID"),
            item_name=row.get("ITM_NM"),
            category_id=row.get("C1"),
            category_name=(row.get("C1_NM") or "").strip() or None,
            category2_id=row.get("C2"),
            category2_name=(row.get("C2_NM") or "").strip() or None,
            unit=unit,
        ))
    result.sort(key=lambda r: (r.date, r.item_id or "", r.category_id or "", r.category2_id or ""))
    metadata = {
        "org_id": query.org_id,
        "tbl_id": query.tbl_id,
        "table_name": next((r["TBL_NM"] for r in rows if r.get("TBL_NM")), None),
        "units": units,
        "updated_at": max((r.get("LST_CHN_DE") or "" for r in rows), default="") or None,
    }
    return AnnotatedResult(result=result, metadata=metadata)


async def kosis_series(params: Dict[str, Any], credentials: Optional[Dict[str, str]] = None) -> AnnotatedResult:
    """통계표 시계열 — KOSISSeriesFetcher.fetch_data 와 같은 결과 (다른 fetcher 를 거치지 않는다)."""
    from data_fetcher.providers.api.kosis.models.series import KOSISSeriesQueryParams  # 순환 import 방지

    query = KOSISSeriesQueryParams(**default_range(params))
    return to_series_result(query, await fetch_rows(query, credentials))

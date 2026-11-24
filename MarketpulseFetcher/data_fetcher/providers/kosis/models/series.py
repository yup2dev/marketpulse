"""KOSIS Series Model — 통계청 국가통계포털 통계표 시계열 (statisticsParameterData).

KOSIS 로 HTTP 요청을 보내는 곳은 이 fetcher 하나다. 지표 모델(광공업생산지수 · 가동률 · 수출 …)은
파라미터를 코드로 바꿔 KOSISSeriesFetcher.fetch_data 를 부른다.
항목 · 분류 코드를 '+' 로 이으면 여러 계열을 요청 한 번에 받는다.
"""
# pylint: disable=unused-argument
import asyncio
import logging
from typing import Any, Dict, List, Optional

from pydantic import Field, field_validator

from data_fetcher.abstract_provider.abstract.annotated_result import AnnotatedResult
from data_fetcher.abstract_provider.abstract.base_fetchers import ApiFetcher
from data_fetcher.abstract_provider.standard_models.kosis_series import (
    KosisSeriesData,
    KosisSeriesQueryParams,
)
from data_fetcher.providers.kosis.utils.helpers import (
    KOSIS_ERRORS,
    KOSIS_KEY_ERRORS,
    KOSIS_NO_DATA,
    KOSIS_PARAM_DATA_URL,
    KOSIS_RATE_ERRORS,
    PRD_SE_CHOICES,
    check_prd_se,
    default_range,
    from_period,
    to_float,
    to_period,
    to_unit,
)
from data_fetcher.utils.api_keys import CredentialsError, get_api_key
from data_fetcher.utils.http_client import RateLimitError

log = logging.getLogger(__name__)

# KOSIS 제한: 분당 200건 (오류코드 40). 같은 요청은 QueryExecutor 캐시가 흡수하고,
# 이건 캐시가 비었을 때 몰리는 요청의 완충 — 동시 2건, 슬롯마다 0.3s 점유.
# 모듈 로드 시점에 만들면 FastAPI 이벤트 루프와 다를 수 있으므로 lazy init
_KOSIS_SEMAPHORE: Optional[asyncio.Semaphore] = None


def _get_kosis_semaphore() -> asyncio.Semaphore:
    global _KOSIS_SEMAPHORE
    if _KOSIS_SEMAPHORE is None:
        _KOSIS_SEMAPHORE = asyncio.Semaphore(2)
    return _KOSIS_SEMAPHORE


class KOSISSeriesQueryParams(KosisSeriesQueryParams):
    """KOSIS Series Query — 통계표 코드를 직접 받는다."""

    __json_schema_extra__ = {
        "prd_se": {"choices": PRD_SE_CHOICES},
    }

    org_id: str = Field(description="기관 ID (예: 101 통계청)")
    tbl_id: str = Field(description="통계표 ID (예: DT_1F02001)")
    itm_id: str = Field(default="ALL", description="항목 ID ('+' 로 여러 개, ALL = 전부)")
    obj_l1: str = Field(default="ALL", description="분류1 코드 ('+' 로 여러 개, ALL = 전부)")
    obj_l2: Optional[str] = Field(default=None, description="분류2 코드 (없으면 비움)")
    obj_l3: Optional[str] = Field(default=None, description="분류3 코드 (없으면 비움)")

    @field_validator("prd_se", mode="before")
    @classmethod
    def validate_prd_se(cls, v: Any) -> str:
        """Validate prd_se."""
        return check_prd_se(v)


class KOSISSeriesData(KosisSeriesData):
    """KOSIS Series Data — 통계표 한 칸 (시점 × 항목 × 분류)."""

    category2_id: Optional[str] = Field(default=None, description="분류2 코드")
    category2_name: Optional[str] = Field(default=None, description="분류2 이름")


class KOSISSeriesFetcher(ApiFetcher[KOSISSeriesQueryParams, KOSISSeriesData]):
    """Transform the query, extract and transform the data from the KOSIS endpoint."""

    api_name = "KOSIS"
    api_key_env = "KOSIS_API_KEY"
    param_choices = {"prd_se": PRD_SE_CHOICES}

    require_credentials = True

    @staticmethod
    def transform_query(params: Dict[str, Any]) -> KOSISSeriesQueryParams:
        """Transform query."""
        return KOSISSeriesQueryParams(**default_range(params))

    @staticmethod
    async def aextract_data(
        query: KOSISSeriesQueryParams,
        credentials: Optional[Dict[str, str]] = None,
        **kwargs: Any,
    ) -> List[Dict[str, Any]]:
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

    @staticmethod
    def transform_data(
        query: KOSISSeriesQueryParams,
        data: List[Dict[str, Any]],
        **kwargs: Any,
    ) -> AnnotatedResult[List[KOSISSeriesData]]:
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

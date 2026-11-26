"""KOSIS Series Model — 통계청 국가통계포털 통계표 시계열 (statisticsParameterData).

KOSIS HTTP 는 utils/series.py 한 곳이다 — 이 fetcher 와 지표 모델(광공업생산지수 · 가동률 · 수출 …)이 모두 그걸 쓴다
(지표 모델은 다른 fetcher 를 부르지 않고 kosis_series 를 부른다).
항목 · 분류 코드를 '+' 로 이으면 여러 계열을 요청 한 번에 받는다.
"""
# pylint: disable=unused-argument
import logging
from typing import Any, Dict, List, Optional

from pydantic import Field, field_validator

from data_fetcher.abstract_provider.abstract.annotated_result import AnnotatedResult
from data_fetcher.abstract_provider.abstract.base_fetchers import ApiFetcher
from data_fetcher.abstract_provider.standard_models.kosis_series import (
    KosisSeriesData,
    KosisSeriesQueryParams,
)
from data_fetcher.providers.api.kosis.utils.helpers import PRD_SE_CHOICES, check_prd_se, default_range
from data_fetcher.providers.api.kosis.utils.series import fetch_rows, to_series_result

log = logging.getLogger(__name__)

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
        """Extract data — 요청 한 번 (utils/series.fetch_rows)."""
        return await fetch_rows(query, credentials)

    @staticmethod
    def transform_data(
        query: KOSISSeriesQueryParams,
        data: List[Dict[str, Any]],
        **kwargs: Any,
    ) -> AnnotatedResult[List[KOSISSeriesData]]:
        """Transform data — 시점순 정렬 · 콤마 제거 · 통계부호는 None (utils/series.to_series_result)."""
        return to_series_result(query, data)

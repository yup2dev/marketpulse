"""KOSIS Capacity Utilization Model — 산업별 제조업 생산능력 · 가동률지수 (2020=100).

통계표: 국가데이터처 101 / DT_1F32001 '제조업 생산능력 및 가동률지수(2020=100)', 1971.01~ 월·분기·연.
분류1 = 산업(KSIC).
"""
# pylint: disable=unused-argument
from typing import Any, Dict, List, Optional

from pydantic import Field, field_validator

from data_fetcher.abstract_provider.abstract.annotated_result import AnnotatedResult
from data_fetcher.abstract_provider.abstract.base_fetchers import ApiFetcher
from data_fetcher.abstract_provider.standard_models.kosis_series import (
    KosisSeriesData,
    KosisSeriesQueryParams,
)
from data_fetcher.abstract_provider.abstract.annotated_result import metadata_of_result, unwrap_result
from data_fetcher.providers.api.kosis.utils.series import kosis_series
from data_fetcher.providers.api.kosis.utils.helpers import (
    CAPACITY_UTILIZATION_MEASURES,
    CAPACITY_UTILIZATION_TABLE,
    INDUSTRY_CATEGORIES,
    PRD_SE_CHOICES,
    add_changes,
    check_categories,
    check_choice,
    check_prd_se,
    default_range,
    join_codes,
    lookback_start,
    trim_before,
)


class KOSISCapacityUtilizationQueryParams(KosisSeriesQueryParams):
    """KOSIS Capacity Utilization Query."""

    __json_schema_extra__ = {
        "category": {"multiple_items_allowed": True, "choices": list(INDUSTRY_CATEGORIES)},
        "measure": {"choices": list(CAPACITY_UTILIZATION_MEASURES)},
        "prd_se": {"choices": PRD_SE_CHOICES},
    }

    category: str = Field(default="manufacturing", description="산업 (쉼표로 여러 개, all = 전부)")
    measure: str = Field(default="utilization", description="utilization 가동률 · capacity 생산능력")
    seasonally_adjusted: bool = Field(default=False, description="계절조정지수 (가동률만, False 면 원지수)")

    @field_validator("category", mode="before")
    @classmethod
    def validate_category(cls, v: Any) -> str:
        """Validate category."""
        return check_categories(v, INDUSTRY_CATEGORIES)

    @field_validator("measure", mode="before")
    @classmethod
    def validate_measure(cls, v: Any) -> str:
        """Validate measure."""
        return check_choice("measure", v, CAPACITY_UTILIZATION_MEASURES, "utilization")

    @field_validator("prd_se", mode="before")
    @classmethod
    def validate_prd_se(cls, v: Any) -> str:
        """Validate prd_se."""
        return check_prd_se(v)


class KOSISCapacityUtilizationData(KosisSeriesData):
    """KOSIS Capacity Utilization Data."""

    category: str = Field(description="산업 (category 키)")
    measure: str = Field(description="utilization · capacity")


class KOSISCapacityUtilizationFetcher(
    ApiFetcher[KOSISCapacityUtilizationQueryParams, KOSISCapacityUtilizationData]
):
    """Transform the query, extract and transform the data from the KOSIS endpoints."""

    api_name = "KOSIS"
    api_key_env = "KOSIS_API_KEY"
    param_choices = {
        "category": list(INDUSTRY_CATEGORIES),
        "measure": list(CAPACITY_UTILIZATION_MEASURES),
        "prd_se": PRD_SE_CHOICES,
    }

    @staticmethod
    def transform_query(params: Dict[str, Any]) -> KOSISCapacityUtilizationQueryParams:
        """Transform query."""
        return KOSISCapacityUtilizationQueryParams(**default_range(params))

    @staticmethod
    async def aextract_data(
        query: KOSISCapacityUtilizationQueryParams,
        credentials: Optional[Dict[str, str]] = None,
        **kwargs: Any,
    ) -> Dict[str, Any]:
        """Extract data — 산업 코드를 '+' 로 이어 kosis_series 한 번."""
        org_id, tbl_id = CAPACITY_UTILIZATION_TABLE
        raw_item, sa_item = CAPACITY_UTILIZATION_MEASURES[query.measure]
        item_query = dict(
            org_id=org_id,
            tbl_id=tbl_id,
            itm_id=sa_item if query.seasonally_adjusted else raw_item,
            obj_l1=join_codes(query.category, INDUSTRY_CATEGORIES),
            prd_se=query.prd_se,
            start_date=lookback_start(query.start_date),   # 증감률용 1년 앞부터
            end_date=query.end_date,
        )
        temp = await kosis_series(item_query, credentials)
        return {"data": [d.model_dump() for d in unwrap_result(temp)], "metadata": metadata_of_result(temp)}

    @staticmethod
    def transform_data(
        query: KOSISCapacityUtilizationQueryParams,
        data: Dict[str, Any],
        **kwargs: Any,
    ) -> AnnotatedResult[List[KOSISCapacityUtilizationData]]:
        """Transform data — 산업 코드 → category 키, 증감률, 요청 기간만."""
        key_of = {code: key for key, code in INDUSTRY_CATEGORIES.items()}
        rows = []
        for d in data["data"]:
            key = key_of.get(d.get("category_id"))   # 분류1 = 산업
            if key is None:
                continue
            rows.append({
                "date": d["date"],
                "value": d.get("value"),
                "category": key,
                "category_id": d.get("category_id"),
                "category_name": d.get("category_name"),
                "item_id": d.get("item_id"),
                "item_name": d.get("item_name"),
                "unit": d.get("unit"),
            })
        records = trim_before(add_changes(rows, query.prd_se), query.start_date)
        return AnnotatedResult(
            result=[KOSISCapacityUtilizationData(measure=query.measure, **r) for r in records],
            metadata=data.get("metadata", {}),
        )

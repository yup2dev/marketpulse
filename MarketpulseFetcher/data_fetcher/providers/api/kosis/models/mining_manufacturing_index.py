"""KOSIS Mining & Manufacturing Index Model — 산업별 광공업 생산 · 출하 · 재고지수 (2020=100).

통계표: 국가데이터처 101 / DT_1F02001 '시도/산업별 광공업생산지수(2020=100)', 1975.01~ 월·분기·연.
분류1 = 시도(전국 고정), 분류2 = 산업(KSIC).
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
from data_fetcher.providers.api.kosis.models.series import KOSISSeriesFetcher
from data_fetcher.providers.api.kosis.utils.helpers import (
    INDUSTRY_CATEGORIES,
    MINING_MANUFACTURING_MEASURES,
    MINING_MANUFACTURING_REGION,
    MINING_MANUFACTURING_TABLE,
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


class KOSISMiningManufacturingIndexQueryParams(KosisSeriesQueryParams):
    """KOSIS Mining & Manufacturing Index Query."""

    __json_schema_extra__ = {
        "category": {"multiple_items_allowed": True, "choices": list(INDUSTRY_CATEGORIES)},
        "measure": {"choices": list(MINING_MANUFACTURING_MEASURES)},
        "prd_se": {"choices": PRD_SE_CHOICES},
    }

    category: str = Field(default="manufacturing", description="산업 (쉼표로 여러 개, all = 전부)")
    measure: str = Field(default="production", description="production 생산 · shipment 출하 · inventory 재고")
    seasonally_adjusted: bool = Field(default=False, description="계절조정지수 (False 면 원지수)")

    @field_validator("category", mode="before")
    @classmethod
    def validate_category(cls, v: Any) -> str:
        """Validate category."""
        return check_categories(v, INDUSTRY_CATEGORIES)

    @field_validator("measure", mode="before")
    @classmethod
    def validate_measure(cls, v: Any) -> str:
        """Validate measure."""
        return check_choice("measure", v, MINING_MANUFACTURING_MEASURES, "production")

    @field_validator("prd_se", mode="before")
    @classmethod
    def validate_prd_se(cls, v: Any) -> str:
        """Validate prd_se."""
        return check_prd_se(v)


class KOSISMiningManufacturingIndexData(KosisSeriesData):
    """KOSIS Mining & Manufacturing Index Data."""

    category: str = Field(description="산업 (category 키)")
    measure: str = Field(description="production · shipment · inventory")


class KOSISMiningManufacturingIndexFetcher(
    ApiFetcher[KOSISMiningManufacturingIndexQueryParams, KOSISMiningManufacturingIndexData]
):
    """Transform the query, extract and transform the data from the KOSIS endpoints."""

    api_name = "KOSIS"
    api_key_env = "KOSIS_API_KEY"
    param_choices = {
        "category": list(INDUSTRY_CATEGORIES),
        "measure": list(MINING_MANUFACTURING_MEASURES),
        "prd_se": PRD_SE_CHOICES,
    }

    @staticmethod
    def transform_query(params: Dict[str, Any]) -> KOSISMiningManufacturingIndexQueryParams:
        """Transform query."""
        return KOSISMiningManufacturingIndexQueryParams(**default_range(params))

    @staticmethod
    async def aextract_data(
        query: KOSISMiningManufacturingIndexQueryParams,
        credentials: Optional[Dict[str, str]] = None,
        **kwargs: Any,
    ) -> Dict[str, Any]:
        """Extract data — 산업 코드를 '+' 로 이어 KOSISSeriesFetcher 한 번."""
        org_id, tbl_id = MINING_MANUFACTURING_TABLE
        raw_item, sa_item = MINING_MANUFACTURING_MEASURES[query.measure]
        item_query = dict(
            org_id=org_id,
            tbl_id=tbl_id,
            itm_id=sa_item if query.seasonally_adjusted else raw_item,
            obj_l1=MINING_MANUFACTURING_REGION,
            obj_l2=join_codes(query.category, INDUSTRY_CATEGORIES),
            prd_se=query.prd_se,
            start_date=lookback_start(query.start_date),   # 증감률용 1년 앞부터
            end_date=query.end_date,
        )
        temp = await KOSISSeriesFetcher.fetch_data(item_query, credentials)
        return {"data": [d.model_dump() for d in unwrap_result(temp)], "metadata": metadata_of_result(temp)}

    @staticmethod
    def transform_data(
        query: KOSISMiningManufacturingIndexQueryParams,
        data: Dict[str, Any],
        **kwargs: Any,
    ) -> AnnotatedResult[List[KOSISMiningManufacturingIndexData]]:
        """Transform data — 산업 코드 → category 키, 증감률, 요청 기간만."""
        key_of = {code: key for key, code in INDUSTRY_CATEGORIES.items()}
        rows = []
        for d in data["data"]:
            key = key_of.get(d.get("category2_id"))   # 분류2 = 산업
            if key is None:
                continue
            rows.append({
                "date": d["date"],
                "value": d.get("value"),
                "category": key,
                "category_id": d.get("category2_id"),
                "category_name": d.get("category2_name"),
                "item_id": d.get("item_id"),
                "item_name": d.get("item_name"),
                "unit": d.get("unit"),
            })
        records = trim_before(add_changes(rows, query.prd_se), query.start_date)
        return AnnotatedResult(
            result=[KOSISMiningManufacturingIndexData(measure=query.measure, **r) for r in records],
            metadata=data.get("metadata", {}),
        )

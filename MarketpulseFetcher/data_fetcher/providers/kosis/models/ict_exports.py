"""KOSIS ICT Exports Model — IT산업별 월별 수출액 (반도체 · 메모리 · DRAM · 디스플레이 · 축전지 …).

통계표: 과학기술정보통신부 127 / DT_092_115_2009_S023 'IT산업별/월별 수출 현황', 1996.01~ 월. 단위 달러.
분류1 = IT 품목 (코드 앞에 표 고유 접두사가 붙는다).
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
from data_fetcher.providers.kosis.models.series import KOSISSeriesFetcher
from data_fetcher.providers.kosis.utils.helpers import (
    ICT_EXPORTS_CATEGORIES,
    ICT_EXPORTS_ITEM,
    ICT_EXPORTS_PREFIX,
    ICT_EXPORTS_TABLE,
    add_changes,
    check_categories,
    default_range,
    join_codes,
    lookback_start,
    trim_before,
)


class KOSISIctExportsQueryParams(KosisSeriesQueryParams):
    """KOSIS ICT Exports Query — 월간만 제공."""

    __json_schema_extra__ = {
        "category": {"multiple_items_allowed": True, "choices": list(ICT_EXPORTS_CATEGORIES)},
        "prd_se": {"choices": ["M"]},
    }

    category: str = Field(default="semiconductor", description="IT 품목 (쉼표로 여러 개, all = 전부)")

    @field_validator("category", mode="before")
    @classmethod
    def validate_category(cls, v: Any) -> str:
        """Validate category."""
        return check_categories(v, ICT_EXPORTS_CATEGORIES)

    @field_validator("prd_se", mode="before")
    @classmethod
    def validate_prd_se(cls, v: Any) -> str:
        """Validate prd_se — 이 통계표는 월(M)만 있다."""
        if str(v or "M").upper() != "M":
            raise ValueError(f"Invalid prd_se: {v}. Available: M")
        return "M"


class KOSISIctExportsData(KosisSeriesData):
    """KOSIS ICT Exports Data."""

    category: str = Field(description="IT 품목 (category 키)")


class KOSISIctExportsFetcher(ApiFetcher[KOSISIctExportsQueryParams, KOSISIctExportsData]):
    """Transform the query, extract and transform the data from the KOSIS endpoints."""

    api_name = "KOSIS"
    api_key_env = "KOSIS_API_KEY"
    param_choices = {"category": list(ICT_EXPORTS_CATEGORIES)}

    @staticmethod
    def transform_query(params: Dict[str, Any]) -> KOSISIctExportsQueryParams:
        """Transform query."""
        return KOSISIctExportsQueryParams(**default_range(params))

    @staticmethod
    async def aextract_data(
        query: KOSISIctExportsQueryParams,
        credentials: Optional[Dict[str, str]] = None,
        **kwargs: Any,
    ) -> Dict[str, Any]:
        """Extract data — 품목 코드를 '+' 로 이어 KOSISSeriesFetcher 한 번."""
        org_id, tbl_id = ICT_EXPORTS_TABLE
        item_query = dict(
            org_id=org_id,
            tbl_id=tbl_id,
            itm_id=ICT_EXPORTS_ITEM,
            obj_l1=join_codes(query.category, ICT_EXPORTS_CATEGORIES, ICT_EXPORTS_PREFIX),
            prd_se="M",
            start_date=lookback_start(query.start_date),   # 증감률용 1년 앞부터
            end_date=query.end_date,
        )
        temp = await KOSISSeriesFetcher.fetch_data(item_query, credentials)
        return {"data": [d.model_dump() for d in temp.result], "metadata": temp.metadata}

    @staticmethod
    def transform_data(
        query: KOSISIctExportsQueryParams,
        data: Dict[str, Any],
        **kwargs: Any,
    ) -> AnnotatedResult[List[KOSISIctExportsData]]:
        """Transform data — 접두사 뗀 품목 코드 → category 키, 단위 USD, 증감률, 요청 기간만."""
        key_of = {ICT_EXPORTS_PREFIX + code: key for key, code in ICT_EXPORTS_CATEGORIES.items()}
        rows = []
        for d in data["data"]:
            key = key_of.get(d.get("category_id"))
            if key is None:
                continue
            rows.append({
                "date": d["date"],
                "value": d.get("value"),
                "category": key,
                "category_id": ICT_EXPORTS_CATEGORIES[key],
                "category_name": d.get("category_name"),
                "item_id": d.get("item_id"),
                "item_name": "수출액",
                "unit": "USD",
            })
        records = trim_before(add_changes(rows, "M"), query.start_date)
        return AnnotatedResult(
            result=[KOSISIctExportsData(**r) for r in records],
            metadata=data.get("metadata", {}),
        )

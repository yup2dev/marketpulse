"""KOSIS Product Trade Model — 품목별(SITC) 수출액 · 수입액 (승용차 · 선박 · 축전지 · 메모리 · 타이어 …).

통계표: 한국무역협회 360 / DT_1R11001_FRM101 '품목별 수출액, 수입액', 2020.01~ 월·분기·연. 원 단위 천달러.
분류1 = SITC 품목 (코드 앞에 표 고유 접두사가 붙는다). 값은 ict_exports 와 같은 USD 로 정규화한다.
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
    PRD_SE_CHOICES,
    PRODUCT_TRADE_CATEGORIES,
    PRODUCT_TRADE_FLOWS,
    PRODUCT_TRADE_PREFIX,
    PRODUCT_TRADE_TABLE,
    PRODUCT_TRADE_UNIT_SCALE,
    add_changes,
    check_categories,
    check_choice,
    check_prd_se,
    default_range,
    join_codes,
    lookback_start,
    trim_before,
)


class KOSISProductTradeQueryParams(KosisSeriesQueryParams):
    """KOSIS Product Trade Query."""

    __json_schema_extra__ = {
        "category": {"multiple_items_allowed": True, "choices": list(PRODUCT_TRADE_CATEGORIES)},
        "flow": {"choices": list(PRODUCT_TRADE_FLOWS)},
        "prd_se": {"choices": PRD_SE_CHOICES},
    }

    category: str = Field(default="total", description="SITC 품목 (쉼표로 여러 개, all = 전부)")
    flow: str = Field(default="export", description="export 수출액 · import 수입액")

    @field_validator("category", mode="before")
    @classmethod
    def validate_category(cls, v: Any) -> str:
        """Validate category."""
        return check_categories(v, PRODUCT_TRADE_CATEGORIES)

    @field_validator("flow", mode="before")
    @classmethod
    def validate_flow(cls, v: Any) -> str:
        """Validate flow."""
        return check_choice("flow", v, PRODUCT_TRADE_FLOWS, "export")

    @field_validator("prd_se", mode="before")
    @classmethod
    def validate_prd_se(cls, v: Any) -> str:
        """Validate prd_se."""
        return check_prd_se(v)


class KOSISProductTradeData(KosisSeriesData):
    """KOSIS Product Trade Data."""

    category: str = Field(description="SITC 품목 (category 키)")
    flow: str = Field(description="export · import")


class KOSISProductTradeFetcher(ApiFetcher[KOSISProductTradeQueryParams, KOSISProductTradeData]):
    """Transform the query, extract and transform the data from the KOSIS endpoints."""

    api_name = "KOSIS"
    api_key_env = "KOSIS_API_KEY"
    param_choices = {
        "category": list(PRODUCT_TRADE_CATEGORIES),
        "flow": list(PRODUCT_TRADE_FLOWS),
        "prd_se": PRD_SE_CHOICES,
    }

    @staticmethod
    def transform_query(params: Dict[str, Any]) -> KOSISProductTradeQueryParams:
        """Transform query."""
        return KOSISProductTradeQueryParams(**default_range(params))

    @staticmethod
    async def aextract_data(
        query: KOSISProductTradeQueryParams,
        credentials: Optional[Dict[str, str]] = None,
        **kwargs: Any,
    ) -> Dict[str, Any]:
        """Extract data — 품목 코드를 '+' 로 이어 kosis_series 한 번."""
        org_id, tbl_id = PRODUCT_TRADE_TABLE
        item_query = dict(
            org_id=org_id,
            tbl_id=tbl_id,
            itm_id=PRODUCT_TRADE_FLOWS[query.flow],
            obj_l1=join_codes(query.category, PRODUCT_TRADE_CATEGORIES, PRODUCT_TRADE_PREFIX),
            prd_se=query.prd_se,
            start_date=lookback_start(query.start_date),   # 증감률용 1년 앞부터
            end_date=query.end_date,
        )
        temp = await kosis_series(item_query, credentials)
        return {"data": [d.model_dump() for d in unwrap_result(temp)], "metadata": metadata_of_result(temp)}

    @staticmethod
    def transform_data(
        query: KOSISProductTradeQueryParams,
        data: Dict[str, Any],
        **kwargs: Any,
    ) -> AnnotatedResult[List[KOSISProductTradeData]]:
        """Transform data — 품목 코드 → category 키, 천달러 → USD, 증감률, 요청 기간만."""
        key_of = {PRODUCT_TRADE_PREFIX + code: key for key, code in PRODUCT_TRADE_CATEGORIES.items()}
        rows = []
        for d in data["data"]:
            key = key_of.get(d.get("category_id"))
            if key is None:
                continue
            v = d.get("value")
            rows.append({
                "date": d["date"],
                "value": v * PRODUCT_TRADE_UNIT_SCALE if v is not None else None,
                "category": key,
                "category_id": PRODUCT_TRADE_CATEGORIES[key],
                "category_name": d.get("category_name"),
                "item_id": d.get("item_id"),
                "item_name": d.get("item_name"),
                "unit": "USD",
            })
        records = trim_before(add_changes(rows, query.prd_se), query.start_date)
        return AnnotatedResult(
            result=[KOSISProductTradeData(flow=query.flow, **r) for r in records],
            metadata=data.get("metadata", {}),
        )

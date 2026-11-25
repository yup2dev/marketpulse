"""Initial Claims Models"""
import asyncio
import logging
from datetime import date as date_type
from typing import Optional, Any, Dict, List

from pydantic import Field

from data_fetcher.abstract_provider.abstract.base_fetchers import ApiFetcher
from data_fetcher.abstract_provider.standard_models.fred_series import (
    FredSeriesQueryParams,
    FredSeriesData,
)
from data_fetcher.providers.fred.models.generic_series import FREDGenericSeriesFetcher


class InitialClaimsQueryParams(FredSeriesQueryParams):
    start_date: Optional[date_type] = None
    end_date: Optional[date_type] = None


class InitialClaimsData(FredSeriesData):
    date: str = Field(description="날짜 (YYYY-MM-DD)")
    claims: float = Field(description="신규 실업급여 청구 (천 건)")
    ma_4w: Optional[float] = Field(default=None, description="4주 이동평균 (천 건)")


# ────────────────────────────────────────────────────────────────────────────
# Initial Claims Fetcher — ICSA + 4-week moving average.


log = logging.getLogger(__name__)


class FREDInitialClaimsFetcher(ApiFetcher[InitialClaimsQueryParams, InitialClaimsData]):
    """신규 실업급여 청구 주간 시계열 + 4주 이동평균."""

    api_name = "FRED"
    api_key_env = "FRED_API_KEY"

    @staticmethod
    def transform_query(params: Dict[str, Any]) -> InitialClaimsQueryParams:
        return InitialClaimsQueryParams(**params)

    @staticmethod
    async def aextract_data(
        query: InitialClaimsQueryParams,
        credentials: Optional[Dict[str, str]] = None,
        **kwargs: Any,
    ) -> List[Dict]:
        # ICSA(주간 신규 청구) + IC4WSA(4주 이동평균 — FRED 가 발표, 직접 계산하지 않는다)
        claims, ma = await asyncio.gather(*[
            FREDGenericSeriesFetcher.fetch_data(dict(
                series_id=sid, start_date=query.start_date, end_date=query.end_date, sort_order="asc",
            ), credentials)
            for sid in ("ICSA", "IC4WSA")
        ], return_exceptions=True)
        if isinstance(claims, BaseException):
            raise claims
        ma_by_date = {} if isinstance(ma, BaseException) else {r.date: r.value for r in ma}
        return [{**d.model_dump(), "ma": ma_by_date.get(d.date)} for d in claims]

    @staticmethod
    def transform_data(
        query: InitialClaimsQueryParams,
        data: List[Dict],
        **kwargs: Any,
    ) -> List[InitialClaimsData]:
        results = []
        for o in data:
            if o.get("value") in (None, ".", ""):
                continue
            point: Dict[str, Any] = {
                "date": o["date"],
                "claims": round(float(o["value"]) / 1000, 1),  # → thousands
            }
            if o.get("ma") is not None:
                point["ma_4w"] = round(float(o["ma"]) / 1000, 1)
            results.append(InitialClaimsData(**point))
        return results

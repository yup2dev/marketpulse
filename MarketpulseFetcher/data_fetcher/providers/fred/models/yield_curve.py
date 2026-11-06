"""Yield Curve Models"""
import logging
from datetime import date as dateType
from typing import Optional, Any, Dict, List

from pydantic import Field

from data_fetcher.abstract_provider.abstract.base_fetchers import ApiFetcher
from data_fetcher.abstract_provider.standard_models.yield_curve import (
    YieldCurveQueryParams,
    YieldCurveData,
)
from data_fetcher.providers.fred.utils.helpers import FredSeriesHelper as FredSeriesFetcher
from data_fetcher.utils.api_keys import get_api_key


# ────────────────────────────────────────────────────────────────────────────
# Yield Curve Snapshot Fetcher — 7개 만기별 최신 수익률.


log = logging.getLogger(__name__)

_MATURITIES = [
    {"key": "3m",  "series": "DGS3MO", "years": 0.25, "name": "3-Month"},
    {"key": "6m",  "series": "DGS6MO", "years": 0.5,  "name": "6-Month"},
    {"key": "1y",  "series": "DGS1",   "years": 1,    "name": "1-Year"},
    {"key": "2y",  "series": "DGS2",   "years": 2,    "name": "2-Year"},
    {"key": "5y",  "series": "DGS5",   "years": 5,    "name": "5-Year"},
    {"key": "10y", "series": "DGS10",  "years": 10,   "name": "10-Year"},
    {"key": "30y", "series": "DGS30",  "years": 30,   "name": "30-Year"},
]


class FREDYieldCurveQueryParams(YieldCurveQueryParams):
    """스냅샷 기준일 — OpenBB fixedincome.government.yield_curve 의 date 와 같은 뜻."""

    date: Optional[dateType] = Field(
        default=None,
        description="기준일 — 이 날짜 이전 마지막 관측값으로 곡선을 그린다 (비우면 최신)",
    )


class FREDYieldCurveFetcher(ApiFetcher[FREDYieldCurveQueryParams, YieldCurveData]):
    """미국채 수익률 곡선 스냅샷 — 7개 만기별 기준일(기본 최신) 수익률."""

    api_name = "FRED"
    api_key_env = "FRED_API_KEY"

    @staticmethod
    def transform_query(params: Dict[str, Any]) -> FREDYieldCurveQueryParams:
        return FREDYieldCurveQueryParams(**params)

    @staticmethod
    async def aextract_data(
        query: FREDYieldCurveQueryParams,
        credentials: Optional[Dict[str, str]] = None,
        **kwargs: Any,
    ) -> List[Dict]:
        api_key = get_api_key(credentials=credentials, api_name="FRED", env_var="FRED_API_KEY")
        rows = []
        for mat in _MATURITIES:
            try:
                obs = await FredSeriesFetcher.fetch_series(
                    series_id=mat["series"],
                    api_key=api_key,
                    limit=1,
                    sort_order="desc",
                    end_date=query.date,
                )
                if obs and obs[0].get("value") not in (None, ".", ""):
                    rows.append({
                        "maturity": mat["name"],
                        "years":    mat["years"],
                        "value":    obs[0]["value"],
                    })
            except Exception as e:
                log.warning(f"[YieldCurve] {mat['series']} fetch failed: {e}")
        return rows

    @staticmethod
    def transform_data(
        query: FREDYieldCurveQueryParams,
        data: List[Dict],
        **kwargs: Any,
    ) -> List[YieldCurveData]:
        results = []
        for row in data:
            try:
                results.append(YieldCurveData(
                    maturity=row["maturity"],
                    years=row["years"],
                    value=round(float(row["value"]), 3),
                ))
            except (TypeError, ValueError) as e:
                log.warning(f"[YieldCurve] transform failed for {row}: {e}")
        return results

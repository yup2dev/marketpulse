"""PMI Proxy Models (CFNAI 기반)"""
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


class PMIQueryParams(FredSeriesQueryParams):
    start_date: Optional[date_type] = None
    end_date: Optional[date_type] = None


class PMIData(FredSeriesData):
    date: str = Field(description="날짜 (YYYY-MM-DD)")
    cfnai: Optional[float] = Field(default=None, description="CFNAI 지수")
    cfnai_ma3: Optional[float] = Field(default=None, description="CFNAI 3개월 이동평균")
    diff: Optional[float] = Field(default=None, description="확산지수")
    sahm: Optional[float] = Field(default=None, description="Sahm Rule 지표")


# ────────────────────────────────────────────────────────────────────────────
# PMI Proxy Fetcher — CFNAI (+3개월 평균) + Diffusion Index + Sahm Rule (FRED 시리즈 4개를 날짜로 모은다).


log = logging.getLogger(__name__)

_SERIES_MAP = {
    "cfnai": "CFNAI",
    "cfnai_ma3": "CFNAIMA3",      # 3개월 이동평균 — FRED 가 발표하는 시리즈 (직접 계산하지 않는다)
    "diff":  "CFNAIDIFF",
    "sahm":  "SAHMCURRENT",
}


class FREDPMIFetcher(ApiFetcher[PMIQueryParams, PMIData]):
    """경기순환 지표 — CFNAI / 확산지수 / Sahm Rule 통합 시계열."""

    api_name = "FRED"
    api_key_env = "FRED_API_KEY"

    @staticmethod
    def transform_query(params: Dict[str, Any]) -> PMIQueryParams:
        return PMIQueryParams(**params)

    @staticmethod
    async def aextract_data(
        query: PMIQueryParams,
        credentials: Optional[Dict[str, str]] = None,
        **kwargs: Any,
    ) -> Dict[str, List[Dict]]:
        raw: Dict[str, List[Dict]] = {}
        for key, series_id in _SERIES_MAP.items():
            try:
                raw[key] = [d.model_dump() for d in await FREDGenericSeriesFetcher.fetch_data(dict(
                    series_id=series_id,
                    start_date=query.start_date,
                    end_date=query.end_date,
                    sort_order="asc",
                ), credentials)]
            except Exception as e:
                log.warning(f"[PMI] {series_id} fetch failed: {e}")
                raw[key] = []
        return raw

    @staticmethod
    def transform_data(
        query: PMIQueryParams,
        data: Dict[str, List[Dict]],
        **kwargs: Any,
    ) -> List[PMIData]:
        # 시리즈별 날짜 → 값
        vals = {
            key: {
                o["date"]: round(float(o["value"]), 4)
                for o in data.get(key, [])
                if o.get("value") not in (None, ".", "")
            }
            for key in _SERIES_MAP
        }
        all_dates = sorted(set().union(*vals.values()))
        results = []
        for date_str in all_dates:
            row: Dict[str, Any] = {"date": date_str}
            row.update({key: v[date_str] for key, v in vals.items() if date_str in v})
            if len(row) > 1:
                results.append(PMIData(**row))
        return results

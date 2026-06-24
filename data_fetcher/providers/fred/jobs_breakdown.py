"""Jobs Breakdown Models"""
from datetime import date as date_type
from typing import Optional
from pydantic import Field
from data_fetcher.abstract_provider.standard_models.fred_series import (
    FredSeriesQueryParams,
    FredSeriesData,
)


class JobsBreakdownQueryParams(FredSeriesQueryParams):
    start_date: Optional[date_type] = None
    end_date: Optional[date_type] = None


class JobsBreakdownData(FredSeriesData):
    date: str = Field(description="날짜 (YYYY-MM-DD)")
    private: Optional[float] = Field(default=None, description="민간 고용 변화 (천 건)")
    government: Optional[float] = Field(default=None, description="정부 고용 변화 (천 건)")
    private_level: Optional[float] = Field(default=None, description="민간 고용 수준")
    government_level: Optional[float] = Field(default=None, description="정부 고용 수준")


"""Jobs Breakdown Fetcher — 민간 vs 정부 고용 변화 (USPRIV + USGOVT)."""
import logging
from typing import Any, Dict, List, Optional

from data_fetcher.abstract_provider.abstract.fetcher import Fetcher
from data_fetcher.providers.fred.utils.helpers import FredSeriesHelper as FredSeriesFetcher
from data_fetcher.utils.api_keys import get_api_key

log = logging.getLogger(__name__)


class FREDJobsBreakdownFetcher(Fetcher[JobsBreakdownQueryParams, JobsBreakdownData]):
    """민간·정부 고용 변화 시계열 — 기간 시작 대비 누적 변화."""

    @staticmethod
    def transform_query(params: Dict[str, Any]) -> JobsBreakdownQueryParams:
        return JobsBreakdownQueryParams(**params)

    @staticmethod
    async def aextract_data(
        query: JobsBreakdownQueryParams,
        credentials: Optional[Dict[str, str]] = None,
        **kwargs: Any,
    ) -> Dict[str, List[Dict]]:
        api_key = get_api_key(credentials=credentials, api_name="FRED", env_var="FRED_API_KEY")
        result: Dict[str, List[Dict]] = {}
        for key, series_id in [("private", "USPRIV"), ("government", "USGOVT")]:
            try:
                result[key] = await FredSeriesFetcher.fetch_series(
                    series_id=series_id,
                    api_key=api_key,
                    start_date=query.start_date,
                    end_date=query.end_date,
                    sort_order="asc",
                )
            except Exception as e:
                log.warning(f"[JobsBreakdown] {series_id} failed: {e}")
                result[key] = []
        return result

    @staticmethod
    def transform_data(
        query: JobsBreakdownQueryParams,
        data: Dict[str, List[Dict]],
        **kwargs: Any,
    ) -> List[JobsBreakdownData]:
        private_dict = {
            o["date"]: float(o["value"])
            for o in data.get("private", [])
            if o.get("value") not in (None, ".", "")
        }
        govt_dict = {
            o["date"]: float(o["value"])
            for o in data.get("government", [])
            if o.get("value") not in (None, ".", "")
        }

        all_dates = sorted(set(private_dict) & set(govt_dict))
        if not all_dates:
            return []

        baseline_p = private_dict[all_dates[0]]
        baseline_g = govt_dict[all_dates[0]]

        return [
            JobsBreakdownData(
                date=date,
                private=round(private_dict[date] - baseline_p, 0),
                government=round(govt_dict[date] - baseline_g, 0),
                private_level=round(private_dict[date], 0),
                government_level=round(govt_dict[date], 0),
            )
            for date in all_dates
        ]

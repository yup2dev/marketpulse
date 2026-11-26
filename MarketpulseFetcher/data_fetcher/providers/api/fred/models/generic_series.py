"""FRED Series Model — 임의의 FRED series_id 시계열 (series/observations).

FRED HTTP 는 utils/series.py 한 곳이다 — 이 fetcher 와 지표 모델(CPI · GDP · 수익률곡선 …)이 모두 그걸 쓴다
(지표 모델은 다른 fetcher 를 부르지 않고 fred_series 를 부른다).
series_id 를 쉼표로 여러 개 주면 동시에 요청한다 — 행마다 series_id 가 붙는다.
"""
# pylint: disable=unused-argument
import logging
from datetime import date as date_type
from typing import Any, Dict, List, Optional

from pydantic import Field

from data_fetcher.abstract_provider.abstract.base_fetchers import ApiFetcher
from data_fetcher.abstract_provider.standard_models.fred_series import (
    FredSeriesData,
    FredSeriesQueryParams,
)
from data_fetcher.providers.api.fred.utils.series import fetch_observations, to_series_rows

log = logging.getLogger(__name__)


class FREDGenericSeriesQueryParams(FredSeriesQueryParams):
    """FRED Series Query (standard FredSeries 경유)."""

    __json_schema_extra__ = {
        "series_id": {"multiple_items_allowed": True},
    }

    series_id: str = Field(description="FRED 시리즈 ID — 쉼표로 여러 개 (예: 'GDP', 'DGS2,DGS10')")
    start_date: Optional[date_type] = Field(default=None, description="시작일")
    end_date: Optional[date_type] = Field(default=None, description="종료일")
    frequency: Optional[str] = Field(default=None, description="빈도 (d/w/m/q/sa/a)")
    aggregation_method: Optional[str] = Field(default=None, description="집계 방법 (avg/sum/eop)")
    units: Optional[str] = Field(default=None, description="단위 변환 (lin/chg/pch 등)")
    limit: int = Field(default=10000, description="시리즈마다 최대 관찰값 수")
    sort_order: str = Field(default="asc", description="정렬 순서 (asc/desc)")


class FREDGenericSeriesData(FredSeriesData):
    """FRED Series Data — 관찰값 하나 (standard FredSeries 경유)."""

    date: str = Field(description="날짜 (YYYY-MM-DD)")
    value: float = Field(description="관찰값")


class FREDGenericSeriesFetcher(ApiFetcher[FREDGenericSeriesQueryParams, FREDGenericSeriesData]):
    """Transform the query, extract and transform the data from the FRED endpoint."""

    api_name = "FRED"
    api_key_env = "FRED_API_KEY"

    require_credentials = True

    @staticmethod
    def transform_query(params: Dict[str, Any]) -> FREDGenericSeriesQueryParams:
        """Transform query."""
        return FREDGenericSeriesQueryParams(**params)

    @staticmethod
    async def aextract_data(
        query: FREDGenericSeriesQueryParams,
        credentials: Optional[Dict[str, str]] = None,
        **kwargs: Any,
    ) -> List[Dict[str, Any]]:
        """Extract data — 시리즈마다 요청 하나, 여러 개면 동시에 (utils/series.fetch_observations)."""
        return await fetch_observations(query, credentials)

    @staticmethod
    def transform_data(
        query: FREDGenericSeriesQueryParams,
        data: List[Dict[str, Any]],
        **kwargs: Any,
    ) -> List[FREDGenericSeriesData]:
        """Transform data — 미발표('.') · 빈 값은 뺀다 (utils/series.to_series_rows)."""
        return to_series_rows(data)

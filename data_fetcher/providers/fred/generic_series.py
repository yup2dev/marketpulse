"""FRED Generic Series — QueryParams + Data + Fetcher"""
import asyncio
import logging
from datetime import date as date_type
from typing import Any, Dict, List, Optional

from pydantic import Field

from data_fetcher.abstract_provider.abstract import BaseQueryParams, BaseData
from data_fetcher.abstract_provider.abstract.fetcher import Fetcher
from data_fetcher.providers.fred.utils.helpers import FredSeriesHelper as FredSeriesFetcher
from data_fetcher.utils.api_keys import get_api_key


# ── QueryParams ───────────────────────────────────────────────────────────────

class FREDGenericSeriesQueryParams(BaseQueryParams):
    """임의의 FRED series_id 조회 파라미터."""
    series_id: str = Field(description="FRED 시리즈 ID (예: 'GDP', 'CPIAUCSL')")
    start_date: Optional[date_type] = Field(default=None, description="시작일")
    end_date: Optional[date_type] = Field(default=None, description="종료일")
    frequency: Optional[str] = Field(default=None, description="빈도 (d/w/m/q/sa/a)")
    aggregation_method: Optional[str] = Field(default=None, description="집계 방법 (avg/sum/eop)")
    units: Optional[str] = Field(default=None, description="단위 변환 (lin/chg/pch 등)")
    limit: int = Field(default=10000, description="최대 관찰값 수")
    sort_order: str = Field(default="asc", description="정렬 순서 (asc/desc)")


class FREDGenericSeriesData(BaseData):
    """FRED 시계열 단일 관찰값."""
    date: str = Field(description="날짜 (YYYY-MM-DD)")
    value: float = Field(description="관찰값")

log = logging.getLogger(__name__)


class FREDGenericSeriesFetcher(Fetcher[FREDGenericSeriesQueryParams, FREDGenericSeriesData]):
    """임의의 FRED series_id를 QueryExecutor 파이프라인으로 조회."""

    require_credentials = True

    @staticmethod
    def transform_query(params: Dict[str, Any]) -> FREDGenericSeriesQueryParams:
        return FREDGenericSeriesQueryParams(**params)

    @staticmethod
    async def aextract_data(
        query: FREDGenericSeriesQueryParams,
        credentials: Optional[Dict[str, str]] = None,
        **kwargs: Any,
    ) -> List[Dict[str, Any]]:
        api_key = get_api_key(credentials=credentials, api_name="FRED", env_var="FRED_API_KEY")
        return await FredSeriesFetcher.fetch_series(
            series_id=query.series_id,
            api_key=api_key,
            start_date=query.start_date,
            end_date=query.end_date,
            frequency=query.frequency,
            aggregation_method=query.aggregation_method,
            units=query.units,
            limit=query.limit,
            sort_order=query.sort_order,
        )

    @staticmethod
    def transform_data(
        query: FREDGenericSeriesQueryParams,
        data: List[Dict[str, Any]],
        **kwargs: Any,
    ) -> List[FREDGenericSeriesData]:
        result = []
        for obs in (data or []):
            date_str = obs.get('date')
            value_str = obs.get('value')
            if not date_str or value_str in (None, '.', ''):
                continue
            try:
                result.append(FREDGenericSeriesData(date=date_str, value=float(value_str)))
            except (TypeError, ValueError):
                continue
        return result

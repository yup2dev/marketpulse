"""Inflation Sector Models"""
from datetime import date as date_type
from typing import Optional
from pydantic import Field
from data_fetcher.abstract_provider.abstract import BaseQueryParams, BaseData


class InflationSectorQueryParams(BaseQueryParams):
    start_date: Optional[date_type] = None
    end_date: Optional[date_type] = None


class InflationSectorData(BaseData):
    date: str = Field(description="날짜 (YYYY-MM-DD)")
    headline: Optional[float] = Field(default=None)
    core: Optional[float] = Field(default=None)
    food: Optional[float] = Field(default=None)
    energy: Optional[float] = Field(default=None)
    shelter: Optional[float] = Field(default=None)
    medical: Optional[float] = Field(default=None)
    apparel: Optional[float] = Field(default=None)
    vehicles: Optional[float] = Field(default=None)


"""Inflation Sector History Fetcher — 8개 CPI 섹터별 YoY 변화율 시계열."""
import logging
from datetime import date as date_type
from typing import Any, Dict, List, Optional

from data_fetcher.abstract_provider.abstract.fetcher import Fetcher
from data_fetcher.providers.fred.utils.helpers import FredSeriesHelper as FredSeriesFetcher
from data_fetcher.utils.api_keys import get_api_key

log = logging.getLogger(__name__)

# CPI sector FRED series (mirrors app/backend/constants/fred_series.py CPI_SECTOR_SERIES)
_SECTOR_SERIES: Dict[str, str] = {
    "headline": "CPIAUCSL",
    "core":     "CPILFESL",
    "food":     "CPIUFDSL",
    "energy":   "CPIENGSL",
    "shelter":  "CUSR0000SAH1",
    "medical":  "CPIMEDSL",
    "apparel":  "CPIAPPSL",
    "vehicles": "CUSR0000SETA01",
}


class FREDInflationSectorFetcher(Fetcher[InflationSectorQueryParams, InflationSectorData]):
    """섹터별 CPI YoY 변화율 시계열."""

    @staticmethod
    def transform_query(params: Dict[str, Any]) -> InflationSectorQueryParams:
        return InflationSectorQueryParams(**params)

    @staticmethod
    async def aextract_data(
        query: InflationSectorQueryParams,
        credentials: Optional[Dict[str, str]] = None,
        **kwargs: Any,
    ) -> Dict[str, List[Dict]]:
        api_key = get_api_key(credentials=credentials, api_name="FRED", env_var="FRED_API_KEY")
        # 13개월 확장 시작 — YoY 계산에 필요
        extended_start: Optional[date_type] = None
        if query.start_date:
            from dateutil.relativedelta import relativedelta
            extended_start = query.start_date - relativedelta(months=13)

        series_map = await FredSeriesFetcher.fetch_multiple_series(
            series_ids=list(_SECTOR_SERIES.values()),
            api_key=api_key,
            start_date=extended_start,
            end_date=query.end_date,
            sort_order="asc",
        )
        # remap from series_id keys back to sector name keys
        raw: Dict[str, List[Dict]] = {
            key: series_map.get(series_id, [])
            for key, series_id in _SECTOR_SERIES.items()
        }
        return raw

    @staticmethod
    def transform_data(
        query: InflationSectorQueryParams,
        data: Dict[str, List[Dict]],
        **kwargs: Any,
    ) -> List[InflationSectorData]:
        # Compute YoY for each sector
        sector_yoy: Dict[str, Dict[str, float]] = {}
        for key, obs_list in data.items():
            clean = [
                {"date": o["date"], "value": float(o["value"])}
                for o in obs_list
                if o.get("value") not in (None, ".", "")
            ]
            yoy_map: Dict[str, float] = {}
            for i in range(12, len(clean)):
                prev = clean[i - 12]["value"]
                if prev:
                    yoy_map[clean[i]["date"]] = round((clean[i]["value"] - prev) / prev * 100, 2)
            sector_yoy[key] = yoy_map

        # Anchor on headline, filter to requested start_date
        anchor_dates = sorted(sector_yoy.get("headline", {}).keys())
        if query.start_date:
            cutoff = query.start_date.isoformat()
            anchor_dates = [d for d in anchor_dates if d >= cutoff]

        results = []
        for date_str in anchor_dates:
            fields: Dict[str, Any] = {"date": date_str}
            for key in _SECTOR_SERIES:
                val = sector_yoy.get(key, {}).get(date_str)
                if val is not None:
                    fields[key] = val
            if len(fields) > 1:
                results.append(InflationSectorData(**fields))
        return results

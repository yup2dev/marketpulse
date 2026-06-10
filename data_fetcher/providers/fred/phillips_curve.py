"""Phillips Curve Models"""
from datetime import date as date_type
from typing import Optional
from pydantic import Field
from data_fetcher.abstract_provider.abstract import BaseQueryParams, BaseData


class PhillipsCurveQueryParams(BaseQueryParams):
    start_date: Optional[date_type] = None
    end_date: Optional[date_type] = None


class PhillipsCurveData(BaseData):
    date: str = Field(description="날짜 (YYYY-MM-DD)")
    unemployment: float = Field(description="실업률 (%)")
    inflation: float = Field(description="CPI YoY (%)")


"""Phillips Curve Fetcher — Unemployment vs CPI YoY (UNRATE + CPIAUCSL)."""
import logging
from datetime import date as date_type
from typing import Any, Dict, List, Optional

from data_fetcher.abstract_provider.abstract.fetcher import Fetcher
from data_fetcher.providers.fred.utils.helpers import FredSeriesHelper as FredSeriesFetcher
from data_fetcher.utils.api_keys import get_api_key

log = logging.getLogger(__name__)


class FREDPhillipsCurveFetcher(Fetcher[PhillipsCurveQueryParams, PhillipsCurveData]):
    """필립스 곡선 — 실업률 vs CPI YoY 시계열."""

    @staticmethod
    def transform_query(params: Dict[str, Any]) -> PhillipsCurveQueryParams:
        return PhillipsCurveQueryParams(**params)

    @staticmethod
    async def aextract_data(
        query: PhillipsCurveQueryParams,
        credentials: Optional[Dict[str, str]] = None,
        **kwargs: Any,
    ) -> Dict[str, List[Dict]]:
        api_key = get_api_key(credentials=credentials, api_name="FRED", env_var="FRED_API_KEY")
        raw: Dict[str, List[Dict]] = {}
        for key, series_id in [("unemployment", "UNRATE"), ("cpi", "CPIAUCSL")]:
            try:
                raw[key] = await FredSeriesFetcher.fetch_series(
                    series_id=series_id,
                    api_key=api_key,
                    sort_order="asc",
                )
            except Exception as e:
                log.warning(f"[PhillipsCurve] {series_id} failed: {e}")
                raw[key] = []
        return raw

    @staticmethod
    def transform_data(
        query: PhillipsCurveQueryParams,
        data: Dict[str, List[Dict]],
        **kwargs: Any,
    ) -> List[PhillipsCurveData]:
        s_str = str(query.start_date) if query.start_date else "0000-00-00"
        e_str = str(query.end_date)   if query.end_date   else "9999-99-99"

        u_points = [
            {"date": o["date"], "value": float(o["value"])}
            for o in data.get("unemployment", [])
            if o.get("value") not in (None, ".", "") and s_str <= o["date"] <= e_str
        ]
        cpi_all = [
            {"date": o["date"], "value": float(o["value"])}
            for o in data.get("cpi", [])
            if o.get("value") not in (None, ".", "")
        ]
        cpi_filtered = [c for c in cpi_all if s_str <= c["date"] <= e_str]
        cpi_desc = sorted(cpi_all, key=lambda x: x["date"], reverse=True)

        results: List[PhillipsCurveData] = []
        for u_pt in u_points:
            u_date = date_type.fromisoformat(u_pt["date"][:10])
            if not cpi_filtered:
                continue
            closest = min(cpi_filtered, key=lambda c: abs(
                (date_type.fromisoformat(c["date"][:10]) - u_date).days
            ))
            try:
                idx = next(i for i, c in enumerate(cpi_desc) if c["date"] == closest["date"])
                if idx + 12 < len(cpi_desc):
                    year_ago = cpi_desc[idx + 12]["value"]
                    if year_ago:
                        cpi_yoy = (closest["value"] - year_ago) / year_ago * 100
                        results.append(PhillipsCurveData(
                            date=u_pt["date"],
                            unemployment=round(u_pt["value"], 1),
                            inflation=round(cpi_yoy, 1),
                        ))
            except (StopIteration, ZeroDivisionError):
                continue
        return results

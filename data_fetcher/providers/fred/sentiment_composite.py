"""FRED Sentiment Composite — QueryParams + Data + Fetcher"""
import logging
from typing import Any, Dict, List, Optional

from pydantic import Field

from data_fetcher.abstract_provider.abstract import BaseQueryParams, BaseData
from data_fetcher.abstract_provider.abstract.fetcher import Fetcher
from data_fetcher.providers.fred.utils.helpers import FredSeriesHelper as FredSeriesFetcher
from data_fetcher.utils.api_keys import get_api_key


# ── QueryParams / Data (shared Dashboard pattern) ─────────────────────────────

class DashboardQueryParams(BaseQueryParams):
    pass


class DashboardRowData(BaseData):
    section: str = Field(description="대시보드 섹션")
    metric: str = Field(description="지표명")
    value: Optional[float] = Field(default=None, description="현재값")
    unit: Optional[str] = Field(default="", description="단위")
    status: Optional[str] = Field(default=None, description="상태 레이블")

log = logging.getLogger(__name__)


def _vix_score(v: float) -> float:
    if v < 15:   return 100 - ((v - 10) / 5) * 30
    if v < 20:   return 70  - ((v - 15) / 5) * 40
    if v < 30:   return 30  - ((v - 20) / 10) * 20
    return max(0.0, 10 - ((v - 30) / 10) * 10)


def _hy_score(v: float) -> float:
    if v < 300:  return 100 - ((300 - v) / 100) * 20
    if v < 500:  return 80  - ((v - 300) / 200) * 50
    return max(0.0, 30 - ((v - 500) / 500) * 30)


class FREDSentimentCompositeFetcher(Fetcher[DashboardQueryParams, DashboardRowData]):
    """시장 심리 스냅샷 — VIX, HY스프레드, 안전자산 수요 기반 공포-탐욕 지수."""

    @staticmethod
    def transform_query(params: Dict[str, Any]) -> DashboardQueryParams:
        return DashboardQueryParams(**params)

    @staticmethod
    async def aextract_data(
        query: DashboardQueryParams,
        credentials: Optional[Dict[str, str]] = None,
        **kwargs: Any,
    ) -> Dict[str, List[Dict]]:
        api_key = get_api_key(credentials=credentials, api_name="FRED", env_var="FRED_API_KEY")
        raw: Dict[str, List[Dict]] = {}
        for key, series_id, limit in [
            ("vix",    "VIXCLS",       1),
            ("hy",     "BAMLH0A0HYM2", 1),
            ("dgs10",  "DGS10",        20),  # recent 20 obs for safe-haven calc
        ]:
            try:
                raw[key] = await FredSeriesFetcher.fetch_series(
                    series_id=series_id, api_key=api_key,
                    limit=limit, sort_order="desc",
                )
            except Exception as e:
                log.warning(f"[SentimentComposite] {series_id} failed: {e}")
                raw[key] = []
        return raw

    @staticmethod
    def transform_data(
        query: DashboardQueryParams,
        data: Dict[str, List[Dict]],
        **kwargs: Any,
    ) -> List[DashboardRowData]:
        rows: List[DashboardRowData] = []
        scores: List[float] = []

        # ── VIX ──────────────────────────────────────────────────────────────
        vix_val: Optional[float] = None
        vix_obs = data.get("vix", [])
        if vix_obs and vix_obs[0].get("value") not in (None, ".", ""):
            try:
                vix_val = float(vix_obs[0]["value"])
                vs = round(_vix_score(vix_val), 1)
                vix_pct = min(100.0, max(0.0, ((vix_val - 10) / 70) * 100))
                vix_status = (
                    "low"      if vix_val < 15 else
                    "normal"   if vix_val < 20 else
                    "elevated" if vix_val < 30 else "high"
                )
                rows.append(DashboardRowData(
                    section="Components", metric="VIX",
                    value=round(vix_val, 2), unit="",
                    score=vs, percentile=round(vix_pct, 1), status=vix_status,
                ))
                scores.append(vs)
            except (TypeError, ValueError):
                pass

        # ── HY Spread ────────────────────────────────────────────────────────
        hy_obs = data.get("hy", [])
        if hy_obs and hy_obs[0].get("value") not in (None, ".", ""):
            try:
                hy_val = float(hy_obs[0]["value"])
                hs = round(_hy_score(hy_val), 1)
                rows.append(DashboardRowData(
                    section="Components", metric="High Yield Spread",
                    value=round(hy_val, 0), unit="bps", score=hs,
                ))
                scores.append(hs)
            except (TypeError, ValueError):
                pass

        # ── Safe Haven (10Y yield momentum) ───────────────────────────────────
        dgs10_obs = [
            o for o in data.get("dgs10", [])
            if o.get("value") not in (None, ".", "")
        ]
        if len(dgs10_obs) >= 2:
            try:
                curr_yield = float(dgs10_obs[0]["value"])
                valid_vals = [float(o["value"]) for o in dgs10_obs if o["value"] not in (None, ".")]
                avg_yield = sum(valid_vals) / len(valid_vals) if valid_vals else curr_yield
                safe_score = round(max(0.0, min(100.0, 50 - (curr_yield - avg_yield) * 10)), 1)
                rows.append(DashboardRowData(
                    section="Components", metric="Safe Haven Demand",
                    value=round(curr_yield, 2), unit="%", score=safe_score,
                ))
                scores.append(safe_score)
            except (TypeError, ValueError):
                pass

        # ── Fear/Greed Composite ─────────────────────────────────────────────
        if scores:
            fg = round(sum(scores) / len(scores), 1)
            status = (
                "extreme_fear" if fg < 20 else
                "fear"         if fg < 40 else
                "neutral"      if fg < 60 else
                "greed"        if fg < 80 else "extreme_greed"
            )
            rows.insert(0, DashboardRowData(
                section="Fear & Greed", metric="Index",
                value=fg, unit="/100", status=status,
            ))

        return rows

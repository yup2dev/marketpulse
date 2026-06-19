"""FRED Labor Dashboard — QueryParams + Data + Fetcher"""
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

_SERIES = [
    ("u3",       "UNRATE",         1,  "desc"),
    ("u6",       "U6RATE",         1,  "desc"),
    ("lfpr",     "CIVPART",        1,  "desc"),
    ("payroll",  "PAYEMS",         2,  "desc"),
    ("jolts",    "JTSJOL",         1,  "desc"),
    ("quits",    "JTSQUR",         1,  "desc"),
    ("claims",   "ICSA",           1,  "desc"),
    ("cont",     "CCSA",           1,  "desc"),
    ("earnings", "CES0500000003",  13, "desc"),  # 13 obs for YoY
    ("ulc",      "ULCNFB",         1,  "desc"),
    ("prod",     "OPHNFB",         1,  "desc"),
]


def _latest_float(obs: List[Dict]) -> Optional[float]:
    if obs and obs[0].get("value") not in (None, ".", ""):
        try:
            return float(obs[0]["value"])
        except (TypeError, ValueError):
            pass
    return None


class FREDLaborDashboardFetcher(Fetcher[DashboardQueryParams, DashboardRowData]):
    """노동시장 스냅샷 — 실업률, 고용, 임금 현재값."""

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
        for key, series_id, limit, sort in _SERIES:
            try:
                raw[key] = await FredSeriesFetcher.fetch_series(
                    series_id=series_id, api_key=api_key,
                    limit=limit, sort_order=sort,
                )
            except Exception as e:
                log.warning(f"[LaborDashboard] {series_id} failed: {e}")
                raw[key] = []
        return raw

    @staticmethod
    def transform_data(
        query: DashboardQueryParams,
        data: Dict[str, List[Dict]],
        **kwargs: Any,
    ) -> List[DashboardRowData]:
        rows: List[DashboardRowData] = []
        heat_scores: List[float] = []

        # ── Unemployment ─────────────────────────────────────────────────────
        u3 = _latest_float(data.get("u3", []))
        u6 = _latest_float(data.get("u6", []))
        lfpr = _latest_float(data.get("lfpr", []))

        if u3 is not None:
            u3_trend_obs = data.get("u3", [])
            trend = "stable"
            if len(u3_trend_obs) >= 2:
                try:
                    prev = float(u3_trend_obs[1]["value"])
                    trend = "improving" if u3 < prev - 0.1 else "deteriorating" if u3 > prev + 0.1 else "stable"
                except (TypeError, ValueError):
                    pass
            rows.append(DashboardRowData(section="Unemployment", metric="U3 Rate",          value=round(u3, 1),   unit="%", status=trend))
            heat_scores.append(max(0.0, min(100.0, 100 - u3 * 20)))
        if u6   is not None: rows.append(DashboardRowData(section="Unemployment", metric="U6 Rate",          value=round(u6, 1),   unit="%"))
        if lfpr is not None: rows.append(DashboardRowData(section="Unemployment", metric="Participation Rate",value=round(lfpr, 1), unit="%"))

        # ── Job Market ───────────────────────────────────────────────────────
        payroll_obs = data.get("payroll", [])
        if len(payroll_obs) >= 2:
            try:
                curr_p = float(payroll_obs[0]["value"])
                prev_p = float(payroll_obs[1]["value"])
                rows.append(DashboardRowData(section="Job Market", metric="Nonfarm Payrolls",  value=int(curr_p),        unit="K"))
                rows.append(DashboardRowData(section="Job Market", metric="Payroll Change MoM",value=int(curr_p - prev_p),unit="K"))
            except (TypeError, ValueError):
                pass

        jolts = _latest_float(data.get("jolts", []))
        quits = _latest_float(data.get("quits", []))
        claims = _latest_float(data.get("claims", []))
        cont   = _latest_float(data.get("cont",   []))

        if jolts  is not None: rows.append(DashboardRowData(section="Job Market", metric="JOLTS Openings",    value=int(jolts),        unit="K"))
        if quits  is not None:
            rows.append(DashboardRowData(section="Job Market", metric="Quits Rate",          value=round(quits, 1),   unit="%"))
            heat_scores.append(min(100.0, quits * 40))
        if claims is not None:
            rows.append(DashboardRowData(section="Job Market", metric="Initial Claims",       value=int(claims),       unit=""))
            heat_scores.append(max(0.0, min(100.0, 100 - ((claims - 200_000) / 2000))))
        if cont   is not None: rows.append(DashboardRowData(section="Job Market", metric="Continuing Claims",  value=int(cont),         unit=""))

        # ── Wages ────────────────────────────────────────────────────────────
        earnings_obs = data.get("earnings", [])
        if len(earnings_obs) >= 13:
            try:
                curr_e = float(earnings_obs[0]["value"])
                yr_e   = float(earnings_obs[12]["value"])
                rows.append(DashboardRowData(section="Wages", metric="Hourly Earnings",   value=round(curr_e, 2),                              unit="$/hr"))
                if yr_e:
                    rows.append(DashboardRowData(section="Wages", metric="Earnings YoY",  value=round((curr_e - yr_e) / yr_e * 100, 2),         unit="%"))
            except (TypeError, ValueError, ZeroDivisionError):
                pass

        ulc  = _latest_float(data.get("ulc",  []))
        prod = _latest_float(data.get("prod", []))
        if ulc  is not None: rows.append(DashboardRowData(section="Wages", metric="Unit Labor Cost", value=round(ulc,  1), unit=""))
        if prod is not None: rows.append(DashboardRowData(section="Wages", metric="Productivity",     value=round(prod, 1), unit=""))

        # ── Heat Index ───────────────────────────────────────────────────────
        if heat_scores:
            heat = round(sum(heat_scores) / len(heat_scores), 1)
            rows.append(DashboardRowData(section="Heat Index", metric="Labor Market Heat", value=heat, unit="/100"))

        return [r for r in rows if r.value is not None]

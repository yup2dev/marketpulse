"""FRED Financial Conditions Snapshot — QueryParams + Data + Fetcher

Uses DashboardQueryParams/DashboardRowData (shared with labor_dashboard, sentiment_composite).
"""
import logging
from typing import Any, Dict, List, Optional

from pydantic import Field

from data_fetcher.abstract_provider.standard_models.indicator_dashboard import (
    IndicatorDashboardQueryParams,
    IndicatorDashboardData,
)
from data_fetcher.abstract_provider.abstract.base_fetchers import ApiFetcher
from data_fetcher.providers.fred.utils.helpers import FredSeriesHelper as FredSeriesFetcher
from data_fetcher.utils.api_keys import get_api_key

log = logging.getLogger(__name__)


# ── QueryParams / Data (standard IndicatorDashboard 경유) ──────────────────────

class DashboardQueryParams(IndicatorDashboardQueryParams):
    pass


class DashboardRowData(IndicatorDashboardData):
    percentile: Optional[float] = Field(default=None, description="백분위")


# ── Helpers ───────────────────────────────────────────────────────────────────

# (key, series_id, limit, sort_order)
_SERIES: List[tuple] = [
    ("nfci",        "NFCI",           1,  "desc"),
    ("bbb",         "BAMLC0A4CBBB",   1,  "desc"),
    ("aaa",         "BAMLC0A1CAAA",   1,  "desc"),
    ("hy",          "BAMLH0A0HYM2",   1,  "desc"),
    ("credit_total","TOTALSL",        13, "desc"),
    ("cc_delinq",   "DRCCLACBS",      1,  "desc"),
    ("loan_delinq", "DRCLACBS",       1,  "desc"),
    ("mtg_delinq",  "DRSFRMACBS",     1,  "desc"),
]


def _latest(obs: List[Dict]) -> Optional[float]:
    if obs and obs[0].get("value") not in (None, ".", ""):
        try:
            return float(obs[0]["value"])
        except (TypeError, ValueError):
            pass
    return None


# ── Fetcher ───────────────────────────────────────────────────────────────────

class FREDFinancialConditionsFetcher(ApiFetcher[DashboardQueryParams, DashboardRowData]):
    """금융 여건 스냅샷 — NFCI, 크레딧 스프레드, 소비자 건전성."""

    api_name = "FRED"
    api_key_env = "FRED_API_KEY"

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
                log.warning(f"[FinancialConditions] {series_id} failed: {e}")
                raw[key] = []
        return raw

    @staticmethod
    def transform_data(
        query: DashboardQueryParams,
        data: Dict[str, List[Dict]],
        **kwargs: Any,
    ) -> List[DashboardRowData]:
        rows: List[DashboardRowData] = []

        nfci = _latest(data.get("nfci", []))
        if nfci is not None:
            status = (
                "very_tight" if nfci > 0.5 else
                "tight"      if nfci > 0   else
                "neutral"    if nfci > -0.5 else "loose"
            )
            rows.append(DashboardRowData(
                section="FCI", metric="Chicago Fed NFCI",
                value=round(nfci, 2), unit="", status=status,
            ))

        hy  = _latest(data.get("hy", []))
        bbb = _latest(data.get("bbb", []))
        aaa = _latest(data.get("aaa", []))

        if aaa is not None:
            rows.append(DashboardRowData(
                section="Credit Spreads", metric="Investment Grade (AAA)",
                value=round(aaa * 100, 0), unit="bps",
            ))
        if hy is not None:
            hy_pct = min(100.0, max(0.0, ((hy - 200) / 800) * 100))
            rows.append(DashboardRowData(
                section="Credit Spreads", metric="High Yield OAS",
                value=round(hy, 0), unit="bps", percentile=round(hy_pct, 1),
            ))
        if bbb is not None:
            rows.append(DashboardRowData(
                section="Credit Spreads", metric="BBB Treasury",
                value=round(bbb * 100, 0), unit="bps",
            ))

        credit_obs = data.get("credit_total", [])
        if len(credit_obs) >= 13:
            try:
                curr = float(credit_obs[0]["value"])
                year_ago = float(credit_obs[12]["value"])
                if year_ago:
                    credit_growth = round((curr - year_ago) / year_ago * 100, 2)
                    rows.append(DashboardRowData(
                        section="Consumer Health", metric="Credit Growth YoY",
                        value=credit_growth, unit="%",
                    ))
            except (TypeError, ValueError, ZeroDivisionError):
                pass

        for key, label in [
            ("cc_delinq", "CC Delinquency"),
            ("loan_delinq", "Consumer Loan Delinquency"),
            ("mtg_delinq", "Mortgage Delinquency"),
        ]:
            v = _latest(data.get(key, []))
            if v is not None:
                rows.append(DashboardRowData(
                    section="Consumer Health", metric=label, value=round(v, 2), unit="%",
                ))

        return rows

"""Economic Regime History Fetcher — GDP + CPI → 4-regime classification."""
import logging
from datetime import date as date_type
from typing import Any, Dict, List, Optional

from data_fetcher.fetchers.base import AnnotatedResult, Fetcher
from data_fetcher.fetchers.fred.series import FredSeriesFetcher
from data_fetcher.models.fred.regime_history import RegimeHistoryData, RegimeHistoryQueryParams
from data_fetcher.utils.api_keys import get_api_key

log = logging.getLogger(__name__)

# Real GDP % Change (Quarterly, SAAR)
_GDP_SERIES  = "A191RL1Q225SBEA"
# CPI All Urban Consumers (Monthly)
_CPI_SERIES  = "CPIAUCSL"


def _classify(growth_score: float, inflation_score: float, cpi_yoy: float) -> str:
    if growth_score >= 0 and cpi_yoy <= 2.5:  return "goldilocks"
    if growth_score >= 0 and cpi_yoy >  2.5:  return "reflation"
    if growth_score <  0 and cpi_yoy >  2.5:  return "stagflation"
    return "deflation"


class FREDRegimeHistoryFetcher(Fetcher[RegimeHistoryQueryParams, RegimeHistoryData]):
    """경제 레짐 시계열 — 실질GDP 성장 + CPI 기반 4분면 분류."""

    @staticmethod
    def transform_query(params: Dict[str, Any]) -> RegimeHistoryQueryParams:
        return RegimeHistoryQueryParams(**params)

    @staticmethod
    def extract_data(
        query: RegimeHistoryQueryParams,
        credentials: Optional[Dict[str, str]] = None,
        **kwargs: Any,
    ) -> Dict[str, List[Dict]]:
        api_key = get_api_key(credentials=credentials, api_name="FRED", env_var="FRED_API_KEY")
        raw: Dict[str, List[Dict]] = {}
        for key, series_id in [("gdp", _GDP_SERIES), ("cpi", _CPI_SERIES)]:
            try:
                raw[key] = FredSeriesFetcher.fetch_series(
                    series_id=series_id,
                    api_key=api_key,
                    # Fetch all history — filtering done in transform_data
                    sort_order="asc",
                )
            except Exception as e:
                log.warning(f"[RegimeHistory] {series_id} failed: {e}")
                raw[key] = []
        return raw

    @staticmethod
    def transform_data(
        query: RegimeHistoryQueryParams,
        data: Dict[str, List[Dict]],
        **kwargs: Any,
    ) -> "AnnotatedResult[List[RegimeHistoryData]]":
        s_str = str(query.start_date) if query.start_date else "0000-00-00"
        e_str = str(query.end_date)   if query.end_date   else "9999-99-99"

        # Parse GDP (quarterly % change)
        gdp_points = [
            {"date": o["date"], "value": float(o["value"])}
            for o in data.get("gdp", [])
            if o.get("value") not in (None, ".", "")
        ]
        # Parse CPI (all months — needed for YoY lookback)
        cpi_all = [
            {"date": o["date"], "value": float(o["value"])}
            for o in data.get("cpi", [])
            if o.get("value") not in (None, ".", "")
        ]
        cpi_by_date = {c["date"]: c["value"] for c in cpi_all}
        cpi_sorted_desc = sorted(cpi_all, key=lambda x: x["date"], reverse=True)

        history: List[RegimeHistoryData] = []
        transitions: List[Dict] = []
        prev_regime: Optional[str] = None

        for gdp_pt in gdp_points:
            if not (s_str <= gdp_pt["date"] <= e_str):
                continue

            gdp_growth = gdp_pt["value"]

            # Find nearest CPI date
            gdp_date = date_type.fromisoformat(gdp_pt["date"][:10])
            cpi_candidates = [
                c for c in cpi_sorted_desc
                if s_str <= c["date"] <= e_str
            ]
            if not cpi_candidates:
                continue
            closest = min(cpi_candidates, key=lambda c: abs(
                (date_type.fromisoformat(c["date"][:10]) - gdp_date).days
            ))

            # Compute CPI YoY
            try:
                idx = next(i for i, c in enumerate(cpi_sorted_desc) if c["date"] == closest["date"])
                cpi_yoy = 0.0
                if idx + 12 < len(cpi_sorted_desc):
                    year_ago = cpi_sorted_desc[idx + 12]["value"]
                    if year_ago:
                        cpi_yoy = (closest["value"] - year_ago) / year_ago * 100
            except (StopIteration, ZeroDivisionError):
                cpi_yoy = 0.0

            growth_score    = max(-100.0, min(100.0, (gdp_growth / 5.0) * 100))
            inflation_score = max(-100.0, min(100.0, (cpi_yoy - 2.0) / 6.0 * 100))
            regime = _classify(growth_score, inflation_score, cpi_yoy)

            history.append(RegimeHistoryData(
                date=gdp_pt["date"],
                regime=regime,
                growth_score=round(growth_score, 2),
                inflation_score=round(inflation_score, 2),
                gdp_growth=round(gdp_growth, 2),
                cpi_yoy=round(cpi_yoy, 2),
            ))

            if prev_regime and regime != prev_regime:
                transitions.append({"date": gdp_pt["date"], "from": prev_regime, "to": regime})
            prev_regime = regime

        return AnnotatedResult(result=history, metadata={"transitions": transitions})

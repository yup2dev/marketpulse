"""PMI Proxy Fetcher — CFNAI + Diffusion Index + Sahm Rule (3 FRED series merged)."""
import logging
from typing import Any, Dict, List, Optional

from data_fetcher.fetchers.base import Fetcher
from data_fetcher.fetchers.fred.series import FredSeriesFetcher
from data_fetcher.models.fred.pmi import PMIData, PMIQueryParams
from data_fetcher.utils.api_keys import get_api_key

log = logging.getLogger(__name__)

_SERIES_MAP = {
    "cfnai": "CFNAI",
    "diff":  "CFNAIDIFF",
    "sahm":  "SAHMCURRENT",
}


class FREDPMIFetcher(Fetcher[PMIQueryParams, PMIData]):
    """경기순환 지표 — CFNAI / 확산지수 / Sahm Rule 통합 시계열."""

    @staticmethod
    def transform_query(params: Dict[str, Any]) -> PMIQueryParams:
        return PMIQueryParams(**params)

    @staticmethod
    def extract_data(
        query: PMIQueryParams,
        credentials: Optional[Dict[str, str]] = None,
        **kwargs: Any,
    ) -> Dict[str, List[Dict]]:
        api_key = get_api_key(credentials=credentials, api_name="FRED", env_var="FRED_API_KEY")
        raw: Dict[str, List[Dict]] = {}
        for key, series_id in _SERIES_MAP.items():
            try:
                raw[key] = FredSeriesFetcher.fetch_series(
                    series_id=series_id,
                    api_key=api_key,
                    start_date=query.start_date,
                    end_date=query.end_date,
                    sort_order="asc",
                )
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
        # Build per-series value lookups
        cfnai_vals = {
            o["date"]: round(float(o["value"]), 4)
            for o in data.get("cfnai", [])
            if o.get("value") not in (None, ".", "")
        }
        diff_vals = {
            o["date"]: round(float(o["value"]), 4)
            for o in data.get("diff", [])
            if o.get("value") not in (None, ".", "")
        }
        sahm_vals = {
            o["date"]: round(float(o["value"]), 4)
            for o in data.get("sahm", [])
            if o.get("value") not in (None, ".", "")
        }

        # 3-month moving average of CFNAI
        cfnai_sorted = sorted(cfnai_vals.items())
        ma3_vals: Dict[str, float] = {}
        for i in range(2, len(cfnai_sorted)):
            avg = round(sum(v for _, v in cfnai_sorted[i - 2:i + 1]) / 3, 4)
            ma3_vals[cfnai_sorted[i][0]] = avg

        all_dates = sorted(set(cfnai_vals) | set(diff_vals) | set(sahm_vals))
        results = []
        for date_str in all_dates:
            row: Dict[str, Any] = {"date": date_str}
            if date_str in cfnai_vals: row["cfnai"]     = cfnai_vals[date_str]
            if date_str in ma3_vals:   row["cfnai_ma3"] = ma3_vals[date_str]
            if date_str in diff_vals:  row["diff"]      = diff_vals[date_str]
            if date_str in sahm_vals:  row["sahm"]      = sahm_vals[date_str]
            if len(row) > 1:
                results.append(PMIData(**row))
        return results

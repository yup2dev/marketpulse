"""Initial Claims Fetcher — ICSA + 4-week moving average."""
import logging
from typing import Any, Dict, List, Optional

from data_fetcher.fetchers.base import Fetcher
from data_fetcher.fetchers.fred.series import FredSeriesFetcher
from data_fetcher.models.fred.initial_claims import InitialClaimsData, InitialClaimsQueryParams
from data_fetcher.utils.api_keys import get_api_key

log = logging.getLogger(__name__)


class FREDInitialClaimsFetcher(Fetcher[InitialClaimsQueryParams, InitialClaimsData]):
    """신규 실업급여 청구 주간 시계열 + 4주 이동평균."""

    @staticmethod
    def transform_query(params: Dict[str, Any]) -> InitialClaimsQueryParams:
        return InitialClaimsQueryParams(**params)

    @staticmethod
    def extract_data(
        query: InitialClaimsQueryParams,
        credentials: Optional[Dict[str, str]] = None,
        **kwargs: Any,
    ) -> List[Dict]:
        api_key = get_api_key(credentials=credentials, api_name="FRED", env_var="FRED_API_KEY")
        return FredSeriesFetcher.fetch_series(
            series_id="ICSA",
            api_key=api_key,
            start_date=query.start_date,
            end_date=query.end_date,
            sort_order="asc",
        )

    @staticmethod
    def transform_data(
        query: InitialClaimsQueryParams,
        data: List[Dict],
        **kwargs: Any,
    ) -> List[InitialClaimsData]:
        clean = [
            {"date": o["date"], "value": float(o["value"])}
            for o in data
            if o.get("value") not in (None, ".", "")
        ]

        results = []
        for i, row in enumerate(clean):
            point: Dict[str, Any] = {
                "date": row["date"],
                "claims": round(row["value"] / 1000, 1),  # → thousands
            }
            if i >= 3:
                ma = sum(c["value"] for c in clean[i - 3:i + 1]) / 4 / 1000
                point["ma_4w"] = round(ma, 1)
            results.append(InitialClaimsData(**point))
        return results

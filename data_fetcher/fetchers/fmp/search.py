"""FMP Stock Search Fetcher"""
import logging
import requests
from typing import Any, Dict, List, Optional

from data_fetcher.fetchers.base import Fetcher
from data_fetcher.models.fmp.search import FMPSearchQueryParams, FMPSearchData
from data_fetcher.utils.api_keys import get_api_key

log = logging.getLogger(__name__)


class FMPSearchFetcher(Fetcher[FMPSearchQueryParams, FMPSearchData]):

    BASE_URL = "https://financialmodelingprep.com/stable"

    @staticmethod
    def transform_query(params: Dict[str, Any]) -> FMPSearchQueryParams:
        return FMPSearchQueryParams(**params)

    @staticmethod
    def extract_data(
        query: FMPSearchQueryParams,
        credentials: Optional[Dict[str, str]] = None,
        **kwargs: Any,
    ) -> List[Dict[str, Any]]:
        api_key = get_api_key(credentials=credentials, api_name="FMP", env_var="FMP_API_KEY")
        params = {"query": query.query, "limit": query.limit, "apikey": api_key}

        for endpoint in ("search-symbol", "search-name"):
            try:
                r = requests.get(f"{FMPSearchFetcher.BASE_URL}/{endpoint}", params=params, timeout=30)
                r.raise_for_status()
                data = r.json()
                if isinstance(data, list) and data:
                    return data
            except Exception as e:
                log.error(f"FMP {endpoint} failed for '{query.query}': {e}")
                raise
        return []

    @staticmethod
    def transform_data(
        query: FMPSearchQueryParams,
        data: List[Dict[str, Any]],
        **kwargs: Any,
    ) -> List[FMPSearchData]:
        results = [FMPSearchData.model_validate(item) for item in data]
        results.sort(key=lambda s: (
            0 if s.currency == "USD" else 1,
            1 if "." in s.symbol else 0,
            len(s.symbol),
            s.symbol,
        ))
        return results

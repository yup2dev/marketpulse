"""FMP Stock Search — QueryParams + Data + Fetcher"""
import logging
from typing import Any, Dict, List, Optional

from data_fetcher.abstract_provider.abstract.base_fetchers import ApiFetcher
from data_fetcher.abstract_provider.standard_models import SearchQueryParams, SearchData
from data_fetcher.utils.api_keys import get_api_key
from data_fetcher.utils.provider_helpers import amake_json_request as amake_request

log = logging.getLogger(__name__)

FMP_STABLE_BASE = "https://financialmodelingprep.com/stable"


# ── QueryParams ───────────────────────────────────────────────────────────────

class FMPSearchQueryParams(SearchQueryParams):
    """FMP 종목 검색 파라미터 (SearchQueryParams 상속)"""
    pass


# ── Data ──────────────────────────────────────────────────────────────────────

class FMPSearchData(SearchData):
    """FMP 종목 검색 결과

    Standard fields covered:
        symbol, name, exchange, exchange_short_name, stock_type, currency

    FMP raw API field mapping:
        stockExchange → exchange
        exchangeShortName → exchange_short_name
    """
    __alias_dict__ = {
        "exchange": "stockExchange",
        "exchange_short_name": "exchangeShortName",
    }


# ── Fetcher ───────────────────────────────────────────────────────────────────

class FMPSearchFetcher(ApiFetcher[FMPSearchQueryParams, FMPSearchData]):

    api_name = "FMP"
    api_key_env = "FMP_API_KEY"

    @staticmethod
    def transform_query(params: Dict[str, Any]) -> FMPSearchQueryParams:
        return FMPSearchQueryParams(**params)

    @staticmethod
    async def aextract_data(
        query: FMPSearchQueryParams,
        credentials: Optional[Dict[str, str]] = None,
        **kwargs: Any,
    ) -> List[Dict[str, Any]]:
        api_key = get_api_key(credentials=credentials, api_name="FMP", env_var="FMP_API_KEY")
        params = {"query": query.query, "limit": query.limit, "apikey": api_key}

        for endpoint in ("search-symbol", "search-name"):
            try:
                data = await amake_request(f"{FMP_STABLE_BASE}/{endpoint}", params=params, timeout=30)
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

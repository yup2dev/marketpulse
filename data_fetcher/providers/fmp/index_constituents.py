"""FMP Index Constituents — QueryParams + Data + Fetcher"""
import logging
from typing import Any, Dict, List, Optional

from data_fetcher.abstract_provider.abstract.base_fetchers import ApiFetcher
from data_fetcher.abstract_provider.standard_models.index_constituents import (
    IndexConstituentsQueryParams as IndexQueryParams,
    IndexConstituentData as ConstituentResult,
)
from data_fetcher.utils.api_keys import get_api_key
from data_fetcher.utils.async_http_client import amake_request, HTTPClientError

log = logging.getLogger(__name__)

FMP_V3_BASE = "https://financialmodelingprep.com/api/v3"


# ── Fetcher ───────────────────────────────────────────────────────────────────

class FMPIndexConstituentsFetcher(ApiFetcher[IndexQueryParams, ConstituentResult]):
    """FMP Index Constituents Fetcher - S&P 500, NASDAQ 100, Dow 30"""

    api_name = "FMP"
    api_key_env = "FMP_API_KEY"

    @staticmethod
    def transform_query(params: Dict[str, Any]) -> IndexQueryParams:
        return IndexQueryParams(**params)

    @staticmethod
    async def aextract_data(
        query: IndexQueryParams,
        credentials: Optional[Dict[str, str]] = None,
        **kwargs: Any
    ) -> List[Dict[str, Any]]:
        try:
            api_key = get_api_key(credentials=credentials, api_name="FMP", env_var="FMP_API_KEY")
            endpoint_map = {
                "sp500": "sp500_constituent",
                "nasdaq100": "nasdaq_constituent",
                "dow30": "dowjones_constituent",
            }
            endpoint = endpoint_map.get(query.index.lower())
            if not endpoint:
                log.error(f"Unknown index: {query.index}")
                return []
            url = f"{FMP_V3_BASE}/{endpoint}"
            data = await amake_request(url, params={"apikey": api_key}, timeout=30)
            if not isinstance(data, list):
                log.warning(f"Unexpected response format for index: {query.index}")
                return []
            log.info(f"Retrieved {len(data)} constituents for {query.index}")
            return data
        except HTTPClientError as e:
            log.error(f"Error fetching index constituents for '{query.index}': {e}")
            raise
        except Exception as e:
            log.error(f"Unexpected error: {e}")
            raise

    @staticmethod
    def transform_data(
        query: IndexQueryParams,
        data: List[Dict[str, Any]],
        **kwargs: Any
    ) -> List[ConstituentResult]:
        if not data:
            return []
        results = []
        for item in data:
            try:
                results.append(ConstituentResult(
                    symbol=item.get("symbol", ""),
                    name=item.get("name", ""),
                    sector=item.get("sector"),
                    sub_sector=item.get("subSector"),
                    headquarters=item.get("headQuarter"),
                    date_first_added=item.get("dateFirstAdded"),
                    cik=item.get("cik"),
                    founded=item.get("founded"),
                ))
            except (KeyError, ValueError) as e:
                log.warning(f"Error parsing constituent: {e}")
                continue
        return results

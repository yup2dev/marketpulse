"""FMP Index Constituents Fetcher"""
import logging
import requests
from typing import Any, Dict, List, Optional

from data_fetcher.fetchers.base import Fetcher
from data_fetcher.utils.api_keys import get_api_key

log = logging.getLogger(__name__)


class IndexQueryParams:
    """Index query parameters"""

    def __init__(self, index: str = "sp500"):
        """
        Args:
            index: Index name - 'sp500', 'nasdaq100', 'dow30'
        """
        self.index = index


class ConstituentResult:
    """Index constituent data"""

    def __init__(
        self,
        symbol: str,
        name: str,
        sector: Optional[str] = None,
        sub_sector: Optional[str] = None,
        headquarters: Optional[str] = None,
        date_first_added: Optional[str] = None,
        cik: Optional[str] = None,
        founded: Optional[str] = None,
    ):
        self.symbol = symbol
        self.name = name
        self.sector = sector
        self.sub_sector = sub_sector
        self.headquarters = headquarters
        self.date_first_added = date_first_added
        self.cik = cik
        self.founded = founded


class FMPIndexConstituentsFetcher(Fetcher[IndexQueryParams, ConstituentResult]):
    """FMP Index Constituents Fetcher - S&P 500, NASDAQ 100, Dow 30"""

    BASE_URL = "https://financialmodelingprep.com/api/v3"

    @staticmethod
    def transform_query(params: Dict[str, Any]) -> IndexQueryParams:
        """Transform query parameters"""
        return IndexQueryParams(**params)

    @staticmethod
    def extract_data(
        query: IndexQueryParams,
        credentials: Optional[Dict[str, str]] = None,
        **kwargs: Any
    ) -> List[Dict[str, Any]]:
        """
        Extract index constituents data from FMP

        Args:
            query: Query parameters
            credentials: API key dictionary
            **kwargs: Additional parameters

        Returns:
            Raw data list
        """
        try:
            # Get API key
            api_key = get_api_key(
                credentials=credentials,
                api_name="FMP",
                env_var="FMP_API_KEY"
            )

            # Map index names to FMP endpoints
            endpoint_map = {
                "sp500": "sp500_constituent",
                "nasdaq100": "nasdaq_constituent",
                "dow30": "dowjones_constituent",
            }

            endpoint = endpoint_map.get(query.index.lower())
            if not endpoint:
                log.error(f"Unknown index: {query.index}")
                return []

            url = f"{FMPIndexConstituentsFetcher.BASE_URL}/{endpoint}"
            params = {"apikey": api_key}

            response = requests.get(url, params=params, timeout=30)
            response.raise_for_status()
            data = response.json()

            if not isinstance(data, list):
                log.warning(f"Unexpected response format for index: {query.index}")
                return []

            log.info(f"Retrieved {len(data)} constituents for {query.index}")
            return data

        except requests.exceptions.RequestException as e:
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
        """
        Transform raw data to standard model

        Args:
            query: Query parameters
            data: Raw data
            **kwargs: Additional parameters

        Returns:
            ConstituentResult list
        """
        if not data:
            log.info(f"No constituents found for index: {query.index}")
            return []

        results = []

        for item in data:
            try:
                result = ConstituentResult(
                    symbol=item.get("symbol", ""),
                    name=item.get("name", ""),
                    sector=item.get("sector"),
                    sub_sector=item.get("subSector"),
                    headquarters=item.get("headQuarter"),
                    date_first_added=item.get("dateFirstAdded"),
                    cik=item.get("cik"),
                    founded=item.get("founded"),
                )

                results.append(result)

            except (KeyError, ValueError) as e:
                log.warning(f"Error parsing constituent: {e}")
                continue

        log.info(f"Parsed {len(results)} constituents for {query.index}")
        return results
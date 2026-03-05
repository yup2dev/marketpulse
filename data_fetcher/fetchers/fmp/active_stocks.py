"""FMP Active Stocks Fetcher - Get most active, gainers, and losers"""
import logging
import requests
from typing import Any, Dict, List, Optional

from data_fetcher.fetchers.base import Fetcher
from data_fetcher.utils.api_keys import get_api_key

log = logging.getLogger(__name__)


class ActiveStocksQueryParams:
    """Active stocks query parameters"""

    def __init__(self, type: str = "actives"):
        """
        Args:
            type: 'actives', 'gainers', or 'losers'
        """
        self.type = type


class ActiveStockResult:
    """Active stock data"""

    def __init__(
        self,
        symbol: str,
        name: str,
        change: Optional[float] = None,
        price: Optional[float] = None,
        change_percentage: Optional[str] = None,
    ):
        self.symbol = symbol
        self.name = name
        self.change = change
        self.price = price
        self.change_percentage = change_percentage


class FMPActiveStocksFetcher(Fetcher[ActiveStocksQueryParams, ActiveStockResult]):
    """FMP Active Stocks Fetcher - Most actives, gainers, and losers"""

    BASE_URL = "https://financialmodelingprep.com/stable"

    @staticmethod
    def transform_query(params: Dict[str, Any]) -> ActiveStocksQueryParams:
        """Transform query parameters"""
        return ActiveStocksQueryParams(**params)

    @staticmethod
    def extract_data(
        query: ActiveStocksQueryParams,
        credentials: Optional[Dict[str, str]] = None,
        **kwargs: Any
    ) -> List[Dict[str, Any]]:
        """
        Extract active stocks data from FMP

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

            # Map type to FMP endpoints
            endpoint_map = {
                "actives": "actives",
                "gainers": "gainers",
                "losers": "losers",
            }

            endpoint = endpoint_map.get(query.type.lower())
            if not endpoint:
                log.error(f"Unknown type: {query.type}")
                return []

            url = f"{FMPActiveStocksFetcher.BASE_URL}/{endpoint}"
            params = {"apikey": api_key}

            response = requests.get(url, params=params, timeout=30)
            response.raise_for_status()
            data = response.json()

            if not isinstance(data, list):
                log.warning(f"Unexpected response format for type: {query.type}")
                return []

            log.info(f"Retrieved {len(data)} {query.type} stocks")
            return data

        except requests.exceptions.RequestException as e:
            log.error(f"Error fetching {query.type} stocks: {e}")
            raise
        except Exception as e:
            log.error(f"Unexpected error: {e}")
            raise

    @staticmethod
    def transform_data(
        query: ActiveStocksQueryParams,
        data: List[Dict[str, Any]],
        **kwargs: Any
    ) -> List[ActiveStockResult]:
        """
        Transform raw data to standard model

        Args:
            query: Query parameters
            data: Raw data
            **kwargs: Additional parameters

        Returns:
            ActiveStockResult list
        """
        if not data:
            log.info(f"No {query.type} stocks found")
            return []

        results = []

        for item in data:
            try:
                result = ActiveStockResult(
                    symbol=item.get("symbol", ""),
                    name=item.get("name", ""),
                    change=item.get("change"),
                    price=item.get("price"),
                    change_percentage=item.get("changesPercentage"),
                )

                results.append(result)

            except (KeyError, ValueError) as e:
                log.warning(f"Error parsing active stock: {e}")
                continue

        log.info(f"Parsed {len(results)} {query.type} stocks")
        return results
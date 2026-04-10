"""FMP Active Stocks Fetcher - Get most active, gainers, and losers"""
import logging
import requests
from typing import Any, Dict, List, Optional

from data_fetcher.fetchers.base import Fetcher
from data_fetcher.models.fmp.active_stocks import FMPActiveStocksQueryParams, FMPActiveStockData
from data_fetcher.utils.api_keys import get_api_key

log = logging.getLogger(__name__)


class FMPActiveStocksFetcher(Fetcher[FMPActiveStocksQueryParams, FMPActiveStockData]):

    BASE_URL = "https://financialmodelingprep.com/stable"

    @staticmethod
    def transform_query(params: Dict[str, Any]) -> FMPActiveStocksQueryParams:
        return FMPActiveStocksQueryParams(**params)

    @staticmethod
    def extract_data(
        query: FMPActiveStocksQueryParams,
        credentials: Optional[Dict[str, str]] = None,
        **kwargs: Any,
    ) -> List[Dict[str, Any]]:
        api_key = get_api_key(credentials=credentials, api_name="FMP", env_var="FMP_API_KEY")
        endpoint_map = {"actives": "actives", "gainers": "gainers", "losers": "losers"}
        endpoint = endpoint_map.get(query.type.lower())
        if not endpoint:
            log.error(f"Unknown type: {query.type}")
            return []
        try:
            r = requests.get(
                f"{FMPActiveStocksFetcher.BASE_URL}/{endpoint}",
                params={"apikey": api_key},
                timeout=30,
            )
            r.raise_for_status()
            data = r.json()
            return data if isinstance(data, list) else []
        except Exception as e:
            log.error(f"Error fetching {query.type} stocks: {e}")
            raise

    @staticmethod
    def transform_data(
        query: FMPActiveStocksQueryParams,
        data: List[Dict[str, Any]],
        **kwargs: Any,
    ) -> List[FMPActiveStockData]:
        return [
            FMPActiveStockData(
                symbol=item.get("symbol", ""),
                name=item.get("name", ""),
                change=item.get("change"),
                price=item.get("price"),
                change_percentage=item.get("changesPercentage"),
            )
            for item in data
        ]

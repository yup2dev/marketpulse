"""FMP Biggest Gainers Fetcher."""
import logging
import requests
from typing import Any, Dict, List, Optional

from data_fetcher.fetchers.base import Fetcher
from data_fetcher.models.fmp.active_stocks import FMPMoversQueryParams, FMPActiveStockData
from data_fetcher.utils.api_keys import get_api_key

log = logging.getLogger(__name__)


class FMPGainersFetcher(Fetcher[FMPMoversQueryParams, FMPActiveStockData]):

    BASE_URL = "https://financialmodelingprep.com/stable"

    @staticmethod
    def transform_query(params: Dict[str, Any]) -> FMPMoversQueryParams:
        return FMPMoversQueryParams(**params)

    @staticmethod
    def extract_data(
        query: FMPMoversQueryParams,
        credentials: Optional[Dict[str, str]] = None,
        **kwargs: Any,
    ) -> List[Dict[str, Any]]:
        api_key = get_api_key(credentials=credentials, api_name="FMP", env_var="FMP_API_KEY")
        url = f"{FMPGainersFetcher.BASE_URL}/biggest-gainers"
        r = requests.get(url, params={"apikey": api_key}, timeout=30)
        r.raise_for_status()
        data = r.json()
        return data if isinstance(data, list) else []

    @staticmethod
    def transform_data(
        query: FMPMoversQueryParams,
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

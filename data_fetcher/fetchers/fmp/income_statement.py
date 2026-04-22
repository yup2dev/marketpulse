"""FMP Income Statement Fetcher"""
import logging
import requests
from typing import Any, Dict, List, Optional

from data_fetcher.fetchers.base import Fetcher
from data_fetcher.models.fmp.income_statement import IncomeStatementQueryParams, IncomeStatementData
from data_fetcher.utils.api_keys import get_api_key

log = logging.getLogger(__name__)


class FMPIncomeStatementFetcher(Fetcher[IncomeStatementQueryParams, IncomeStatementData]):
    """FMP 손익계산서 Fetcher"""

    BASE_URL = "https://financialmodelingprep.com/stable"

    @staticmethod
    def transform_query(params: Dict[str, Any]) -> IncomeStatementQueryParams:
        return IncomeStatementQueryParams(**params)

    @staticmethod
    def extract_data(
        query: IncomeStatementQueryParams,
        credentials: Optional[Dict[str, str]] = None,
        **kwargs: Any
    ) -> List[Dict[str, Any]]:
        api_key = get_api_key(credentials=credentials, api_name="FMP", env_var="FMP_API_KEY")
        params = {"symbol": query.symbol, "apikey": api_key, "limit": query.limit or 10}
        if query.period:
            params["period"] = query.period
        response = requests.get(
            f"{FMPIncomeStatementFetcher.BASE_URL}/income-statement",
            params=params,
            timeout=30,
        )
        response.raise_for_status()
        data = response.json()
        if not isinstance(data, list):
            log.warning(f"Unexpected response format for {query.symbol}")
            return []
        return data

    @staticmethod
    def transform_data(
        query: IncomeStatementQueryParams,
        data: List[Dict[str, Any]],
        **kwargs: Any
    ) -> List[IncomeStatementData]:
        return [IncomeStatementData.model_validate(d) for d in data]

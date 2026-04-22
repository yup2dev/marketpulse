"""AlphaVantage Company Overview Fetcher"""
import logging
from typing import Any, Dict, List, Optional
import requests

from data_fetcher.fetchers.base import Fetcher
from data_fetcher.models.alphavantage.company_overview import (
    CompanyOverviewQueryParams,
    CompanyOverviewData
)
from data_fetcher.utils.api_keys import get_api_key

log = logging.getLogger(__name__)


class AlphaVantageCompanyOverviewFetcher(
    Fetcher[CompanyOverviewQueryParams, CompanyOverviewData]
):
    """AlphaVantage 기업 개요 Fetcher"""

    @staticmethod
    def transform_query(params: Dict[str, Any]) -> CompanyOverviewQueryParams:
        return CompanyOverviewQueryParams(**params)

    @staticmethod
    def extract_data(
        query: CompanyOverviewQueryParams,
        credentials: Optional[Dict[str, str]] = None,
        **kwargs: Any
    ) -> Dict[str, Any]:
        api_key = get_api_key(
            credentials=credentials,
            api_name="AlphaVantage",
            env_var="ALPHAVANTAGE_API_KEY"
        )

        response = requests.get(
            "https://www.alphavantage.co/query",
            params={'function': 'OVERVIEW', 'symbol': query.symbol.upper(), 'apikey': api_key},
            timeout=30,
        )
        response.raise_for_status()
        data = response.json()

        if 'Error Message' in data:
            raise ValueError(f"AlphaVantage API Error: {data['Error Message']}")
        if 'Note' in data:
            raise ValueError(f"AlphaVantage API Limit: {data['Note']}")
        return data

    @staticmethod
    def transform_data(
        query: CompanyOverviewQueryParams,
        data: Dict[str, Any],
        **kwargs: Any
    ) -> List[CompanyOverviewData]:
        return [CompanyOverviewData.model_validate(data)]

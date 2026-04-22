"""FMP Company Profile Fetcher"""
import logging
import requests
from typing import Any, Dict, List, Optional

from data_fetcher.fetchers.base import Fetcher
from data_fetcher.models.fmp.company_profile import CompanyProfileQueryParams, CompanyProfileData
from data_fetcher.utils.api_keys import get_api_key

log = logging.getLogger(__name__)


class FMPCompanyProfileFetcher(Fetcher[CompanyProfileQueryParams, CompanyProfileData]):
    """FMP 회사 프로필 Fetcher"""

    BASE_URL = "https://financialmodelingprep.com/stable"

    @staticmethod
    def transform_query(params: Dict[str, Any]) -> CompanyProfileQueryParams:
        return CompanyProfileQueryParams(**params)

    @staticmethod
    def extract_data(
        query: CompanyProfileQueryParams,
        credentials: Optional[Dict[str, str]] = None,
        **kwargs: Any
    ) -> List[Dict[str, Any]]:
        api_key = get_api_key(credentials=credentials, api_name="FMP", env_var="FMP_API_KEY")
        response = requests.get(
            f"{FMPCompanyProfileFetcher.BASE_URL}/profile",
            params={"symbol": query.symbol, "apikey": api_key},
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
        query: CompanyProfileQueryParams,
        data: List[Dict[str, Any]],
        **kwargs: Any
    ) -> List[CompanyProfileData]:
        return [CompanyProfileData.model_validate(d) for d in data]

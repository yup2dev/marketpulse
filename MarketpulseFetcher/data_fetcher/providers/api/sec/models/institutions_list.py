"""
SEC Institutions List Fetcher
Dynamically fetches list of institutions that file 13F reports
"""
import logging
from typing import Any, Dict, List, Optional

from data_fetcher.abstract_provider.abstract.base_fetchers import ApiFetcher
from data_fetcher.abstract_provider.standard_models.institutions_list import (
    InstitutionsListQueryParams,
    InstitutionInfo,
)
from pydantic import Field

from data_fetcher.providers.api.sec.utils.institutions import (
    clear_cache, fetch_13f_filers, recent_quarters, to_institutions,
)
from typing import Optional as _Optional

log = logging.getLogger(__name__)



class SECInstitutionsListQueryParams(InstitutionsListQueryParams):
    """Query parameters for institutions list (standard 경유)"""
    min_aum: _Optional[float] = Field(
        default=None, description="Minimum AUM in billions (optional filter)"
    )


class SECInstitutionsListFetcher(ApiFetcher[SECInstitutionsListQueryParams, InstitutionInfo]):
    """Fetcher for getting list of institutions that file 13F reports"""

    require_credentials = False
    target = "local"           # 13F 원본 파싱은 메모리를 크게 써 운영 서버 대신 사용자 PC 에서

    # 캐시 · HTTP 는 utils/institutions.py (13F 조회 모델도 그걸 쓴다)

    @staticmethod
    def transform_query(params: Dict[str, Any]) -> SECInstitutionsListQueryParams:
        """Transform query parameters"""
        return SECInstitutionsListQueryParams(**params)

    @staticmethod
    def extract_data(
        query: SECInstitutionsListQueryParams,
        credentials: Optional[Dict[str, str]] = None,
        **kwargs: Any
    ) -> Dict[str, Any]:
        """
        Extract list of institutions from SEC EDGAR

        Args:
            query: Query parameters
            credentials: Not required for SEC data
            **kwargs: Additional parameters

        Returns:
            Raw data with institutions list
        """
        return fetch_13f_filers(query.limit)

    @staticmethod
    def _recent_quarters(n: int = 2) -> List[tuple]:
        return recent_quarters(n)

    @staticmethod
    def transform_data(
        query: SECInstitutionsListQueryParams,
        data: Dict[str, Any],
        **kwargs: Any
    ) -> List[InstitutionInfo]:
        """
        Transform raw SEC data to InstitutionInfo models

        Args:
            query: Query parameters
            data: Raw data from extract_data
            **kwargs: Additional parameters

        Returns:
            List of InstitutionInfo objects
        """
        return to_institutions(data)

    @staticmethod
    def _generate_key(name: str) -> str:
        """Generate a URL-friendly key from institution name"""
        # Remove common suffixes and clean up
        key = name.lower()

        # Remove common business entity types
        for suffix in [' inc', ' llc', ' lp', ' ltd', ' corp', ' co',
                      ' limited', ' corporation', ' management',
                      ' advisors', ' capital', ' partners']:
            key = key.replace(suffix, '')

        # Remove special characters and replace spaces with hyphens
        key = ''.join(c if c.isalnum() or c.isspace() else '' for c in key)
        key = '-'.join(key.split())

        # Truncate to reasonable length
        if len(key) > 30:
            key = key[:30]

        return key.strip('-')

    @classmethod
    def clear_cache(cls):
        """Clear the cached institutions list"""
        clear_cache()

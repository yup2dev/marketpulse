"""Institutions List Fetcher — SEC EDGAR 13F 기관 목록 조회."""
import logging
from typing import Any, Dict, List, Optional

from data_fetcher.abstract_provider.abstract import BaseQueryParams
from data_fetcher.abstract_provider.abstract.fetcher import Fetcher
from data_fetcher.providers.sec.institutional_13f import InstitutionInfo

log = logging.getLogger(__name__)


class InstitutionsListQueryParams(BaseQueryParams):
    use_dynamic: bool = True
    limit: int = 100


class InstitutionsListFetcher(Fetcher[InstitutionsListQueryParams, InstitutionInfo]):
    """SEC EDGAR 13F 제출 기관 목록 조회."""

    require_credentials = False

    @staticmethod
    def transform_query(params: Dict[str, Any]) -> InstitutionsListQueryParams:
        return InstitutionsListQueryParams(**params)

    @staticmethod
    def extract_data(
        query: InstitutionsListQueryParams,
        credentials: Optional[Dict[str, str]] = None,
        **kwargs: Any,
    ) -> List[InstitutionInfo]:
        from data_fetcher.providers.sec.institutional_13f import SEC13FFetcher
        return SEC13FFetcher.get_institutions_list(
            use_dynamic=query.use_dynamic,
            limit=query.limit,
        )

    @staticmethod
    def transform_data(
        query: InstitutionsListQueryParams,
        data: List[InstitutionInfo],
        **kwargs: Any,
    ) -> List[InstitutionInfo]:
        return data or []

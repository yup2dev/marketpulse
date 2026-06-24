"""SEC Institutions Search Model."""

# pylint: disable=unused-argument

from typing import Any

from data_fetcher.abstract_provider.abstract.fetcher import Fetcher
from data_fetcher.abstract_provider.standard_models.institutions_search import (
    InstitutionsSearchQueryParams,
    InstitutionsSearchData,
)
from pydantic import Field


class SecInstitutionsSearchQueryParams(InstitutionsSearchQueryParams):
    """SEC Institutions Search Query (standard 경유).

    Source: https://sec.gov/
    """


class SecInstitutionsSearchData(InstitutionsSearchData):
    """SEC Institutions Search Data (standard 경유, SEC 원본키 alias)."""

    __alias_dict__ = {
        "name": "Institution",
        "cik": "CIK Number",
    }


class SecInstitutionsSearchFetcher(
    Fetcher[
        SecInstitutionsSearchQueryParams,
        list[SecInstitutionsSearchData],
    ]
):
    """SEC Institutions Search Fetcher."""

    @staticmethod
    def transform_query(params: dict[str, Any]) -> SecInstitutionsSearchQueryParams:
        """Transform the query."""
        return SecInstitutionsSearchQueryParams(**params)

    @staticmethod
    async def aextract_data(
        query: SecInstitutionsSearchQueryParams,
        credentials: dict[str, str] | None,
        **kwargs: Any,
    ) -> list[dict]:
        """Return the raw data from the SEC endpoint."""
        # pylint: disable=import-outside-toplevel
        from data_fetcher.providers.sec.utils.helpers import get_all_ciks

        institutions = await get_all_ciks(use_cache=query.use_cache)
        hp = institutions["Institution"].str.contains(query.query, case=False)
        return institutions[hp].astype(str).to_dict("records")

    @staticmethod
    def transform_data(
        query: SecInstitutionsSearchQueryParams, data: list[dict], **kwargs: Any
    ) -> list[SecInstitutionsSearchData]:
        """Transform the data to the standard format."""
        return [SecInstitutionsSearchData.model_validate(d) for d in data]

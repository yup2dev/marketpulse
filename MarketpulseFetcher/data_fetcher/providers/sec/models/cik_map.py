"""SEC CIK Mapping Model."""

# pylint: disable=unused-argument

from typing import Any

from data_fetcher.abstract_provider.abstract.base_fetchers import ApiFetcher
from data_fetcher.utils.provider_errors import OpenBBError
from data_fetcher.abstract_provider.standard_models.cik_map import CikMapData, CikMapQueryParams
from pydantic import Field


class SecCikMapQueryParams(CikMapQueryParams):
    """SEC CIK Mapping Query.

    Source: https://sec.gov/
    """

    use_cache: bool | None = Field(
        default=True,
        description="Whether or not to use cache for the request, default is True.",
    )


class SecCikMapData(CikMapData):
    """SEC CIK Mapping Data."""


class SecCikMapFetcher(
    ApiFetcher[
        SecCikMapQueryParams,
        SecCikMapData,
    ]
):
    """SEC CIK Map Fetcher."""

    require_credentials = False  # SEC EDGAR is keyless

    @staticmethod
    def transform_query(params: dict[str, Any]) -> SecCikMapQueryParams:
        """Transform the query."""
        return SecCikMapQueryParams(**params)

    @staticmethod
    async def aextract_data(
        query: SecCikMapQueryParams,
        credentials: dict[str, str] | None,
        **kwargs: Any,
    ) -> dict:
        """Return the raw data from the SEC endpoint."""
        # pylint: disable=import-outside-toplevel
        from data_fetcher.providers.sec.utils.helpers import symbol_map

        cik = await symbol_map(query.symbol, query.use_cache)
        if not cik:
            raise OpenBBError(f"Symbol '{query.symbol}' not found in SEC database.")
        return {"cik": cik}

    @staticmethod
    def transform_data(
        query: SecCikMapQueryParams, data: dict, **kwargs: Any
    ) -> SecCikMapData:
        """Transform the data to the standard format."""
        return SecCikMapData.model_validate(data)

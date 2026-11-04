"""SEC Filing Model."""

# pylint: disable=unused-argument

from datetime import date as dateType
from typing import Any

from data_fetcher.utils.provider_errors import OpenBBError
from data_fetcher.abstract_provider.abstract.data import BaseData
from data_fetcher.abstract_provider.abstract.base_fetchers import ApiFetcher
from data_fetcher.abstract_provider.abstract.query_params import BaseQueryParams
from pydantic import ConfigDict, Field, PrivateAttr, computed_field


from data_fetcher.abstract_provider.standard_models.sec_filing import (
    SecFilingQueryParams,
    SecFilingData,
    SecBaseFiling,
)


class SecFilingFetcher(ApiFetcher[SecFilingQueryParams, SecFilingData]):
    """SEC Filing Fetcher."""

    require_credentials = False  # SEC EDGAR is keyless

    @staticmethod
    def transform_query(params: dict[str, Any]) -> SecFilingQueryParams:
        """Transform the query parameters."""
        return SecFilingQueryParams(**params)

    @staticmethod
    async def aextract_data(
        query: SecFilingQueryParams,
        credentials: dict[str, str] | None,
        **kwargs: Any,
    ) -> dict:
        """Extract the raw data from the SEC site."""
        try:
            data = SecBaseFiling(query.url, query.use_cache)
        except Exception as e:  # pylint: disable=broad-except
            raise OpenBBError(e) from e

        return data.model_dump(exclude_none=True)

    @staticmethod
    def transform_data(
        query: SecFilingQueryParams, data: dict, **kwargs: Any
    ) -> SecFilingData:
        """Transform the raw data into a structured format."""
        return SecFilingData.model_validate(data)

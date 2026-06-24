"""SEC Symbol Mapping Model."""

# pylint: disable=unused-argument

from typing import Any

from data_fetcher.utils.provider_errors import OpenBBError
from data_fetcher.abstract_provider.abstract.fetcher import Fetcher
from data_fetcher.abstract_provider.standard_models.symbol_map import (
    SymbolMapQueryParams,
    SymbolMapData,
)


class SecSymbolMapQueryParams(SymbolMapQueryParams):
    """SEC Symbol Mapping Query.

    Source: https://sec.gov/
    """


class SecSymbolMapData(SymbolMapData):
    """SEC symbol map Data (standard SymbolMap 경유)."""


class SecSymbolMapFetcher(
    Fetcher[
        SecSymbolMapQueryParams,
        SecSymbolMapData,
    ]
):
    """Transform the query, extract and transform the data from the SEC endpoints."""

    @staticmethod
    def transform_query(params: dict[str, Any]) -> SecSymbolMapQueryParams:
        """Transform the query."""
        return SecSymbolMapQueryParams(**params)

    @staticmethod
    async def aextract_data(
        query: SecSymbolMapQueryParams,
        credentials: dict[str, str] | None,
        **kwargs: Any,
    ) -> dict:
        """Return the raw data from the SEC endpoint."""
        # pylint: disable=import-outside-toplevel
        from data_fetcher.providers.sec.utils.helpers import cik_map

        if not query.query.isdigit():
            raise OpenBBError("Query is required and must be a valid CIK.")
        symbol = await cik_map(int(query.query), query.use_cache)
        response = {"symbol": symbol}
        return response

    @staticmethod
    def transform_data(
        query: SecSymbolMapQueryParams, data: dict, **kwargs: Any
    ) -> SecSymbolMapData:
        """Transform the data to the standard format."""
        return SecSymbolMapData.model_validate(data)

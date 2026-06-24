"""SEC Standard Industrial Classification Code (SIC) Model."""

# pylint: disable=unused-argument

from typing import Any

from data_fetcher.abstract_provider.abstract.fetcher import Fetcher
from data_fetcher.abstract_provider.standard_models.sic_search import (
    SicSearchQueryParams,
    SicSearchData,
)
from pydantic import Field


class SecSicSearchQueryParams(SicSearchQueryParams):
    """SEC Standard Industrial Classification Code (SIC) Query (standard 경유).

    Source: https://sec.gov/
    """


class SecSicSearchData(SicSearchData):
    """SEC SIC Data (standard SicSearch 경유, SEC 원본키 alias)."""

    __alias_dict__ = {
        "sic": "SIC Code",
        "industry": "Industry Title",
        "office": "Office",
    }


class SecSicSearchFetcher(
    Fetcher[
        SecSicSearchQueryParams,
        list[SecSicSearchData],
    ]
):
    """SEC SIC Search Fetcher."""

    @staticmethod
    def transform_query(
        params: dict[str, Any], **kwargs: Any
    ) -> SecSicSearchQueryParams:
        """Transform the query."""
        return SecSicSearchQueryParams(**params)

    @staticmethod
    async def aextract_data(
        query: SecSicSearchQueryParams,
        credentials: dict[str, str] | None,
        **kwargs: Any,
    ) -> list[dict]:
        """Extract data from the SEC website table."""
        # pylint: disable=import-outside-toplevel
        from aiohttp_client_cache import SQLiteBackend  # noqa
        from aiohttp_client_cache.session import CachedSession
        from io import StringIO
        from data_fetcher.utils.provider_settings import get_user_cache_directory
        from data_fetcher.utils.provider_helpers import amake_request
        from data_fetcher.providers.sec.utils.helpers import SEC_HEADERS, sec_callback
        from pandas import DataFrame, read_html

        data = DataFrame()
        results: list[dict] = []
        url = "https://www.sec.gov/corpfin/division-of-corporation-finance-standard-industrial-classification-sic-code-list"
        response: dict | list[dict] | str = {}
        if query.use_cache is True:
            cache_dir = f"{get_user_cache_directory()}/http/sec_sic"
            async with CachedSession(
                cache=SQLiteBackend(cache_dir, expire_after=3600 * 24 * 30)
            ) as session:
                try:
                    response = await amake_request(
                        url,
                        headers=SEC_HEADERS,
                        session=session,
                        response_callback=sec_callback,  # type: ignore
                    )
                finally:
                    await session.close()
        else:
            response = await amake_request(url, headers=SEC_HEADERS, response_callback=sec_callback)  # type: ignore

        data = read_html(StringIO(response))[0].astype(str)  # type: ignore
        if len(data) == 0:
            return results
        if query:
            data = data[
                data["SIC Code"].str.contains(query.query, case=False)
                | data["Office"].str.contains(query.query, case=False)
                | data["Industry Title"].str.contains(query.query, case=False)
            ]
        data["SIC Code"] = data["SIC Code"].astype(int)
        results = data.to_dict("records")

        return results

    @staticmethod
    def transform_data(
        query: SecSicSearchQueryParams, data: list[dict], **kwargs: Any
    ) -> list[SecSicSearchData]:
        """Transform the data."""
        return [SecSicSearchData.model_validate(d) for d in data]

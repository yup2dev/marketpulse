"""SEC Equity FTD Model."""

# pylint: disable=unused-argument

from typing import Any

from data_fetcher.abstract_provider.abstract.base_fetchers import ApiFetcher
from data_fetcher.abstract_provider.standard_models.equity_ftd import (
    EquityFtdData,
    EquityFtdQueryParams,
)
from data_fetcher.utils.provider_errors import EmptyDataError
from pydantic import Field


class SecEquityFtdQueryParams(EquityFtdQueryParams):
    """SEC Equity FTD Query.

    Source: https://sec.gov/
    """

    limit: int | None = Field(
        description="""
        Limit the number of reports to parse, from most recent.
        Approximately 24 reports per year, going back to 2009.
        """,
        default=24,
    )
    skip_reports: int | None = Field(
        description="""
        Skip N number of reports from current. A value of 1 will skip the most recent report.
        """,
        default=0,
    )
    use_cache: bool | None = Field(
        default=True,
        description="Whether or not to use cache for the request, default is True."
        + " Each reporting period is a separate URL, new reports will be added to the cache.",
    )


class SecEquityFtdData(EquityFtdData):
    """SEC Equity FTD Data."""

    __alias_dict__ = {"settlement_date": "date"}


class SecEquityFtdFetcher(
    ApiFetcher[
        SecEquityFtdQueryParams,
        list[SecEquityFtdData],
    ]
):
    """SEC Equity FTD Fetcher."""

    require_credentials = False  # SEC EDGAR is keyless

    @staticmethod
    def transform_query(params: dict[str, Any]) -> SecEquityFtdQueryParams:
        """Transform query params."""
        return SecEquityFtdQueryParams(**params)

    @staticmethod
    async def aextract_data(
        query: SecEquityFtdQueryParams,
        credentials: dict[str, str] | None,
        **kwargs: Any,
    ) -> list[dict]:
        """Extract the data from the SEC website."""
        # pylint: disable=import-outside-toplevel
        import asyncio  # noqa
        from data_fetcher.providers.sec.utils.helpers import download_zip_file, get_ftd_urls  # noqa

        results = []
        limit = query.limit if query.limit is not None and query.limit > 0 else 0
        urls_data = await get_ftd_urls()
        urls = list(urls_data.values())
        if limit > 0:
            urls = (
                urls[:limit]
                if not query.skip_reports
                else urls[query.skip_reports : limit + query.skip_reports]  # noqa: E203
            )

        async def get_one(url):
            """Get data for one URL as a task."""
            data = await download_zip_file(url, query.symbol, query.use_cache)
            results.extend(data)

        tasks = [get_one(url) for url in urls]

        await asyncio.gather(*tasks)

        if not results:
            raise EmptyDataError(
                "There was an error collecting data, no results were returned."
            )

        return sorted(results, key=lambda d: d["date"], reverse=True)

    @staticmethod
    def transform_data(
        query: SecEquityFtdQueryParams, data: list[dict], **kwargs: Any
    ) -> list[SecEquityFtdData]:
        """Transform the data to the standard format."""
        return [SecEquityFtdData.model_validate(d) for d in data]

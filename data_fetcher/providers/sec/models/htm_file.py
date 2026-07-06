"""SEC HTM/HTML File Model."""

# pylint: disable=unused-argument

from typing import Any

from data_fetcher.utils.provider_errors import OpenBBError
from data_fetcher.abstract_provider.abstract.base_fetchers import ApiFetcher
from data_fetcher.abstract_provider.standard_models.htm_file import (
    HtmFileQueryParams,
    HtmFileData,
)


class SecHtmFileQueryParams(HtmFileQueryParams):
    """SEC HTM File Query Parameters (standard 경유)."""


class SecHtmFileData(HtmFileData):
    """SEC HTM File Data (standard HtmFile 경유)."""


class SecHtmFileFetcher(ApiFetcher[SecHtmFileQueryParams, SecHtmFileData]):
    """SEC HTM File Fetcher."""

    require_credentials = False  # SEC EDGAR is keyless

    @staticmethod
    def transform_query(params: dict[str, Any]) -> SecHtmFileQueryParams:
        """Transform the query."""
        if not params.get("url"):
            raise OpenBBError(ValueError("Please enter a URL."))

        url = params.get("url", "")

        if (
            not url.startswith("http")
            or "sec.gov" not in url
            or (not url.endswith(".htm") and not url.endswith(".html"))
        ):
            raise OpenBBError(
                ValueError(
                    "Invalid URL. Please a SEC URL that directs specifically to a HTM or HTML file."
                )
            )
        return SecHtmFileQueryParams(**params)

    @staticmethod
    async def aextract_data(
        query: SecHtmFileQueryParams,
        credentials: dict[str, str] | None,
        **kwargs: Any,
    ) -> dict:
        """Return the raw data from the SEC endpoint."""
        # pylint: disable=import-outside-toplevel
        from data_fetcher.providers.sec.models.sec_filing import SecBaseFiling

        return {
            "url": query.url,
            "content": SecBaseFiling.download_file(query.url, False, query.use_cache),
        }

    @staticmethod
    def transform_data(
        query: SecHtmFileQueryParams, data: dict, **kwargs: Any
    ) -> SecHtmFileData:
        """Transform the data to the standard format."""
        # pylint: disable=import-outside-toplevel
        from bs4 import BeautifulSoup  # noqa

        if not data or not data.get("content"):
            raise OpenBBError("Failed to extract HTM file data.")

        content = data.pop("content", "")
        soup = BeautifulSoup(content, "html.parser").find("html")

        # Remove style elements that add background color to table rows
        for row in soup.find_all("tr"):
            if "background-color" in row.get("style", ""):
                del row["style"]
            for attr in ["class", "bgcolor"]:
                if attr in row.attrs:
                    del row[attr]

        return SecHtmFileData(content=str(soup), url=data["url"])

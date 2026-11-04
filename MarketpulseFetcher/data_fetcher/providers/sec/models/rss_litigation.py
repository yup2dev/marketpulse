"""SEC Litigation RSS Feed Model."""

# pylint: disable=unused-argument

from typing import Any

from data_fetcher.utils.provider_errors import OpenBBError
from data_fetcher.abstract_provider.abstract.base_fetchers import ApiFetcher
from data_fetcher.abstract_provider.standard_models.rss_litigation import (
    RssLitigationQueryParams,
    RssLitigationData,
)
from data_fetcher.providers.sec.utils.definitions import HEADERS


class SecRssLitigationQueryParams(RssLitigationQueryParams):
    """SEC Litigation RSS Feed Query (standard 경유).

    Source: https://sec.gov/
    """


class SecRssLitigationData(RssLitigationData):
    """SEC Litigation RSS Feed Data (standard 경유, SEC 원본키 alias)."""

    __alias_dict__ = {
        "published": "date",
    }


class SecRssLitigationFetcher(
    ApiFetcher[SecRssLitigationQueryParams, list[SecRssLitigationData]]
):
    """SEC RSS Litigration Fetcher."""

    require_credentials = False  # SEC EDGAR is keyless

    @staticmethod
    def transform_query(params: dict[str, Any]) -> SecRssLitigationQueryParams:
        """Transform the query."""
        return SecRssLitigationQueryParams(**params)

    @staticmethod
    def extract_data(
        query: SecRssLitigationQueryParams,
        credentials: dict[str, str] | None,
        **kwargs: Any,
    ) -> list[dict]:
        """Return the raw data from the SEC endpoint."""
        # pylint: disable=import-outside-toplevel
        import re  # noqa
        import xmltodict
        from data_fetcher.utils.provider_helpers import make_request
        from pandas import DataFrame, to_datetime

        results: list = []
        url = "https://www.sec.gov/enforcement-litigation/litigation-releases/rss"
        r = make_request(url, headers=HEADERS)

        if r.status_code != 200:
            raise OpenBBError(f"Status code {r.status_code} returned.")

        def clean_xml(xml_content):
            """Clean the XML content before parsing."""
            xml_content = re.sub(r"&(?!amp;|lt;|gt;|quot;|apos;)", "&amp;", xml_content)
            return xml_content

        cleaned_content = clean_xml(r.text)
        data = xmltodict.parse(cleaned_content)
        cols = ["title", "link", "summary", "date", "id"]
        feed = DataFrame.from_records(data["rss"]["channel"]["item"])[
            ["title", "link", "description", "pubDate", "dc:creator"]
        ]
        feed.columns = cols
        feed["date"] = to_datetime(feed["date"], format="mixed")
        feed = feed.set_index("date")
        # Remove special characters
        for column in ["title", "summary"]:
            feed[column] = (
                feed[column]
                .replace(r"[^\w\s]|_", "", regex=True)
                .replace(r"\n", "", regex=True)
            )

        results = feed.reset_index().to_dict(orient="records")

        return results

    @staticmethod
    def transform_data(
        query: SecRssLitigationQueryParams, data: list[dict], **kwargs: Any
    ) -> list[SecRssLitigationData]:
        """Transform the data to the standard format."""
        return [SecRssLitigationData.model_validate(d) for d in data]

"""Standard Model: RSS Litigation (소송/제재 RSS 피드)."""
from datetime import datetime

from pydantic import Field

from data_fetcher.abstract_provider.abstract.data import BaseData
from data_fetcher.abstract_provider.abstract.query_params import BaseQueryParams


class RssLitigationQueryParams(BaseQueryParams):
    """소송 RSS 피드 표준 파라미터."""


class RssLitigationData(BaseData):
    """소송 RSS 피드 표준 데이터."""

    published: datetime = Field(description="The date of publication.")
    title: str = Field(description="The title of the release.")
    summary: str = Field(description="Short summary of the release.")
    id: str = Field(description="The identifier associated with the release.")
    link: str = Field(description="URL to the release.")

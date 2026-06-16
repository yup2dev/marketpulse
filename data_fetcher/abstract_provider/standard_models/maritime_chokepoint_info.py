"""Maritime chokepoint information and metadata."""

from data_fetcher.abstract_provider.abstract.data import BaseData
from data_fetcher.abstract_provider.abstract.query_params import BaseQueryParams
from pydantic import Field


class MaritimeChokePointInfoQueryParams(BaseQueryParams):
    """MaritimeChokepointInfo Query."""


class MaritimeChokePointInfoData(BaseData):
    """MaritimeChokepointInfo Data."""

    chokepoint_code: str = Field(
        description="Unique ID assigned to the chokepoint by the source."
    )

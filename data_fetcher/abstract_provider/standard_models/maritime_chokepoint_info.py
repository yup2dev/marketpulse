"""Maritime chokepoint information and metadata."""

from data_fetcher.abstract_provider.standard_models._base import Data
from data_fetcher.abstract_provider.standard_models._base import QueryParams
from pydantic import Field


class MaritimeChokePointInfoQueryParams(QueryParams):
    """MaritimeChokepointInfo Query."""


class MaritimeChokePointInfoData(Data):
    """MaritimeChokepointInfo Data."""

    chokepoint_code: str = Field(
        description="Unique ID assigned to the chokepoint by the source."
    )

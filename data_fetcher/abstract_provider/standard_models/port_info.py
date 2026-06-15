"""Port information and metadata."""

from data_fetcher.abstract_provider.standard_models._base import Data
from data_fetcher.abstract_provider.standard_models._base import QueryParams
from pydantic import Field


class PortInfoQueryParams(QueryParams):
    """Port Information Query."""


class PortInfoData(Data):
    """Port Information Data."""

    port_code: str = Field(description="Unique ID assigned to the port by the source.")

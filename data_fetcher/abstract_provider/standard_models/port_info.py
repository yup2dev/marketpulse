"""Port information and metadata."""

from data_fetcher.abstract_provider.abstract.data import BaseData
from data_fetcher.abstract_provider.abstract.query_params import BaseQueryParams
from pydantic import Field


class PortInfoQueryParams(BaseQueryParams):
    """Port Information Query."""


class PortInfoData(BaseData):
    """Port Information Data."""

    port_code: str = Field(description="Unique ID assigned to the port by the source.")

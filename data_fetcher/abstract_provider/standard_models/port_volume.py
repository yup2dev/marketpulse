"""Port Volume Standard Model."""

from datetime import date as dateType

from data_fetcher.abstract_provider.standard_models._base import Data
from data_fetcher.abstract_provider.standard_models._base import QueryParams
from data_fetcher.abstract_provider.field_descriptions import (
    DATA_DESCRIPTIONS,
    QUERY_DESCRIPTIONS,
)
from pydantic import Field


class PortVolumeQueryParams(QueryParams):
    """Port Volume Query."""

    start_date: dateType | None = Field(
        default=None, description=QUERY_DESCRIPTIONS.get("start_date", "")
    )
    end_date: dateType | None = Field(
        default=None, description=QUERY_DESCRIPTIONS.get("end_date", "")
    )


class PortVolumeData(Data):
    """Port Volume Data."""

    date: dateType = Field(description=DATA_DESCRIPTIONS.get("date", ""))
    port_code: str | None = Field(default=None, description="Port code.")
    port_name: str | None = Field(default=None, description="Port name.")
    country: str | None = Field(
        default=None, description="Country where the port is located."
    )

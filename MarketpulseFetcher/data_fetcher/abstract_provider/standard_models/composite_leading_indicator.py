"""Composite Leading Indicator Standard Model."""

from datetime import date as dateType

from data_fetcher.abstract_provider.abstract.data import BaseData
from data_fetcher.abstract_provider.abstract.query_params import BaseQueryParams
from data_fetcher.abstract_provider.field_descriptions import (
    DATA_DESCRIPTIONS,
    QUERY_DESCRIPTIONS,
)
from pydantic import Field


class CompositeLeadingIndicatorQueryParams(BaseQueryParams):
    """Composite Leading Indicator Query."""

    start_date: dateType | None = Field(
        default=None, description=QUERY_DESCRIPTIONS.get("start_date")
    )
    end_date: dateType | None = Field(
        default=None, description=QUERY_DESCRIPTIONS.get("end_date")
    )


class CompositeLeadingIndicatorData(BaseData):
    """Composite Leading Indicator Data."""

    date: dateType = Field(description=DATA_DESCRIPTIONS.get("date"))
    value: float = Field(
        default=None,
        description="CLI value",
        json_schema_extra={"x-unit_measurement": "index"},
    )
    country: str = Field(description="Country for the CLI value.")

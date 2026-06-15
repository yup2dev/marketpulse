"""Country Interest Rates Standard Model."""

from datetime import date as dateType

from data_fetcher.abstract_provider.standard_models._base import Data
from data_fetcher.abstract_provider.standard_models._base import QueryParams
from data_fetcher.abstract_provider.field_descriptions import (
    DATA_DESCRIPTIONS,
    QUERY_DESCRIPTIONS,
)
from pydantic import Field


class CountryInterestRatesQueryParams(QueryParams):
    """Country Interest Rates Query."""

    country: str = Field(
        default="united_states",
        description=QUERY_DESCRIPTIONS.get("country"),
    )
    start_date: dateType | None = Field(
        default=None, description=QUERY_DESCRIPTIONS.get("start_date")
    )
    end_date: dateType | None = Field(
        default=None, description=QUERY_DESCRIPTIONS.get("end_date")
    )


class CountryInterestRatesData(Data):
    """Country Interest Rates Data."""

    date: dateType = Field(default=None, description=DATA_DESCRIPTIONS.get("date"))
    value: float = Field(
        default=None,
        description="The interest rate value.",
        json_schema_extra={"x-unit_measurment": "percent", "x-frontend_multiply": 100},
    )
    country: str | None = Field(
        default=None,
        description="Country for which the interest rate is given.",
    )

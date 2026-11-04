"""Equity FTD Standard Model."""

from datetime import (
    date as dateType,
    datetime,
)

from data_fetcher.abstract_provider.abstract.data import BaseData
from data_fetcher.abstract_provider.abstract.query_params import BaseQueryParams
from data_fetcher.abstract_provider.field_descriptions import (
    DATA_DESCRIPTIONS,
    QUERY_DESCRIPTIONS,
)
from pydantic import Field, field_validator


class EquityFtdQueryParams(BaseQueryParams):
    """Equity FTD Query."""

    symbol: str = Field(description=QUERY_DESCRIPTIONS.get("symbol", ""))

    @field_validator("symbol", mode="before", check_fields=False)
    @classmethod
    def to_upper(cls, v: str):
        """Convert field to uppercase."""
        return v.upper()


class EquityFtdData(BaseData):
    """Equity FTD Data."""

    settlement_date: dateType | None = Field(
        description="The settlement date of the fail.", default=None
    )
    symbol: str | None = Field(
        description=DATA_DESCRIPTIONS.get("symbol", ""),
        default=None,
    )
    cusip: str | None = Field(
        description="CUSIP of the Security.",
        default=None,
    )
    quantity: int | None = Field(
        description="The number of fails on that settlement date.",
        default=None,
    )
    price: float | None = Field(
        description="The price at the previous closing price from the settlement date.",
        default=None,
    )
    description: str | None = Field(
        description="The description of the Security.",
        default=None,
    )

    @field_validator("settlement_date", mode="before")
    def date_validate(cls, v):  # pylint: disable=E0213
        """Return the date as a datetime object."""
        return datetime.strftime(v, "%Y-%m-%d")

"""House Price Index Standard Model."""

from datetime import date as dateType
from typing import Literal

from data_fetcher.abstract_provider.abstract.data import BaseData
from data_fetcher.abstract_provider.abstract.query_params import BaseQueryParams
from data_fetcher.abstract_provider.field_descriptions import (
    DATA_DESCRIPTIONS,
    QUERY_DESCRIPTIONS,
)
from pydantic import Field


class HousePriceIndexQueryParams(BaseQueryParams):
    """House Price Index Query."""

    country: str = Field(
        description=QUERY_DESCRIPTIONS.get("country", ""),
        default="united_states",
    )
    frequency: Literal["monthly", "quarter", "annual"] = Field(
        description=QUERY_DESCRIPTIONS.get("frequency", ""),
        default="quarter",
        json_schema_extra={"choices": ["monthly", "quarter", "annual"]},
    )
    transform: Literal["index", "yoy", "period"] = Field(
        description="Transformation of the CPI data. Period represents the change since previous."
        + " Defaults to change from one year ago (yoy).",
        default="index",
        json_schema_extra={"choices": ["index", "yoy", "period"]},
    )
    start_date: dateType | None = Field(
        default=None, description=QUERY_DESCRIPTIONS.get("start_date")
    )
    end_date: dateType | None = Field(
        default=None, description=QUERY_DESCRIPTIONS.get("end_date")
    )


class HousePriceIndexData(BaseData):
    """House Price Index Data."""

    date: dateType | None = Field(
        default=None, description=DATA_DESCRIPTIONS.get("date")
    )
    country: str | None = Field(
        default=None,
        description=DATA_DESCRIPTIONS.get("country", ""),
    )
    value: float | None = Field(
        default=None,
        description="Share price index value.",
    )

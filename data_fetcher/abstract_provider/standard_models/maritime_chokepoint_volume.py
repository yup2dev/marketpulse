"""Maritime chokepoint transit calls and trade volume estimates time series."""

from datetime import date as dateType

from data_fetcher.abstract_provider.standard_models._base import Data
from data_fetcher.abstract_provider.standard_models._base import QueryParams
from data_fetcher.abstract_provider.field_descriptions import (
    DATA_DESCRIPTIONS,
    QUERY_DESCRIPTIONS,
)
from pydantic import Field


class MaritimeChokePointVolumeQueryParams(QueryParams):
    """MaritimeChokepointVolume Query."""

    start_date: dateType | None = Field(
        default=None, description=QUERY_DESCRIPTIONS.get("start_date", "")
    )
    end_date: dateType | None = Field(
        default=None, description=QUERY_DESCRIPTIONS.get("end_date", "")
    )


class MaritimeChokePointVolumeData(Data):
    """MaritimeChokepointVolume Data."""

    date: dateType = Field(description=DATA_DESCRIPTIONS.get("date", ""))

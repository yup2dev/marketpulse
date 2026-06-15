"""Income Statement Growth Standard Model."""

from datetime import date as dateType

from data_fetcher.abstract_provider.standard_models._base import Data
from data_fetcher.abstract_provider.standard_models._base import QueryParams
from data_fetcher.abstract_provider.field_descriptions import QUERY_DESCRIPTIONS
from pydantic import Field, field_validator


class IncomeStatementGrowthQueryParams(QueryParams):
    """Income Statement Growth Query."""

    symbol: str = Field(description=QUERY_DESCRIPTIONS.get("symbol", ""))
    limit: int | None = Field(
        default=None, description=QUERY_DESCRIPTIONS.get("limit", "")
    )

    @field_validator("symbol", mode="before", check_fields=False)
    @classmethod
    def to_upper(cls, v: str) -> str:
        """Convert field to uppercase."""
        return v.upper()


class IncomeStatementGrowthData(Data):
    """Income Statement Growth Data."""

    period_ending: dateType = Field(description="The end date of the reporting period.")
    fiscal_period: str | None = Field(
        description="The fiscal period of the report.", default=None
    )
    fiscal_year: int | None = Field(
        description="The fiscal year of the fiscal period.", default=None
    )

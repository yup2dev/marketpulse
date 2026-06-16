"""Company Filings Standard Model."""

from datetime import (
    date as dateType,
)

from dateutil import parser
from data_fetcher.abstract_provider.abstract.data import BaseData
from data_fetcher.abstract_provider.abstract.query_params import BaseQueryParams
from data_fetcher.abstract_provider.field_descriptions import (
    QUERY_DESCRIPTIONS,
)
from pydantic import Field, field_validator


class CompanyFilingsQueryParams(BaseQueryParams):
    """Company Filings Query."""

    symbol: str | None = Field(
        default=None, description=QUERY_DESCRIPTIONS.get("symbol", "")
    )

    @field_validator("symbol", mode="before", check_fields=False)
    @classmethod
    def to_upper(cls, v: str | list[str] | set[str]):
        """Convert field to uppercase."""
        if isinstance(v, str):
            return v.upper()
        return ",".join([symbol.upper() for symbol in list(v)]) if v else None


class CompanyFilingsData(BaseData):
    """Company Filings Data."""

    filing_date: dateType = Field(description="The date of the filing.")
    report_type: str | None = Field(default=None, description="Type of filing.")
    report_url: str = Field(description="URL to the actual report.")

    @field_validator("filing_date", "accepted_date", mode="before", check_fields=False)
    @classmethod
    def convert_date(cls, v: str):
        """Convert date to date type."""
        return parser.parse(str(v)).date() if v else None

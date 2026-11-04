"""Latest Financial Reports Standard Model."""

from datetime import date as dateType

from data_fetcher.abstract_provider.abstract.data import BaseData
from data_fetcher.abstract_provider.abstract.query_params import BaseQueryParams
from data_fetcher.abstract_provider.field_descriptions import DATA_DESCRIPTIONS
from pydantic import Field


class LatestFinancialReportsQueryParams(BaseQueryParams):
    """Latest Financial Reports Query."""


class LatestFinancialReportsData(BaseData):
    """Latest Financial Reports Data."""

    filing_date: dateType = Field(description="The date of the filing.")
    period_ending: dateType | None = Field(
        default=None, description="Report for the period ending."
    )
    symbol: str | None = Field(
        default=None, description=DATA_DESCRIPTIONS.get("symbol")
    )
    name: str | None = Field(default=None, description="Name of the company.")
    cik: str | None = Field(default=None, description=DATA_DESCRIPTIONS.get("cik"))
    sic: str | None = Field(
        default=None, description="Standard Industrial Classification code."
    )
    report_type: str | None = Field(default=None, description="Type of filing.")
    description: str | None = Field(
        default=None, description="Description of the report."
    )
    url: str = Field(description="URL to the filing page.")

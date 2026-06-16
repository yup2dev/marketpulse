"""BLS Search Model."""

from data_fetcher.abstract_provider.abstract.data import BaseData
from data_fetcher.abstract_provider.abstract.query_params import BaseQueryParams
from data_fetcher.abstract_provider.field_descriptions import DATA_DESCRIPTIONS
from pydantic import Field


class SearchQueryParams(BaseQueryParams):
    """BLS Search Query Params."""

    query: str = Field(
        default="",
        description="The search word(s). Use semi-colon to separate multiple queries as an & operator.",
    )


class SearchData(BaseData):
    """BLS Search Data."""

    symbol: str = Field(description=DATA_DESCRIPTIONS.get("symbol", ""))
    title: str | None = Field(default=None, description="The title of the series.")
    survey_name: str | None = Field(default=None, description="The name of the survey.")

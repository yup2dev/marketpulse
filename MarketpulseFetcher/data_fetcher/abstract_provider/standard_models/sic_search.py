"""Standard Model: SIC Search (표준산업분류 코드 검색)."""
from pydantic import Field

from data_fetcher.abstract_provider.abstract.data import BaseData
from data_fetcher.abstract_provider.abstract.query_params import BaseQueryParams


class SicSearchQueryParams(BaseQueryParams):
    """SIC 검색 표준 파라미터."""

    query: str = Field(
        description="Search query to match against SIC code, industry title, or office."
    )
    use_cache: bool | None = Field(default=True, description="Whether or not to use cache.")


class SicSearchData(BaseData):
    """SIC 검색 표준 데이터."""

    sic: int = Field(description="Sector Industrial Code (SIC)")
    industry: str = Field(description="Industry title.")
    office: str = Field(description="Reporting office within the Corporate Finance Office")

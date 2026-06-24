"""Standard Model: Institutions Search (기관 검색)."""
from pydantic import Field

from data_fetcher.abstract_provider.abstract.data import BaseData
from data_fetcher.abstract_provider.abstract.query_params import BaseQueryParams


class InstitutionsSearchQueryParams(BaseQueryParams):
    """기관 검색 표준 파라미터."""

    query: str = Field(description="Search query.", default="")
    use_cache: bool | None = Field(default=True, description="Whether or not to use cache.")


class InstitutionsSearchData(BaseData):
    """기관 검색 표준 데이터."""

    name: str | None = Field(default=None, description="The name of the institution.")
    cik: str | int | None = Field(default=None, description="Central Index Key (CIK)")

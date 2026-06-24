"""Symbol Map Standard Model (CIK→symbol 등 식별자 매핑)."""

from data_fetcher.abstract_provider.abstract.data import BaseData
from data_fetcher.abstract_provider.abstract.query_params import BaseQueryParams
from data_fetcher.abstract_provider.field_descriptions import DATA_DESCRIPTIONS
from pydantic import Field


class SymbolMapQueryParams(BaseQueryParams):
    """Symbol Map Query."""

    query: str = Field(description="Search query.")
    use_cache: bool | None = Field(
        default=True,
        description="Whether or not to use cache. If True, cache will store for seven days.",
    )


class SymbolMapData(BaseData):
    """Symbol Map Data."""

    symbol: str = Field(description=DATA_DESCRIPTIONS.get("symbol", ""))

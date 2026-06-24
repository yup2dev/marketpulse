"""Standard Model: HTM File (HTML/HTM 원문 파일)."""
from pydantic import Field

from data_fetcher.abstract_provider.abstract.data import BaseData
from data_fetcher.abstract_provider.abstract.query_params import BaseQueryParams


class HtmFileQueryParams(BaseQueryParams):
    """HTM 파일 조회 표준 파라미터."""

    url: str = Field(default="", description="URL for the filing.")
    use_cache: bool = Field(default=True, description="Cache the file for use later. Default is True.")


class HtmFileData(BaseData):
    """HTM 파일 표준 데이터."""

    url: str = Field(
        description="URL of the downloaded file.",
        json_schema_extra={"x-widget_config": {"exclude": True}},
    )
    content: str = Field(description="Raw content of the HTM/HTML file.")

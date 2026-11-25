"""Company Relations Standard Model — 한 종목과 관계된 종목 (공급사 · 고객사 · 경쟁사 · 지분 등)."""
from typing import Optional

from pydantic import Field, field_validator

from data_fetcher.abstract_provider.abstract.data import BaseData
from data_fetcher.abstract_provider.abstract.query_params import BaseQueryParams


class CompanyRelationsQueryParams(BaseQueryParams):
    symbol: str = Field(description="종목 코드")

    @field_validator("symbol", mode="before")
    @classmethod
    def _upper(cls, v):
        return v.upper() if isinstance(v, str) else v


class CompanyRelationsData(BaseData):
    symbol: str = Field(description="관계 종목 코드")
    name: Optional[str] = Field(default=None, description="관계 종목명")
    relation_type: str = Field(description="관계 (supplier · customer · competitor …)")
    detail: Optional[str] = Field(default=None, description="설명")
    confidence: Optional[float] = Field(default=None, description="신뢰도 (0~1)")
    data_source: Optional[str] = Field(default=None, description="출처")

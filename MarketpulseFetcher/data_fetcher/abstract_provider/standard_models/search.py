"""Standard Model: Search (종목 검색)"""
from typing import Optional

from pydantic import Field

from data_fetcher.abstract_provider.abstract.data import BaseData
from data_fetcher.abstract_provider.abstract.query_params import BaseQueryParams


class SearchQueryParams(BaseQueryParams):
    """종목 검색 표준 파라미터"""

    query: str = Field(description="검색어 (회사명 또는 종목 코드)")
    limit: Optional[int] = Field(default=10, description="최대 결과 수")
    exchange: Optional[str] = Field(default=None, description="거래소 필터")


class SearchData(BaseData):
    """종목 검색 결과 표준 데이터"""

    symbol: str = Field(description="종목 코드")
    name: Optional[str] = Field(default=None, description="회사명")
    exchange: Optional[str] = Field(default=None, description="거래소")
    exchange_short_name: Optional[str] = Field(default=None, description="거래소 약칭")
    stock_type: Optional[str] = Field(default=None, description="유형 (stock, etf, fund 등)")
    currency: Optional[str] = Field(default=None, description="통화")

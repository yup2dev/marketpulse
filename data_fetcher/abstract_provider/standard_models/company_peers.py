"""Standard Model: Company Peers (유사·경쟁 종목)"""
from typing import Optional

from pydantic import Field

from data_fetcher.abstract_provider.abstract.data import BaseData
from data_fetcher.abstract_provider.abstract.query_params import BaseQueryParams


class CompanyPeersQueryParams(BaseQueryParams):
    """유사 종목 조회 표준 파라미터"""

    symbol: str = Field(description="기준 종목 코드")
    limit: int = Field(default=10, description="반환할 최대 종목 수")


class CompanyPeersData(BaseData):
    """유사 종목 표준 데이터"""

    symbol: str = Field(description="유사 종목 코드")
    name: Optional[str] = Field(default=None, description="종목명")
    sector: Optional[str] = Field(default=None, description="섹터")
    industry: Optional[str] = Field(default=None, description="산업")

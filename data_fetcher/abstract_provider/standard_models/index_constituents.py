"""Standard Model: Index Constituents (지수 구성종목)

S&P500/NASDAQ100/Dow30 등 지수 구성종목의 공통 인터페이스.
database/fmp 등 여러 provider가 이 클래스를 상속한다(멀티프로바이더).
"""
from typing import Optional

from pydantic import Field

from data_fetcher.abstract_provider.abstract.data import BaseData
from data_fetcher.abstract_provider.abstract.query_params import BaseQueryParams


class IndexConstituentsQueryParams(BaseQueryParams):
    """지수 구성종목 조회 표준 파라미터"""

    index: str = Field(description="지수 이름 ('sp500', 'nasdaq100', 'dow30')")


class IndexConstituentData(BaseData):
    """지수 구성종목 표준 데이터"""

    symbol: str = Field(description="종목 코드")
    name: str = Field(description="종목명")
    sector: Optional[str] = Field(default=None, description="섹터")
    sub_sector: Optional[str] = Field(default=None, description="하위 섹터")
    headquarters: Optional[str] = Field(default=None, description="본사 소재지")
    date_first_added: Optional[str] = Field(default=None, description="지수 편입일")
    cik: Optional[str] = Field(default=None, description="SEC CIK")
    founded: Optional[str] = Field(default=None, description="설립 연도")

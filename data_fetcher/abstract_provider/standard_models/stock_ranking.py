"""Standard Model: Stock Ranking (기간별 종목 등락 랭킹)

DB 시계열 기반 기간 랭킹(1d/1w/1mo/3mo/6mo/1y)의 공통 인터페이스.
"""
from typing import Optional

from pydantic import Field

from data_fetcher.abstract_provider.abstract.data import BaseData
from data_fetcher.abstract_provider.abstract.query_params import BaseQueryParams


class StockRankingQueryParams(BaseQueryParams):
    """종목 랭킹 조회 표준 파라미터"""

    period: str = Field(default="1d", description="1d | 1w | 1mo | 3mo | 6mo | 1y")


class StockRankingData(BaseData):
    """기간별 종목 랭킹 표준 데이터"""

    stk_cd: str = Field(description="종목 코드")
    stk_nm: Optional[str] = Field(default="", description="종목명")
    curr: Optional[str] = Field(default="USD", description="통화")
    sector: Optional[str] = Field(default="", description="섹터")
    close_price: Optional[float] = Field(default=None, description="종가")
    change_rate: Optional[float] = Field(default=None, description="기간 등락률 (%)")
    volume: int = Field(default=0, description="거래량")
    trade_value: float = Field(default=0.0, description="거래대금")

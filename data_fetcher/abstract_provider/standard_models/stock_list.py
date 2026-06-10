"""Standard Model: Stock List (종목 유니버스)

거래소/시장 단위 전 종목 리스트의 provider 무관 표준 스펙.
무료 universe provider(nasdaqtrader, krx)와 DB provider가 공통으로 상속한다.
"""
from typing import Optional

from pydantic import Field

from data_fetcher.abstract_provider.abstract.data import BaseData
from data_fetcher.abstract_provider.abstract.query_params import BaseQueryParams


class StockListQueryParams(BaseQueryParams):
    """종목 리스트 표준 파라미터"""

    market: Optional[str] = Field(
        default=None,
        description="시장/거래소 코드 (KOSPI, KOSDAQ, NYSE, NASDAQ, NYSE_ARCA ...)",
    )
    asset_class: str = Field(
        default="stock",
        description="자산 유형 ('stock' | 'etf')",
    )
    active_only: bool = Field(default=True, description="활성 종목만 반환")


class StockListData(BaseData):
    """종목 리스트 표준 데이터 (1 row = 1 종목)"""

    ticker_cd: str = Field(description="종목 코드")
    ticker_nm: str = Field(description="종목명")
    asset_type: str = Field(default="stock", description="자산 유형")
    exchange: Optional[str] = Field(default=None, description="상장 거래소")
    country: Optional[str] = Field(default=None, description="국가")
    curr: str = Field(default="USD", description="통화")
    sector: Optional[str] = Field(default=None, description="섹터")
    industry: Optional[str] = Field(default=None, description="산업")
    is_active: bool = Field(default=True, description="활성 여부")

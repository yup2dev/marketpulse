"""Standard Model: Market Movers (시장 상위/하위 종목)

gainers, losers, most_actives 공통 인터페이스.
"""
from typing import Optional

from pydantic import Field

from data_fetcher.abstract_provider.abstract.data import BaseData
from data_fetcher.abstract_provider.abstract.query_params import BaseQueryParams


class MarketMoversQueryParams(BaseQueryParams):
    """시장 상위/하위 종목 조회 표준 파라미터"""

    limit: Optional[int] = Field(default=20, description="최대 결과 수")


class MarketMoverData(BaseData):
    """시장 상위/하위 종목 표준 데이터"""

    symbol: str = Field(description="종목 코드")
    name: Optional[str] = Field(default=None, description="종목명")
    price: Optional[float] = Field(default=None, description="현재가")
    change: Optional[float] = Field(default=None, description="등락폭")
    change_percent: Optional[float] = Field(default=None, description="등락률 (%)")
    volume: Optional[int] = Field(default=None, description="거래량")
    market_cap: Optional[float] = Field(default=None, description="시가총액")
    exchange: Optional[str] = Field(default=None, description="거래소")

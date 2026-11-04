"""Standard Model: Order Book (호가 잔량 — 가격 레벨별 bid/ask)"""
from typing import List, Optional

from pydantic import BaseModel, Field

from data_fetcher.abstract_provider.abstract.data import BaseData
from data_fetcher.abstract_provider.abstract.query_params import BaseQueryParams


class OrderBookLevel(BaseModel):
    """호가 한 레벨"""

    price: float = Field(description="가격")
    size: int = Field(description="잔량")


class OrderBookQueryParams(BaseQueryParams):
    """호가 조회 표준 파라미터"""

    symbol: str = Field(description="종목 코드")
    depth: int = Field(default=15, ge=1, le=50, description="방향별 최대 레벨 수")


class OrderBookData(BaseData):
    """호가 표준 데이터 (1행 스냅샷)"""

    symbol: str = Field(description="종목 코드")
    bids: List[OrderBookLevel] = Field(default_factory=list, description="매수 호가 (가격 내림차순)")
    asks: List[OrderBookLevel] = Field(default_factory=list, description="매도 호가 (가격 오름차순)")
    best_bid: Optional[float] = Field(default=None, description="최우선 매수호가")
    best_ask: Optional[float] = Field(default=None, description="최우선 매도호가")
    source: Optional[str] = Field(default=None, description="산출 근거 (provider별)")

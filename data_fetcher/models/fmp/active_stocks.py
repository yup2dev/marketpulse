"""FMP Movers Models (Most Actives / Gainers / Losers 공용)."""
from typing import Optional

from data_fetcher.models.base import BaseQueryParams, BaseData


class FMPMoversQueryParams(BaseQueryParams):
    """시장 무버(most-actives/gainers/losers) 공용 쿼리 파라미터. 별도 인자 없음."""
    pass


class FMPActiveStockData(BaseData):
    """시장 무버 응답 데이터 (most-actives/gainers/losers 공용 스키마)."""
    symbol: str
    name: str
    change: Optional[float] = None
    price: Optional[float] = None
    change_percentage: Optional[str] = None

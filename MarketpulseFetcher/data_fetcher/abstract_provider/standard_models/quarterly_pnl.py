"""Standard Model: Quarterly P&L (분기 손익 추이)"""
from typing import Any, Dict, List, Optional

from pydantic import Field

from data_fetcher.abstract_provider.abstract.data import BaseData
from data_fetcher.abstract_provider.abstract.query_params import BaseQueryParams


class QuarterlyPnLPeriodData(BaseData):
    """분기 손익 단일 기간"""

    date: str = Field(description="분기 기준일")
    revenue: Optional[float] = Field(default=None, description="매출")
    cogs: Optional[float] = Field(default=None, description="매출원가")
    gross: Optional[float] = Field(default=None, description="매출총이익")
    op_income: Optional[float] = Field(default=None, description="영업이익")
    net: Optional[float] = Field(default=None, description="순이익")
    rd: Optional[float] = Field(default=None, description="연구개발비")
    sga: Optional[float] = Field(default=None, description="판매관리비")
    gross_margin: Optional[float] = Field(default=None, description="매출총이익률")
    op_margin: Optional[float] = Field(default=None, description="영업이익률")
    net_margin: Optional[float] = Field(default=None, description="순이익률")


class QuarterlyPnLQueryParams(BaseQueryParams):
    """분기 손익 조회 표준 파라미터"""

    symbol: str = Field(description="종목 코드")
    limit: int = Field(default=12, description="반환할 분기 수")


class QuarterlyPnLData(BaseData):
    """분기 P&L 통합 표준 데이터"""

    symbol: str = Field(description="종목 코드")
    history: List[QuarterlyPnLPeriodData] = Field(
        default_factory=list, description="분기별 손익 이력"
    )
    latest: Dict[str, Any] = Field(default_factory=dict, description="최신 분기 요약")
    yoy_revenue: Dict[str, float] = Field(default_factory=dict, description="전년동기 매출 비교")

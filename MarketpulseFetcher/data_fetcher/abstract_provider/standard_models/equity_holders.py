"""Standard Model: Equity Holders (종목 기관 보유 현황)

한 종목에 대한 기관 투자자 보유 요약/목록의 공통 인터페이스
(특정 기관의 13F 포트폴리오와는 다른 개념).
"""
from typing import Any, Dict, List, Optional

from pydantic import Field

from data_fetcher.abstract_provider.abstract.data import BaseData
from data_fetcher.abstract_provider.abstract.query_params import BaseQueryParams


class EquityHoldersQueryParams(BaseQueryParams):
    """종목 보유 현황 조회 표준 파라미터"""

    symbol: str = Field(description="종목 코드")


class InstitutionalHolderData(BaseData):
    """기관 투자자 보유 데이터 (단일 기관)"""

    name: str = Field(default="", description="기관명")
    shares: int = Field(default=0, description="보유 주식 수")
    value: float = Field(default=0.0, description="보유 가치")
    pct_held: float = Field(default=0.0, description="지분율 (%)")
    pct_change: float = Field(default=0.0, description="지분 변화율 (%)")
    date_reported: Optional[str] = Field(default=None, description="보고일")


class EquityHoldersData(BaseData):
    """종목 보유 현황 통합 표준 데이터"""

    symbol: str = Field(description="종목 코드")
    summary: Dict[str, Any] = Field(default_factory=dict, description="보유 요약 지표")
    institutional: List[InstitutionalHolderData] = Field(
        default_factory=list, description="기관 보유 목록"
    )

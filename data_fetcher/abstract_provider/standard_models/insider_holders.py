"""Standard Model: Insider Holders (내부자 보유 현황)

내부자별 보유 주식/직책 스냅샷의 공통 인터페이스 (거래 이벤트가 아닌 보유 상태).
"""
from datetime import date as date_type
from typing import Optional

from pydantic import Field

from data_fetcher.abstract_provider.abstract.data import BaseData
from data_fetcher.abstract_provider.abstract.query_params import BaseQueryParams


class InsiderHoldersQueryParams(BaseQueryParams):
    """내부자 보유 조회 표준 파라미터"""

    symbol: str = Field(description="종목 코드")


class InsiderHolderData(BaseData):
    """내부자 보유 표준 데이터"""

    symbol: str = Field(description="종목 코드")
    name: Optional[str] = Field(default=None, description="내부자 이름")
    position: Optional[str] = Field(default=None, description="직책")
    shares: Optional[int] = Field(default=None, description="보유 주식 수")
    value: Optional[float] = Field(default=None, description="보유 가치")
    latest_transaction_date: Optional[date_type] = Field(
        default=None, description="최근 거래일"
    )
    position_direct: Optional[int] = Field(default=None, description="직접 보유 주식 수")
    position_indirect: Optional[int] = Field(default=None, description="간접 보유 주식 수")

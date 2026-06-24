"""Standard Model: Company Calendar (회사 일정 — 실적/배당 이벤트)"""
from typing import Any, Dict, List, Optional

from pydantic import Field

from data_fetcher.abstract_provider.abstract.data import BaseData
from data_fetcher.abstract_provider.abstract.query_params import BaseQueryParams


class CompanyCalendarQueryParams(BaseQueryParams):
    """회사 일정 조회 표준 파라미터"""

    symbol: str = Field(description="종목 코드 (예: AAPL, MSFT)")
    start_date: Optional[str] = Field(default=None, description="시작일 필터 (YYYY-MM-DD)")
    end_date: Optional[str] = Field(default=None, description="종료일 필터 (YYYY-MM-DD)")


class CompanyCalendarData(BaseData):
    """회사 일정 표준 데이터"""

    symbol: str = Field(description="종목 코드")
    events: List[Dict[str, Any]] = Field(
        default_factory=list, description="이벤트 리스트 (earnings/ex_dividend/dividend_payment)"
    )
    upcoming_earnings: Dict[str, Any] = Field(
        default_factory=dict, description="다음 실적 발표 요약"
    )
    earnings_history: List[Dict[str, Any]] = Field(
        default_factory=list, description="과거 실적 이력"
    )
    dividend_info: Dict[str, Any] = Field(default_factory=dict, description="배당 정보")

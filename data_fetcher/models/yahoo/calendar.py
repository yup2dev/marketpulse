"""Yahoo Finance Calendar Model (회사 일정)"""
from typing import Optional, List, Dict, Any
from datetime import date
from pydantic import Field
from data_fetcher.models.base import BaseQueryParams, BaseData


class YFinanceCalendarQueryParams(BaseQueryParams):
    """회사 일정 조회 파라미터"""

    symbol: str = Field(description="종목 코드 (예: AAPL, MSFT)")
    start_date: Optional[str] = Field(default=None, description="시작일 필터 (YYYY-MM-DD)")
    end_date: Optional[str] = Field(default=None, description="종료일 필터 (YYYY-MM-DD)")


class YFinanceCalendarData(BaseData):
    """회사 일정 전체 데이터"""

    symbol: str = Field(description="종목 코드")

    # 이벤트 리스트 (earnings, ex_dividend, dividend_payment)
    events: List[Dict[str, Any]] = Field(default_factory=list)

    # 다음 실적 발표 요약
    upcoming_earnings: Dict[str, Any] = Field(default_factory=dict)

    # 과거 실적 이력 (최근 12분기)
    earnings_history: List[Dict[str, Any]] = Field(default_factory=list)

    # 배당 정보
    dividend_info: Dict[str, Any] = Field(default_factory=dict)

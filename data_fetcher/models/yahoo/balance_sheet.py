"""Yahoo Finance Balance Sheet Model"""
from typing import Optional
from pydantic import Field
from data_fetcher.models.base import BaseQueryParams, BaseData


class YFinanceBalanceSheetQueryParams(BaseQueryParams):
    symbol: str = Field(description="종목 코드 (예: AAPL)")
    period: str = Field(default="annual", description="'annual' 또는 'quarter'")
    limit: int = Field(default=5, ge=1, le=5, description="반환할 기간 수 (최대 5)")


class YFinanceBalanceSheetData(BaseData):
    """재무상태표 데이터 — extra='allow' 이므로 모든 동적 필드 수용"""
    date: str = Field(description="기준일 (YYYY-MM-DD)")

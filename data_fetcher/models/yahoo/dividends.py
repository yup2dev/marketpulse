"""Yahoo Finance Dividends Model (배당 데이터)"""
from datetime import date as date_type
from typing import Optional
from pydantic import Field
from data_fetcher.models.base import BaseQueryParams, BaseData


class DividendsQueryParams(BaseQueryParams):
    """배당 데이터 조회 파라미터"""

    symbol: str = Field(
        description="종목 코드 (예: AAPL, MSFT)"
    )
    start_date: Optional[str] = Field(
        default=None,
        description="조회 시작일 (YYYY-MM-DD)"
    )
    end_date: Optional[str] = Field(
        default=None,
        description="조회 종료일 (YYYY-MM-DD)"
    )


class DividendData(BaseData):
    """배당 데이터"""

    symbol: str = Field(description="종목 코드")
    date: date_type = Field(description="배당 지급일")
    dividend: float = Field(description="주당 배당금 (USD)")

    # 계산 필드
    dividend_yield: Optional[float] = Field(
        default=None,
        description="배당 수익률 (%) - 해당 시점 주가 기준"
    )
    yoy_growth: Optional[float] = Field(
        default=None,
        description="전년 대비 배당 성장률 (%)"
    )

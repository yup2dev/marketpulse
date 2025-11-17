"""Interest Rate Standard Model (금리)"""
from datetime import date as date_type, datetime, timedelta
from typing import Optional
from pydantic import Field
from data_fetcher.models.base import BaseQueryParams, BaseData


class InterestRateQueryParams(BaseQueryParams):
    """금리 조회 파라미터"""

    rate_type: str = Field(
        description="금리 유형 (federal_funds, treasury_3m, treasury_6m, treasury_1y, treasury_5y, treasury_10y, treasury_30y, prime_lending)"
    )
    start_date: Optional[date_type] = Field(
        default_factory=lambda: (datetime.now().date() - timedelta(days=365)),
        description="시작일 (기본값: 1년 전)"
    )
    end_date: Optional[date_type] = Field(
        default_factory=lambda: datetime.now().date(),
        description="종료일 (기본값: 오늘)"
    )


class InterestRateData(BaseData):
    """금리 데이터"""

    date: date_type = Field(
        description="날짜"
    )
    rate: float = Field(
        description="금리 (%)"
    )
    rate_type: str = Field(
        description="금리 유형"
    )
    change_day: Optional[float] = Field(
        default=None,
        description="전일 대비 변화 (베이시스 포인트)"
    )
    change_week: Optional[float] = Field(
        default=None,
        description="전주 대비 변화"
    )
    change_month: Optional[float] = Field(
        default=None,
        description="전월 대비 변화"
    )

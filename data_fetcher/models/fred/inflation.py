"""Inflation Rate Standard Model (인플레이션율)"""
from datetime import date as date_type, datetime, timedelta
from typing import Optional
from pydantic import Field
from data_fetcher.models.base import BaseQueryParams, BaseData


class InflationRateQueryParams(BaseQueryParams):
    """인플레이션율 조회 파라미터"""

    country: str = Field(
        default="US",
        description="국가 코드"
    )
    inflation_type: str = Field(
        default="cpi",
        description="인플레이션 유형 (cpi, pce, ppi, core_cpi, core_pce)"
    )
    start_date: Optional[date_type] = Field(
        default_factory=lambda: (datetime.now().date() - timedelta(days=365)),
        description="시작일 (기본값: 1년 전)"
    )
    end_date: Optional[date_type] = Field(
        default_factory=lambda: datetime.now().date(),
        description="종료일 (기본값: 오늘)"
    )


class InflationRateData(BaseData):
    """인플레이션율 데이터"""

    date: date_type = Field(
        description="날짜"
    )
    rate: float = Field(
        description="인플레이션율 (%)"
    )
    inflation_type: str = Field(
        description="인플레이션 유형"
    )
    country: Optional[str] = Field(
        default=None,
        description="국가 코드"
    )
    month_over_month: Optional[float] = Field(
        default=None,
        description="전월 대비 (%)"
    )
    year_over_year: Optional[float] = Field(
        default=None,
        description="전년 대비 (%)"
    )

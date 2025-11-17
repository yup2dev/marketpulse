"""Non-Farm Payroll (비농업 취업자) Standard Model"""
from datetime import date as date_type, datetime, timedelta
from typing import Optional
from pydantic import Field
from data_fetcher.models.base import BaseQueryParams, BaseData


class NonfarmPayrollQueryParams(BaseQueryParams):
    """비농업 취업자 조회 파라미터"""

    country: str = Field(
        default="US",
        description="국가 코드 (US만 지원)"
    )
    start_date: Optional[date_type] = Field(
        default_factory=lambda: (datetime.now().date() - timedelta(days=365*5)),
        description="시작일 (기본값: 5년 전)"
    )
    end_date: Optional[date_type] = Field(
        default_factory=lambda: datetime.now().date(),
        description="종료일 (기본값: 오늘)"
    )
    frequency: str = Field(
        default="monthly",
        description="데이터 빈도 (monthly)"
    )
    sector: str = Field(
        default="total",
        description="업종 (total, manufacturing, service, government)"
    )


class NonfarmPayrollData(BaseData):
    """비농업 취업자 데이터 모델"""

    date: date_type = Field(
        description="데이터 날짜"
    )
    value: float = Field(
        description="취업자 수"
    )
    country: Optional[str] = Field(
        default="US",
        description="국가 코드"
    )
    sector: Optional[str] = Field(
        default="total",
        description="업종"
    )
    unit: Optional[str] = Field(
        default="Thousands of Persons",
        description="단위"
    )
    month_over_month_change: Optional[float] = Field(
        default=None,
        description="월간 변화 (천 명)"
    )
    unemployment_rate: Optional[float] = Field(
        default=None,
        description="실업률 (%)"
    )
    average_hourly_earnings: Optional[float] = Field(
        default=None,
        description="시간당 평균 임금 (달러)"
    )
    is_revised: Optional[bool] = Field(
        default=False,
        description="수정된 데이터 여부"
    )

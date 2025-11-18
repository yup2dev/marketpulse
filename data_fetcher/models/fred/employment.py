"""Employment Data Standard Model (고용 데이터)"""
from datetime import date as date_type, datetime, timedelta
from typing import Optional
from pydantic import Field
from data_fetcher.models.base import BaseQueryParams, BaseData


class EmploymentQueryParams(BaseQueryParams):
    """고용 데이터 조회 파라미터"""

    country: str = Field(
        default="US",
        description="국가 코드"
    )
    employment_type: str = Field(
        default="nonfarm_payroll",
        description="고용 유형 (nonfarm_payroll, civilian_employment, labor_force)"
    )
    start_date: Optional[date_type] = Field(
        default=None,
        description="시작일 (None이면 사용 가능한 모든 데이터)"
    )
    end_date: Optional[date_type] = Field(
        default=None,
        description="종료일 (None이면 최신 데이터까지)"
    )


class EmploymentData(BaseData):
    """고용 데이터"""

    date: date_type = Field(
        description="날짜"
    )
    value: int = Field(
        description="고용 수 (천 단위)"
    )
    employment_type: str = Field(
        description="고용 유형"
    )
    country: Optional[str] = Field(
        default=None,
        description="국가 코드"
    )
    change_month: Optional[int] = Field(
        default=None,
        description="전월 대비 변화 (천 단위)"
    )
    change_month_percent: Optional[float] = Field(
        default=None,
        description="전월 대비 변화율 (%)"
    )
    change_year: Optional[int] = Field(
        default=None,
        description="전년 대비 변화 (천 단위)"
    )

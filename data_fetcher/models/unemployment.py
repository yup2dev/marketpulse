"""Unemployment Rate Standard Model"""
from datetime import date as date_type
from typing import Optional
from pydantic import Field
from app.models.standard_models.base import BaseQueryParams, BaseData


class UnemploymentQueryParams(BaseQueryParams):
    """실업률 조회 파라미터"""

    country: str = Field(
        default="US",
        description="국가 코드"
    )
    start_date: Optional[date_type] = Field(
        default=None,
        description="시작일"
    )
    end_date: Optional[date_type] = Field(
        default=None,
        description="종료일"
    )
    age_group: Optional[str] = Field(
        default="all",
        description="연령대 (all, 16-19, 20-24, 25-54, 55+)"
    )


class UnemploymentData(BaseData):
    """실업률 데이터"""

    date: date_type = Field(
        description="데이터 날짜"
    )
    value: float = Field(
        description="실업률 (%)"
    )
    country: Optional[str] = Field(
        default=None,
        description="국가 코드"
    )
    labor_force: Optional[int] = Field(
        default=None,
        description="노동인구 (명)"
    )
    employed: Optional[int] = Field(
        default=None,
        description="취업자 수 (명)"
    )
    unemployed: Optional[int] = Field(
        default=None,
        description="실업자 수 (명)"
    )
    participation_rate: Optional[float] = Field(
        default=None,
        description="경제활동참가율 (%)"
    )

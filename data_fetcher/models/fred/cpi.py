"""Consumer Price Index (CPI) Standard Model"""
from datetime import date as date_type, datetime, timedelta
from typing import Optional
from pydantic import Field
from data_fetcher.models.base import BaseQueryParams, BaseData


class CPIQueryParams(BaseQueryParams):
    """CPI 조회 파라미터"""

    country: str = Field(
        default="US",
        description="국가 코드"
    )
    start_date: Optional[date_type] = Field(
        default_factory=lambda: (datetime.now().date() - timedelta(days=365)),
        description="시작일 (기본값: 1년 전)"
    )
    end_date: Optional[date_type] = Field(
        default_factory=lambda: datetime.now().date(),
        description="종료일 (기본값: 오늘)"
    )
    frequency: str = Field(
        default="monthly",
        description="데이터 빈도 (monthly, quarterly, annual)"
    )


class CPIData(BaseData):
    """소비자물가지수 데이터"""

    date: date_type = Field(
        description="데이터 날짜"
    )
    value: float = Field(
        description="CPI 지수 값"
    )
    country: Optional[str] = Field(
        default=None,
        description="국가 코드"
    )
    category: Optional[str] = Field(
        default="All Items",
        description="CPI 카테고리"
    )
    change_month: Optional[float] = Field(
        default=None,
        description="전월 대비 변화율 (%)"
    )
    change_year: Optional[float] = Field(
        default=None,
        description="전년 대비 변화율 (%)"
    )


class CoreCPIData(CPIData):
    """핵심 CPI 데이터 (식품 및 에너지 제외)"""

    is_core: bool = Field(
        default=True,
        description="핵심 CPI 여부"
    )
    excluded_items: str = Field(
        default="Food and Energy",
        description="제외 항목"
    )

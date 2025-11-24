"""Industrial Production Index (산업 생산 지수) Standard Model"""
from datetime import date as date_type, datetime, timedelta
from typing import Optional
from pydantic import Field
from data_fetcher.models.base import BaseQueryParams, BaseData


class IndustrialProductionQueryParams(BaseQueryParams):
    """산업 생산 지수 조회 파라미터"""

    country: str = Field(
        default="US",
        description="국가 코드 (US만 지원)"
    )
    start_date: Optional[date_type] = Field(
        default_factory=lambda: (datetime.now().date() - timedelta(days=365*5)),
        description="시작일 (기본값: 5년 전)"
    )
    end_date: Optional[date_type] = Field(
        default=None,
        description="종료일 (None이면 최신 데이터까지)"
    )
    frequency: str = Field(
        default="monthly",
        description="데이터 빈도 (monthly, annual)"
    )
    category: str = Field(
        default="total",
        description="카테고리 (total, manufacturing, mining, utilities)"
    )


class IndustrialProductionData(BaseData):
    """산업 생산 지수 데이터 모델"""

    date: date_type = Field(
        description="데이터 날짜"
    )
    value: float = Field(
        description="산업 생산 지수 (2012년=100)"
    )
    country: Optional[str] = Field(
        default="US",
        description="국가 코드"
    )
    category: Optional[str] = Field(
        default="total",
        description="카테고리"
    )
    unit: Optional[str] = Field(
        default="Index (2012=100)",
        description="단위"
    )
    growth_rate: Optional[float] = Field(
        default=None,
        description="월간/연간 성장률 (%)"
    )
    previous_value: Optional[float] = Field(
        default=None,
        description="이전 기간 값"
    )

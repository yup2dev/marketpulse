"""Housing Starts (주택 건설 착공) Standard Model"""
from datetime import date as date_type, datetime, timedelta
from typing import Optional
from pydantic import Field
from data_fetcher.models.base import BaseQueryParams, BaseData


class HousingStartsQueryParams(BaseQueryParams):
    """주택 건설 착공 조회 파라미터"""

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
    unit: str = Field(
        default="thousands",
        description="단위 (thousands, millions)"
    )


class HousingStartsData(BaseData):
    """주택 건설 착공 데이터 모델"""

    date: date_type = Field(
        description="데이터 날짜"
    )
    value: float = Field(
        description="주택 건설 착공 수"
    )
    country: Optional[str] = Field(
        default="US",
        description="국가 코드"
    )
    unit: Optional[str] = Field(
        default="Thousands of Units",
        description="단위"
    )
    month_over_month_change: Optional[float] = Field(
        default=None,
        description="월간 변화율 (%)"
    )
    year_over_year_change: Optional[float] = Field(
        default=None,
        description="전년도 대비 변화율 (%)"
    )
    permits: Optional[float] = Field(
        default=None,
        description="건축 허가 수 (단위: 천 호)"
    )

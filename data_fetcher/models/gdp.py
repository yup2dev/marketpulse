"""GDP (Gross Domestic Product) Standard Model"""
from datetime import date as date_type
from typing import Optional
from pydantic import Field
from app.models.standard_models.base import BaseQueryParams, BaseData


class GDPQueryParams(BaseQueryParams):
    """GDP 조회 파라미터"""

    country: str = Field(
        default="US",
        description="국가 코드 (US, KR, CN 등)"
    )
    start_date: Optional[date_type] = Field(
        default=None,
        description="시작일"
    )
    end_date: Optional[date_type] = Field(
        default=None,
        description="종료일"
    )
    frequency: str = Field(
        default="quarterly",
        description="데이터 빈도 (annual, quarterly)"
    )


class GDPData(BaseData):
    """GDP 데이터 모델"""

    date: date_type = Field(
        description="데이터 날짜"
    )
    value: float = Field(
        description="GDP 값 (단위: 십억 달러 또는 현지 통화)"
    )
    country: Optional[str] = Field(
        default=None,
        description="국가 코드"
    )
    unit: Optional[str] = Field(
        default="Billions of Dollars",
        description="단위"
    )
    growth_rate: Optional[float] = Field(
        default=None,
        description="GDP 성장률 (%)"
    )


class GDPRealData(GDPData):
    """실질 GDP 데이터 (인플레이션 조정)"""

    is_real: bool = Field(
        default=True,
        description="실질 GDP 여부"
    )
    base_year: Optional[int] = Field(
        default=None,
        description="기준년도"
    )


class GDPNominalData(GDPData):
    """명목 GDP 데이터 (인플레이션 미조정)"""

    is_real: bool = Field(
        default=False,
        description="실질 GDP 여부"
    )


class GDPPerCapitaData(BaseData):
    """1인당 GDP 데이터"""

    date: date_type = Field(
        description="데이터 날짜"
    )
    value: float = Field(
        description="1인당 GDP"
    )
    country: Optional[str] = Field(
        default=None,
        description="국가 코드"
    )
    population: Optional[int] = Field(
        default=None,
        description="인구 수"
    )

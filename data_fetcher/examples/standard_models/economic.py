"""
Standard Economic Indicator Models

Defines standard interfaces for economic data that all providers must follow.
"""
from datetime import date
from typing import Optional
from pydantic import BaseModel, Field


# ==================== Base Classes ====================

class EconomicQueryParams(BaseModel):
    """경제 지표 조회 기본 파라미터"""
    country: str = Field("US", description="Country code")
    start_date: Optional[date] = Field(None, description="Start date")
    end_date: Optional[date] = Field(None, description="End date")


class EconomicData(BaseModel):
    """경제 지표 데이터 기본 모델"""
    date: date
    value: float
    country: str = Field("US", description="Country code")
    unit: Optional[str] = Field(None, description="Unit of measurement")


# ==================== GDP ====================

class GDPQueryParams(EconomicQueryParams):
    """
    GDP 조회 파라미터 (표준)

    모든 GDP provider는 최소한 이 파라미터들을 지원해야 함
    """
    frequency: str = Field("quarterly", description="Data frequency (annual, quarterly)")


class GDPData(EconomicData):
    """
    GDP 데이터 (표준)

    모든 GDP provider는 최소한 이 필드들을 제공해야 함
    """
    growth_rate: Optional[float] = Field(None, description="Growth rate (%)")


# ==================== CPI ====================

class CPIQueryParams(EconomicQueryParams):
    """
    CPI 조회 파라미터 (표준)
    """
    category: str = Field("all", description="CPI category (all, core, energy, food)")


class CPIData(EconomicData):
    """
    CPI 데이터 (표준)
    """
    inflation_rate: Optional[float] = Field(None, description="Year-over-year inflation rate (%)")
    month_over_month_change: Optional[float] = Field(None, description="Month-over-month change (%)")


# ==================== Unemployment ====================

class UnemploymentQueryParams(EconomicQueryParams):
    """
    실업률 조회 파라미터 (표준)
    """
    pass


class UnemploymentData(EconomicData):
    """
    실업률 데이터 (표준)
    """
    labor_force: Optional[int] = Field(None, description="Labor force size")
    unemployed: Optional[int] = Field(None, description="Number of unemployed")


# ==================== Interest Rate ====================

class InterestRateQueryParams(EconomicQueryParams):
    """
    금리 조회 파라미터 (표준)
    """
    rate_type: str = Field("federal_funds", description="Interest rate type")


class InterestRateData(EconomicData):
    """
    금리 데이터 (표준)
    """
    rate_type: str
    change: Optional[float] = Field(None, description="Change from previous period")


# ==================== Employment ====================

class EmploymentQueryParams(EconomicQueryParams):
    """
    고용 지표 조회 파라미터 (표준)
    """
    category: str = Field("total", description="Employment category")


class EmploymentData(EconomicData):
    """
    고용 지표 데이터 (표준)
    """
    category: str
    change: Optional[float] = Field(None, description="Change from previous period")

"""Polygon.io Earnings Model"""
from datetime import date, datetime
from typing import Optional
from pydantic import Field
from data_fetcher.models.base import BaseQueryParams, BaseData


class EarningsQueryParams(BaseQueryParams):
    """실적 발표 조회 파라미터"""

    ticker: str = Field(
        description="종목 티커 (예: AAPL, TSLA)"
    )
    fiscal_year: Optional[int] = Field(
        default=None,
        description="회계연도"
    )
    fiscal_quarter: Optional[int] = Field(
        default=None,
        description="회계분기 (1-4)"
    )
    limit: Optional[int] = Field(
        default=100,
        description="최대 결과 수"
    )


class EarningsData(BaseData):
    """실적 발표 데이터"""

    ticker: str = Field(
        description="종목 티커"
    )

    # === 기간 정보 ===
    fiscal_period: str = Field(
        description="회계기간 (Q1, Q2, Q3, Q4, FY)"
    )
    fiscal_year: int = Field(
        description="회계연도"
    )
    fiscal_quarter: Optional[int] = Field(
        default=None,
        description="회계분기"
    )

    # === 날짜 정보 ===
    report_date: Optional[date] = Field(
        default=None,
        description="실적 발표일"
    )
    period_end_date: Optional[date] = Field(
        default=None,
        description="회계기간 종료일"
    )

    # === 주당 순이익 (EPS) ===
    eps_actual: Optional[float] = Field(
        default=None,
        description="실제 EPS"
    )
    eps_estimated: Optional[float] = Field(
        default=None,
        description="예상 EPS (컨센서스)"
    )
    eps_surprise: Optional[float] = Field(
        default=None,
        description="EPS 서프라이즈 (실제 - 예상)"
    )
    eps_surprise_percent: Optional[float] = Field(
        default=None,
        description="EPS 서프라이즈 비율 (%)"
    )

    # === 매출 (Revenue) ===
    revenue_actual: Optional[float] = Field(
        default=None,
        description="실제 매출"
    )
    revenue_estimated: Optional[float] = Field(
        default=None,
        description="예상 매출 (컨센서스)"
    )
    revenue_surprise: Optional[float] = Field(
        default=None,
        description="매출 서프라이즈 (실제 - 예상)"
    )
    revenue_surprise_percent: Optional[float] = Field(
        default=None,
        description="매출 서프라이즈 비율 (%)"
    )

    # === 재무 지표 ===
    net_income: Optional[float] = Field(
        default=None,
        description="순이익"
    )
    operating_income: Optional[float] = Field(
        default=None,
        description="영업이익"
    )
    gross_profit: Optional[float] = Field(
        default=None,
        description="매출총이익"
    )
    ebitda: Optional[float] = Field(
        default=None,
        description="EBITDA (세전영업이익)"
    )

    # === 성장률 (YoY) ===
    revenue_growth_yoy: Optional[float] = Field(
        default=None,
        description="전년 동기 대비 매출 성장률 (%)"
    )
    earnings_growth_yoy: Optional[float] = Field(
        default=None,
        description="전년 동기 대비 순이익 성장률 (%)"
    )

    # === 기타 지표 ===
    shares_outstanding: Optional[float] = Field(
        default=None,
        description="발행주식 수"
    )
    weighted_average_shares: Optional[float] = Field(
        default=None,
        description="가중평균 발행주식 수"
    )

    # === 컨퍼런스 콜 정보 ===
    conference_call_datetime: Optional[datetime] = Field(
        default=None,
        description="실적 컨퍼런스 콜 시간"
    )

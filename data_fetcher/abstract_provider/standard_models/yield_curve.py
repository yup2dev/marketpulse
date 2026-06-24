"""Standard Model: Yield Curve (국채 수익률 곡선)

수익률 곡선 데이터의 공통 인터페이스. 두 가지 형태를 함께 정의한다.
- YieldCurveData: 스냅샷 (1행 = 1만기)
- YieldCurveHistoryData: 시계열 (1행 = 1일자, 만기별 컬럼)
"""
from datetime import date as date_type
from typing import Optional

from pydantic import Field

from data_fetcher.abstract_provider.abstract.data import BaseData
from data_fetcher.abstract_provider.abstract.query_params import BaseQueryParams


class YieldCurveQueryParams(BaseQueryParams):
    """수익률 곡선 조회 표준 파라미터."""

    start_date: Optional[date_type] = Field(default=None, description="시작일")
    end_date: Optional[date_type] = Field(default=None, description="종료일")


class YieldCurveData(BaseData):
    """수익률 곡선 스냅샷 — 1행 = 1만기."""

    maturity: str = Field(description="만기 라벨 (예: '10-Year')")
    years: float = Field(description="만기 연수")
    value: Optional[float] = Field(default=None, description="수익률 (%)")


class YieldCurveHistoryData(BaseData):
    """수익률 곡선 시계열 — 1행 = 1일자 (만기별 컬럼)."""

    date: str = Field(description="날짜 (YYYY-MM-DD)")
    m3: Optional[float] = Field(default=None, description="3개월 수익률 (%)")
    m6: Optional[float] = Field(default=None, description="6개월 수익률 (%)")
    y1: Optional[float] = Field(default=None, description="1년 수익률 (%)")
    y2: Optional[float] = Field(default=None, description="2년 수익률 (%)")
    y5: Optional[float] = Field(default=None, description="5년 수익률 (%)")
    y10: Optional[float] = Field(default=None, description="10년 수익률 (%)")
    y30: Optional[float] = Field(default=None, description="30년 수익률 (%)")

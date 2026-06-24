"""Standard Model: Indicator Dashboard (지표 대시보드 스냅샷)

여러 지표를 '섹션 + 지표명 + 값' 행으로 모은 대시보드 스냅샷의 공통 인터페이스.
financial_conditions / labor_dashboard / sentiment_composite 등 여러 대시보드 fetcher가
이 클래스를 상속한다. 특정 대시보드 전용 컬럼은 상속 후 추가한다.
"""
from typing import Optional

from pydantic import Field

from data_fetcher.abstract_provider.abstract.data import BaseData
from data_fetcher.abstract_provider.abstract.query_params import BaseQueryParams


class IndicatorDashboardQueryParams(BaseQueryParams):
    """지표 대시보드 조회 표준 파라미터 (스냅샷이라 별도 파라미터 없음)."""


class IndicatorDashboardData(BaseData):
    """대시보드 단일 행 — 섹션별 지표 1건.

    공통 컬럼(section/metric/value/unit/status)만 정의한다.
    percentile·score 등 대시보드 전용 컬럼은 상속 후 추가한다.
    """

    section: str = Field(description="대시보드 섹션")
    metric: str = Field(description="지표명")
    value: Optional[float] = Field(default=None, description="현재값")
    unit: Optional[str] = Field(default="", description="단위")
    status: Optional[str] = Field(default=None, description="상태 레이블")

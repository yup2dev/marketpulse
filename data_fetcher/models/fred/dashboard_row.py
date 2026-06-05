"""Shared snapshot/dashboard row model — section + metric + value."""
from typing import Optional
from pydantic import Field
from data_fetcher.models.base import BaseData, BaseQueryParams


class DashboardQueryParams(BaseQueryParams):
    """파라미터 없는 현재 스냅샷 요청."""
    pass


class DashboardRowData(BaseData):
    """대시보드 테이블 한 행 — section·metric·value 구조."""
    section: str = Field(description="그룹 레이블 (예: 'Credit Spreads')")
    metric: str = Field(description="지표 이름 (예: 'High Yield OAS')")
    value: Optional[float] = Field(None, description="현재값")
    unit: Optional[str] = Field(None, description="단위 (%, bps, /100 등)")
    status: Optional[str] = Field(None, description="상태 레이블 (tight, greed 등)")
    score: Optional[float] = Field(None, description="정규화 점수 (0-100)")
    percentile: Optional[float] = Field(None, description="역사적 백분위")

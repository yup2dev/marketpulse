"""Standard Model: KOSIS Series (통계청 국가통계포털 통계표 시계열)

KOSIS 통계표 하나에서 항목(ITM) × 분류(C1~C3) × 시점 값을 꺼내는 공통 입출력 인터페이스.
모든 KOSIS fetcher 가 이 클래스를 상속한다 — 지표별 fetcher(광공업생산지수 · 가동률 · 수출 …)는
통계표 코드를 안에 고정하고 category 로 고르게 하며, 범용 series 만 통계표 코드를 직접 받는다.
통계표·항목·분류 코드는 KOSIS 통계표 화면의 'OpenAPI' 버튼 또는 통계목록 API 로 찾는다.
"""
from datetime import date as date_type
from typing import Optional

from pydantic import Field

from data_fetcher.abstract_provider.abstract.data import BaseData
from data_fetcher.abstract_provider.abstract.query_params import BaseQueryParams


class KosisSeriesQueryParams(BaseQueryParams):
    """KOSIS 통계표 시계열 조회 표준 파라미터"""

    org_id: Optional[str] = Field(default=None, description="기관 ID (예: 101 통계청)")
    tbl_id: Optional[str] = Field(default=None, description="통계표 ID (예: DT_1F02001)")
    prd_se: str = Field(default="M", description="수록주기 (M 월, Q 분기, Y 연)")
    start_date: Optional[date_type] = Field(default=None, description="시작일")
    end_date: Optional[date_type] = Field(default=None, description="종료일")


class KosisSeriesData(BaseData):
    """KOSIS 통계표 시계열 표준 데이터 — 시점 × 항목 × 분류 한 칸."""

    date: date_type = Field(description="수록시점 (기간 시작일)")
    value: Optional[float] = Field(default=None, description="수치값")
    item_id: Optional[str] = Field(default=None, description="항목 ID")
    item_name: Optional[str] = Field(default=None, description="항목명")
    category_id: Optional[str] = Field(default=None, description="분류 코드")
    category_name: Optional[str] = Field(default=None, description="분류 이름")
    unit: Optional[str] = Field(default=None, description="단위")
    yoy: Optional[float] = Field(default=None, description="전년 같은 기간 대비 증감률 (%)")
    mom: Optional[float] = Field(default=None, description="직전 기간 대비 증감률 (%)")

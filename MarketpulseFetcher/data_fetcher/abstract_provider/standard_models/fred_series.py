"""Standard Model: FRED Series (경제 지표 시계열)

모든 FRED fetcher의 공통 입출력 인터페이스.
특정 지표별 fetcher는 이 클래스를 상속해 전용 필드를 추가합니다.
"""
from datetime import date as date_type
from typing import Optional

from pydantic import Field

from data_fetcher.abstract_provider.abstract.data import BaseData
from data_fetcher.abstract_provider.abstract.query_params import BaseQueryParams


class FredSeriesQueryParams(BaseQueryParams):
    """FRED 시계열 조회 표준 파라미터"""

    series_id: Optional[str] = Field(default=None, description="FRED 시리즈 ID (예: GDP, CPIAUCSL)")
    start_date: Optional[str] = Field(default=None, description="시작일 (YYYY-MM-DD)")
    end_date: Optional[str] = Field(default=None, description="종료일 (YYYY-MM-DD)")
    limit: Optional[int] = Field(default=100, description="최대 결과 수")
    sort_order: Optional[str] = Field(default="desc", description="정렬 순서 (asc/desc)")


class FredSeriesData(BaseData):
    """FRED 시계열 표준 데이터

    단일 시리즈 레코드 (date + value).
    복합 지표(yield_curve, dashboard 등)는 이 클래스를 상속해 컬럼을 추가합니다.
    """

    date: date_type = Field(description="날짜")
    value: Optional[float] = Field(default=None, description="지표 값")
    series_id: Optional[str] = Field(default=None, description="FRED 시리즈 ID")
    unit: Optional[str] = Field(default=None, description="단위 (%, Billions USD 등)")

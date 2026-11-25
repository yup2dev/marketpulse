"""News Events Standard Model — 종목에 매핑된 뉴스 이벤트 (요약 · 감성 · 가격 영향). 주가 차트 오버레이용."""
from datetime import date as dateType, datetime
from typing import Optional

from pydantic import Field

from data_fetcher.abstract_provider.abstract.data import BaseData
from data_fetcher.abstract_provider.abstract.query_params import BaseQueryParams


class NewsEventsQueryParams(BaseQueryParams):
    symbol: Optional[str] = Field(default=None, description="종목 코드 — 비우면 전체 (종목 없는 매크로 뉴스 포함)")
    start_date: Optional[dateType] = Field(default=None, description="시작일")
    end_date: Optional[dateType] = Field(default=None, description="종료일")
    limit: int = Field(default=100, ge=1, le=500, description="최대 건수")


class NewsEventsData(BaseData):
    date: Optional[dateType] = Field(default=None, description="이벤트 기준일")
    symbol: Optional[str] = Field(default=None, description="매핑된 종목")
    title: Optional[str] = Field(default=None, description="기사 제목")
    summary: Optional[str] = Field(default=None, description="요약")
    sentiment_score: Optional[float] = Field(default=None, description="감성 점수")
    price_impact: Optional[float] = Field(default=None, description="가격 영향")
    match_score: Optional[float] = Field(default=None, description="종목 매핑 점수")
    price: Optional[float] = Field(default=None, description="그날 가격")
    source: Optional[str] = Field(default=None, description="출처")
    url: Optional[str] = Field(default=None, description="원문 주소")
    publish_dt: Optional[datetime] = Field(default=None, description="발행 시각")

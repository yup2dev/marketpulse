"""Consumer Sentiment Index (소비자 심리 지수) Standard Model"""
from datetime import date as date_type, datetime, timedelta
from typing import Optional
from pydantic import Field
from data_fetcher.models.base import BaseQueryParams, BaseData


class ConsumerSentimentQueryParams(BaseQueryParams):
    """소비자 심리 지수 조회 파라미터"""

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
        description="데이터 빈도 (monthly, preliminary, final)"
    )


class ConsumerSentimentData(BaseData):
    """소비자 심리 지수 데이터 모델"""

    date: date_type = Field(
        description="데이터 날짜"
    )
    value: float = Field(
        description="소비자 심리 지수 값"
    )
    country: Optional[str] = Field(
        default="US",
        description="국가 코드"
    )
    unit: Optional[str] = Field(
        default="Index",
        description="단위"
    )
    change_from_previous: Optional[float] = Field(
        default=None,
        description="전월 대비 변화"
    )
    frequency_type: Optional[str] = Field(
        default="preliminary",
        description="데이터 타입 (preliminary, final)"
    )
    notes: Optional[str] = Field(
        default=None,
        description="참고 사항"
    )

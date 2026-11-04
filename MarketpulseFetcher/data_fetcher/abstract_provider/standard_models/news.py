"""Standard Model: News (뉴스/기사)"""
from datetime import datetime
from typing import List, Optional

from pydantic import Field

from data_fetcher.abstract_provider.abstract.data import BaseData
from data_fetcher.abstract_provider.abstract.query_params import BaseQueryParams


class NewsQueryParams(BaseQueryParams):
    """뉴스 조회 표준 파라미터"""

    symbol: Optional[str] = Field(default=None, description="종목 코드 (특정 종목 뉴스)")
    limit: Optional[int] = Field(default=50, description="최대 결과 수")
    start_date: Optional[str] = Field(default=None, description="시작일 (YYYY-MM-DD)")
    end_date: Optional[str] = Field(default=None, description="종료일 (YYYY-MM-DD)")


class NewsData(BaseData):
    """뉴스 표준 데이터"""

    id: Optional[str] = Field(default=None, description="뉴스 고유 ID")
    title: str = Field(description="뉴스 제목")
    description: Optional[str] = Field(default=None, description="뉴스 요약")
    article_url: Optional[str] = Field(default=None, description="원문 URL")

    # 발행 정보
    author: Optional[str] = Field(default=None, description="작성자")
    publisher: Optional[str] = Field(default=None, description="발행사")
    published_utc: Optional[datetime] = Field(default=None, description="발행 시간 (UTC)")

    # 관련 종목
    tickers: Optional[List[str]] = Field(default=None, description="관련 종목 티커 목록")

    # 미디어
    image_url: Optional[str] = Field(default=None, description="썸네일 이미지 URL")

    # 감성 분석
    sentiment: Optional[str] = Field(default=None, description="감성 (positive/neutral/negative)")
    sentiment_score: Optional[float] = Field(default=None, description="감성 점수 (-1.0 ~ 1.0)")

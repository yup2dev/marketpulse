"""Polygon.io News Model"""
from datetime import datetime
from typing import Optional, List
from pydantic import Field
from data_fetcher.models.base import BaseQueryParams, BaseData


class NewsQueryParams(BaseQueryParams):
    """뉴스 데이터 조회 파라미터"""

    ticker: Optional[str] = Field(
        default=None,
        description="종목 티커 (예: AAPL, TSLA) - 특정 종목 뉴스"
    )
    published_utc_gte: Optional[str] = Field(
        default=None,
        description="발행일시 >= (ISO 8601 형식)"
    )
    published_utc_lte: Optional[str] = Field(
        default=None,
        description="발행일시 <= (ISO 8601 형식)"
    )
    order: Optional[str] = Field(
        default="desc",
        description="정렬 순서 (asc/desc)"
    )
    limit: Optional[int] = Field(
        default=100,
        description="최대 결과 수"
    )


class NewsData(BaseData):
    """뉴스 데이터"""

    # === 기본 정보 ===
    id: str = Field(
        description="뉴스 고유 ID"
    )
    title: str = Field(
        description="뉴스 제목"
    )
    description: Optional[str] = Field(
        default=None,
        description="뉴스 요약"
    )
    article_url: str = Field(
        description="원문 URL"
    )

    # === 발행 정보 ===
    author: Optional[str] = Field(
        default=None,
        description="작성자"
    )
    publisher: Optional[str] = Field(
        default=None,
        description="발행사"
    )
    published_utc: datetime = Field(
        description="발행 시간 (UTC)"
    )

    # === 관련 종목 ===
    tickers: Optional[List[str]] = Field(
        default=None,
        description="관련 종목 티커 목록"
    )

    # === 이미지 ===
    image_url: Optional[str] = Field(
        default=None,
        description="썸네일 이미지 URL"
    )
    amp_url: Optional[str] = Field(
        default=None,
        description="AMP 페이지 URL"
    )

    # === 감성 분석 ===
    sentiment: Optional[str] = Field(
        default=None,
        description="감성 분석 결과 (positive/neutral/negative)"
    )
    sentiment_score: Optional[float] = Field(
        default=None,
        description="감성 점수 (-1.0 ~ 1.0)"
    )

    # === 키워드 ===
    keywords: Optional[List[str]] = Field(
        default=None,
        description="키워드 목록"
    )

    # === 메타 데이터 ===
    article_type: Optional[str] = Field(
        default=None,
        description="기사 유형"
    )

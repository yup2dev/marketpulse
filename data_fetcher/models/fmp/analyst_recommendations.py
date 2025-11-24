"""FMP Analyst Recommendations Model"""
from datetime import date as date_type
from typing import Optional
from pydantic import Field
from data_fetcher.models.base import BaseQueryParams, BaseData


class AnalystRecommendationsQueryParams(BaseQueryParams):
    """애널리스트 추천 등급 조회 파라미터"""

    symbol: str = Field(
        description="종목 심볼 (예: AAPL, TSLA)"
    )
    limit: Optional[int] = Field(
        default=100,
        description="최대 결과 수"
    )


class AnalystRecommendationsData(BaseData):
    """애널리스트 추천 등급 데이터"""

    symbol: str = Field(
        description="종목 심볼"
    )
    date: date_type = Field(
        description="추천 날짜"
    )
    analyst_name: Optional[str] = Field(
        default=None,
        description="애널리스트 이름"
    )
    analyst_company: Optional[str] = Field(
        default=None,
        description="분석기관명"
    )

    # === 추천 등급 ===
    analyst_rating_strong_buy: Optional[int] = Field(
        default=None,
        description="Strong Buy 추천 수"
    )
    analyst_rating_buy: Optional[int] = Field(
        default=None,
        description="Buy 추천 수"
    )
    analyst_rating_hold: Optional[int] = Field(
        default=None,
        description="Hold 추천 수"
    )
    analyst_rating_sell: Optional[int] = Field(
        default=None,
        description="Sell 추천 수"
    )
    analyst_rating_strong_sell: Optional[int] = Field(
        default=None,
        description="Strong Sell 추천 수"
    )

    # === 컨센서스 ===
    analyst_rating_consensus: Optional[str] = Field(
        default=None,
        description="컨센서스 등급 (Strong Buy, Buy, Hold, Sell, Strong Sell)"
    )

    # === 목표가 ===
    analyst_target_price: Optional[float] = Field(
        default=None,
        description="목표주가"
    )
    analyst_target_price_min: Optional[float] = Field(
        default=None,
        description="최소 목표주가"
    )
    analyst_target_price_max: Optional[float] = Field(
        default=None,
        description="최대 목표주가"
    )
    analyst_target_price_avg: Optional[float] = Field(
        default=None,
        description="평균 목표주가"
    )
    analyst_target_price_median: Optional[float] = Field(
        default=None,
        description="중간 목표주가"
    )

    # === 애널리스트 수 ===
    number_of_analysts: Optional[int] = Field(
        default=None,
        description="분석한 애널리스트 수"
    )
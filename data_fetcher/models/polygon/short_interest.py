"""Polygon.io Short Interest Model"""
from datetime import date as date_type
from typing import Optional
from pydantic import Field
from data_fetcher.models.base import BaseQueryParams, BaseData


class ShortInterestQueryParams(BaseQueryParams):
    """공매도 데이터 조회 파라미터"""

    ticker: str = Field(
        description="종목 티커 (예: AAPL, TSLA)"
    )
    start_date: Optional[str] = Field(
        default=None,
        description="조회 시작일 (YYYY-MM-DD)"
    )
    end_date: Optional[str] = Field(
        default=None,
        description="조회 종료일 (YYYY-MM-DD)"
    )
    limit: Optional[int] = Field(
        default=100,
        description="최대 결과 수"
    )


class ShortInterestData(BaseData):
    """공매도 데이터 (Polygon.io)"""

    ticker: str = Field(
        description="종목 티커"
    )
    settlement_date: date_type = Field(
        description="결제일 (공매도 데이터 기준일)"
    )

    # === 공매도 주식 수 ===
    short_interest: Optional[int] = Field(
        default=None,
        description="공매도 포지션 수량"
    )
    short_interest_change: Optional[int] = Field(
        default=None,
        description="전기 대비 공매도 변화량"
    )
    short_interest_change_percent: Optional[float] = Field(
        default=None,
        description="전기 대비 공매도 변화율 (%)"
    )

    # === 비율 데이터 ===
    short_percent_of_float: Optional[float] = Field(
        default=None,
        description="유통주식 대비 공매도 비율 (%)"
    )
    days_to_cover: Optional[float] = Field(
        default=None,
        description="공매도 커버 소요 일수"
    )

    # === 참고 데이터 ===
    average_daily_volume: Optional[int] = Field(
        default=None,
        description="일평균 거래량"
    )
    shares_outstanding: Optional[int] = Field(
        default=None,
        description="발행주식 수"
    )

    # === 메타 데이터 ===
    market: Optional[str] = Field(
        default=None,
        description="시장 구분 (예: NASDAQ, NYSE)"
    )

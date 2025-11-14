"""Short Interest Standard Model (공매도 데이터)"""
from datetime import datetime, date
from typing import Optional
from pydantic import Field
from data_fetcher.models.base import BaseQueryParams, BaseData


class ShortInterestQueryParams(BaseQueryParams):
    """공매도 데이터 조회 파라미터"""

    symbol: str = Field(
        description="종목 코드 (예: TSLA, AAPL)"
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
        default=10,
        description="조회할 데이터 개수"
    )


class ShortInterestData(BaseData):
    """공매도 데이터"""

    symbol: str = Field(
        description="종목 코드"
    )
    company_name: Optional[str] = Field(
        default=None,
        description="회사명"
    )

    # === 공매도 주식 수 ===
    shares_short: Optional[int] = Field(
        default=None,
        description="공매도 주식 수 (현재)"
    )
    shares_short_prior_month: Optional[int] = Field(
        default=None,
        description="전월 공매도 주식 수"
    )

    # === 공매도 비율 ===
    short_percent_of_float: Optional[float] = Field(
        default=None,
        description="유통주식 대비 공매도 비율 (소수점 형태, 예: 0.0248 = 2.48%)"
    )
    short_ratio: Optional[float] = Field(
        default=None,
        description="공매도 비율 - 일평균 거래량 대비 (일 단위)"
    )

    # === 변화율 ===
    month_over_month_change: Optional[int] = Field(
        default=None,
        description="전월 대비 공매도 주식 수 변화 (주)"
    )
    month_over_month_change_percent: Optional[float] = Field(
        default=None,
        description="전월 대비 공매도 변화율 (%)"
    )

    # === 참고 데이터 ===
    float_shares: Optional[int] = Field(
        default=None,
        description="유통주식 수"
    )
    shares_outstanding: Optional[int] = Field(
        default=None,
        description="발행주식 수"
    )
    average_volume: Optional[int] = Field(
        default=None,
        description="일평균 거래량"
    )

    # === 시간 정보 ===
    date_short_interest: Optional[date] = Field(
        default=None,
        description="공매도 데이터 기준일"
    )
    data_date: Optional[date] = Field(
        default=None,
        description="데이터 날짜 (히스토리 조회 시)"
    )
    fetched_at: Optional[datetime] = Field(
        default=None,
        description="데이터 조회 시간"
    )

    # === 계산 필드 ===
    short_percent_of_outstanding: Optional[float] = Field(
        default=None,
        description="발행주식 대비 공매도 비율 (소수점)"
    )
    days_to_cover: Optional[float] = Field(
        default=None,
        description="공매도 커버 소요 일수 (= short_ratio)"
    )


class ShortInterestHistoricalData(BaseData):
    """공매도 히스토리 데이터 (시계열)"""

    symbol: str = Field(
        description="종목 코드"
    )
    data_date: date = Field(
        description="날짜"
    )
    short_volume: Optional[int] = Field(
        default=None,
        description="공매도 거래량 (일별)"
    )
    total_volume: Optional[int] = Field(
        default=None,
        description="총 거래량"
    )
    short_volume_percent: Optional[float] = Field(
        default=None,
        description="공매도 거래량 비율 (%)"
    )
    shares_short: Optional[int] = Field(
        default=None,
        description="공매도 주식 수 (해당 시점)"
    )
    short_percent_of_float: Optional[float] = Field(
        default=None,
        description="유통주식 대비 공매도 비율"
    )

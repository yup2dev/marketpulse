"""Standard Model: Short Interest (공매도 잔고)"""
from datetime import date as date_type
from typing import Optional

from pydantic import Field

from data_fetcher.abstract_provider.abstract.data import BaseData
from data_fetcher.abstract_provider.abstract.query_params import BaseQueryParams


class ShortInterestQueryParams(BaseQueryParams):
    symbol: str = Field(description="종목 코드")
    start_date: Optional[str] = Field(default=None, description="시작일 (YYYY-MM-DD)")
    end_date: Optional[str] = Field(default=None, description="종료일 (YYYY-MM-DD)")
    limit: Optional[int] = Field(default=10, description="최대 결과 수")


class ShortInterestData(BaseData):
    symbol: str = Field(description="종목 코드")
    settlement_date: date_type = Field(description="결산일")
    short_interest: Optional[int] = Field(default=None, description="공매도 잔고 (주)")
    short_interest_change: Optional[int] = Field(default=None, description="공매도 잔고 변화")
    short_interest_change_percent: Optional[float] = Field(default=None, description="공매도 잔고 변화율 (%)")
    short_percent_of_float: Optional[float] = Field(default=None, description="유통주식 대비 공매도 비율 (%)")
    days_to_cover: Optional[float] = Field(default=None, description="커버 소요 일수")
    average_daily_volume: Optional[int] = Field(default=None, description="평균 일일 거래량")
    shares_outstanding: Optional[int] = Field(default=None, description="발행 주식 수")
    market: Optional[str] = Field(default=None, description="시장 (NASDAQ / NYSE 등)")

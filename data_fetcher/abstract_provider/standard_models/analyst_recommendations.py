"""Standard Model: Analyst Recommendations (애널리스트 투자의견)"""
from datetime import date as date_type
from typing import Optional

from pydantic import Field

from data_fetcher.abstract_provider.abstract.data import BaseData
from data_fetcher.abstract_provider.abstract.query_params import BaseQueryParams


class AnalystRecommendationsQueryParams(BaseQueryParams):
    symbol: str = Field(description="종목 코드")
    limit: Optional[int] = Field(default=100, description="최대 결과 수")


class AnalystRecommendationsData(BaseData):
    symbol: str = Field(description="종목 코드")
    date: date_type = Field(description="추천 날짜")
    analyst_company: Optional[str] = Field(default=None, description="분석기관명")
    analyst_name: Optional[str] = Field(default=None, description="애널리스트 이름")

    # 투자의견 수
    strong_buy: Optional[int] = Field(default=None, description="Strong Buy 수")
    buy: Optional[int] = Field(default=None, description="Buy 수")
    hold: Optional[int] = Field(default=None, description="Hold 수")
    sell: Optional[int] = Field(default=None, description="Sell 수")
    strong_sell: Optional[int] = Field(default=None, description="Strong Sell 수")
    number_of_analysts: Optional[int] = Field(default=None, description="총 애널리스트 수")
    consensus: Optional[str] = Field(default=None, description="컨센서스 등급")

    # 목표주가
    target_price: Optional[float] = Field(default=None, description="목표주가")
    target_price_avg: Optional[float] = Field(default=None, description="평균 목표주가")
    target_price_min: Optional[float] = Field(default=None, description="최소 목표주가")
    target_price_max: Optional[float] = Field(default=None, description="최대 목표주가")
    target_price_median: Optional[float] = Field(default=None, description="중간 목표주가")

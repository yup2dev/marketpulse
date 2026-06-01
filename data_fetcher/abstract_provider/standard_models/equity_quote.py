"""Standard Model: Equity Quote (실시간 주식 시세)

Provider 무관한 공통 인터페이스.
각 provider는 이 클래스를 상속해 provider 전용 필드와 __alias_dict__를 추가합니다.
"""
from datetime import datetime
from typing import Optional

from pydantic import Field, field_validator

from data_fetcher.abstract_provider.abstract.data import BaseData
from data_fetcher.abstract_provider.abstract.query_params import BaseQueryParams


class EquityQuoteQueryParams(BaseQueryParams):
    """주식 시세 조회 표준 파라미터"""

    symbol: str = Field(description="종목 코드 (예: AAPL, MSFT)")

    @field_validator("symbol", mode="before")
    @classmethod
    def to_upper(cls, v: str) -> str:
        return v.upper() if isinstance(v, str) else v


class EquityQuoteData(BaseData):
    """주식 시세 표준 데이터

    provider별 확장:
        - FMPEquityQuoteData(EquityQuoteData): market_cap, ma50, ma200 추가
        - AlphaVantageEquityQuoteData(EquityQuoteData): is_market_open 추가
    """

    symbol: str = Field(description="종목 코드")
    name: Optional[str] = Field(default=None, description="종목명")

    # 가격
    last_price: Optional[float] = Field(default=None, description="현재가")
    open: Optional[float] = Field(default=None, description="시가")
    high: Optional[float] = Field(default=None, description="고가")
    low: Optional[float] = Field(default=None, description="저가")
    previous_close: Optional[float] = Field(default=None, description="전일 종가")

    # 변동
    change: Optional[float] = Field(default=None, description="등락폭")
    change_percent: Optional[float] = Field(default=None, description="등락률 (%)")

    # 거래량
    volume: Optional[int] = Field(default=None, description="거래량")
    average_volume: Optional[int] = Field(default=None, description="평균 거래량")

    # 52주
    week_52_high: Optional[float] = Field(default=None, description="52주 최고가")
    week_52_low: Optional[float] = Field(default=None, description="52주 최저가")

    # 시장 정보
    market_cap: Optional[float] = Field(default=None, description="시가총액")
    exchange: Optional[str] = Field(default=None, description="거래소")
    currency: Optional[str] = Field(default="USD", description="통화")

    # 시간
    last_updated: Optional[datetime] = Field(default=None, description="마지막 업데이트")

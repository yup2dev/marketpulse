"""Standard Model: Equity Historical (OHLCV 시계열 데이터)"""
from datetime import date as date_type, datetime
from typing import Optional, Union

from pydantic import Field, field_validator

from data_fetcher.abstract_provider.abstract.data import BaseData
from data_fetcher.abstract_provider.abstract.query_params import BaseQueryParams


class EquityHistoricalQueryParams(BaseQueryParams):
    """OHLCV 시계열 조회 표준 파라미터"""

    symbol: str = Field(description="종목 코드 (예: AAPL, MSFT)")
    start_date: Optional[str] = Field(default=None, description="시작일 (YYYY-MM-DD)")
    end_date: Optional[str] = Field(default=None, description="종료일 (YYYY-MM-DD)")
    interval: str = Field(
        default="1d",
        description="데이터 간격 (1m, 5m, 15m, 1h, 1d, 1wk, 1mo)",
    )

    @field_validator("symbol", mode="before")
    @classmethod
    def to_upper(cls, v: str) -> str:
        return v.upper() if isinstance(v, str) else v


class EquityHistoricalData(BaseData):
    """OHLCV 시계열 표준 데이터"""

    symbol: str = Field(description="종목 코드")
    date: Union[datetime, date_type] = Field(description="날짜/시간")

    open: Optional[float] = Field(default=None, description="시가")
    high: Optional[float] = Field(default=None, description="고가")
    low: Optional[float] = Field(default=None, description="저가")
    close: Optional[float] = Field(default=None, description="종가")
    adj_close: Optional[float] = Field(default=None, description="수정 종가")
    volume: Optional[int] = Field(default=None, description="거래량")

    # 파생 필드 (선택)
    daily_return: Optional[float] = Field(default=None, description="일일 수익률 (%)")
    price_change: Optional[float] = Field(default=None, description="가격 변동")
    price_change_pct: Optional[float] = Field(default=None, description="가격 변동률 (%)")

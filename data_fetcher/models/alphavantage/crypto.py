"""AlphaVantage Cryptocurrency Model (암호화폐 데이터)"""
from datetime import date as date_type
from typing import Optional
from pydantic import Field
from data_fetcher.models.base import BaseQueryParams, BaseData


class CryptoQueryParams(BaseQueryParams):
    """암호화폐 데이터 조회 파라미터"""

    symbol: str = Field(
        description="암호화폐 심볼 (예: BTC, ETH, DOGE)"
    )
    market: str = Field(
        default="USD",
        description="거래 시장 (예: USD, EUR, KRW)"
    )
    start_date: Optional[str] = Field(
        default=None,
        description="조회 시작일 (YYYY-MM-DD)"
    )
    end_date: Optional[str] = Field(
        default=None,
        description="조회 종료일 (YYYY-MM-DD)"
    )
    interval: str = Field(
        default="daily",
        description="데이터 간격 (daily, weekly, monthly)"
    )


class CryptoData(BaseData):
    """암호화폐 데이터"""

    symbol: str = Field(description="암호화폐 심볼")
    market: str = Field(description="거래 시장")
    date: date_type = Field(description="날짜")

    # 가격 데이터
    open: float = Field(description="시가 (USD)")
    high: float = Field(description="고가 (USD)")
    low: float = Field(description="저가 (USD)")
    close: float = Field(description="종가 (USD)")
    volume: float = Field(description="거래량")

    # 시가총액
    market_cap: Optional[float] = Field(
        default=None,
        description="시가총액 (USD)"
    )

    # 계산 필드
    daily_return: Optional[float] = Field(
        default=None,
        description="일일 수익률 (%)"
    )
    price_change: Optional[float] = Field(
        default=None,
        description="가격 변동 (종가 - 시가)"
    )
    price_change_pct: Optional[float] = Field(
        default=None,
        description="가격 변동률 (%)"
    )
    volatility: Optional[float] = Field(
        default=None,
        description="변동성 (고가 - 저가)"
    )

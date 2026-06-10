"""Standard Model: Company Profile (회사 프로필)"""
from datetime import date as date_type
from typing import Optional

from pydantic import Field, field_validator

from data_fetcher.abstract_provider.abstract.data import BaseData
from data_fetcher.abstract_provider.abstract.query_params import BaseQueryParams


class CompanyProfileQueryParams(BaseQueryParams):
    """회사 프로필 조회 표준 파라미터"""

    symbol: str = Field(description="종목 코드 (예: AAPL, MSFT)")

    @field_validator("symbol", mode="before")
    @classmethod
    def to_upper(cls, v: str) -> str:
        return v.upper() if isinstance(v, str) else v


class CompanyProfileData(BaseData):
    """회사 프로필 표준 데이터"""

    symbol: str = Field(description="종목 코드")
    company_name: Optional[str] = Field(default=None, description="회사명")

    # 분류
    exchange: Optional[str] = Field(default=None, description="거래소")
    industry: Optional[str] = Field(default=None, description="산업")
    sector: Optional[str] = Field(default=None, description="섹터")
    country: Optional[str] = Field(default=None, description="국가")
    currency: Optional[str] = Field(default=None, description="통화")

    # 재무 요약
    market_cap: Optional[float] = Field(default=None, description="시가총액")
    beta: Optional[float] = Field(default=None, description="베타")
    price: Optional[float] = Field(default=None, description="현재 주가")

    # 회사 정보
    description: Optional[str] = Field(default=None, description="회사 설명")
    ceo: Optional[str] = Field(default=None, description="CEO")
    full_time_employees: Optional[int] = Field(default=None, description="정규직 직원 수")
    website: Optional[str] = Field(default=None, description="웹사이트")
    image: Optional[str] = Field(default=None, description="로고 이미지 URL")

    # 식별자
    cik: Optional[str] = Field(default=None, description="SEC CIK 번호")
    isin: Optional[str] = Field(default=None, description="ISIN 코드")
    cusip: Optional[str] = Field(default=None, description="CUSIP 코드")

    # 상장 정보
    ipo_date: Optional[date_type] = Field(default=None, description="IPO 날짜")
    is_etf: Optional[bool] = Field(default=None, description="ETF 여부")
    is_actively_trading: Optional[bool] = Field(default=None, description="활발히 거래 중 여부")
    is_adr: Optional[bool] = Field(default=None, description="ADR 여부")
    is_fund: Optional[bool] = Field(default=None, description="펀드 여부")

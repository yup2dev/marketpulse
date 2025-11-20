"""FMP Company Profile Model"""
from datetime import date as date_type
from typing import Optional
from pydantic import Field
from data_fetcher.models.base import BaseQueryParams, BaseData


class CompanyProfileQueryParams(BaseQueryParams):
    """회사 프로필 조회 파라미터"""

    symbol: str = Field(
        description="종목 심볼 (예: AAPL, TSLA)"
    )


class CompanyProfileData(BaseData):
    """회사 프로필 데이터"""

    symbol: str = Field(
        description="종목 심볼"
    )
    company_name: Optional[str] = Field(
        default=None,
        description="회사명"
    )
    price: Optional[float] = Field(
        default=None,
        description="현재 주가"
    )
    beta: Optional[float] = Field(
        default=None,
        description="베타 (변동성)"
    )
    volume_avg: Optional[int] = Field(
        default=None,
        description="평균 거래량"
    )
    market_cap: Optional[float] = Field(
        default=None,
        description="시가총액"
    )
    last_div: Optional[float] = Field(
        default=None,
        description="마지막 배당금"
    )
    range: Optional[str] = Field(
        default=None,
        description="52주 가격 범위"
    )
    changes: Optional[float] = Field(
        default=None,
        description="가격 변동"
    )
    currency: Optional[str] = Field(
        default=None,
        description="통화"
    )
    cik: Optional[str] = Field(
        default=None,
        description="SEC CIK 번호"
    )
    isin: Optional[str] = Field(
        default=None,
        description="ISIN 코드"
    )
    cusip: Optional[str] = Field(
        default=None,
        description="CUSIP 코드"
    )
    exchange: Optional[str] = Field(
        default=None,
        description="거래소"
    )
    exchange_short_name: Optional[str] = Field(
        default=None,
        description="거래소 약칭"
    )
    industry: Optional[str] = Field(
        default=None,
        description="산업"
    )
    sector: Optional[str] = Field(
        default=None,
        description="섹터"
    )
    country: Optional[str] = Field(
        default=None,
        description="국가"
    )
    website: Optional[str] = Field(
        default=None,
        description="웹사이트"
    )
    description: Optional[str] = Field(
        default=None,
        description="회사 설명"
    )
    ceo: Optional[str] = Field(
        default=None,
        description="CEO"
    )
    full_time_employees: Optional[int] = Field(
        default=None,
        description="정규직 직원 수"
    )
    phone: Optional[str] = Field(
        default=None,
        description="전화번호"
    )
    address: Optional[str] = Field(
        default=None,
        description="주소"
    )
    city: Optional[str] = Field(
        default=None,
        description="도시"
    )
    state: Optional[str] = Field(
        default=None,
        description="주/도"
    )
    zip: Optional[str] = Field(
        default=None,
        description="우편번호"
    )
    dcf_diff: Optional[float] = Field(
        default=None,
        description="DCF 차이"
    )
    dcf: Optional[float] = Field(
        default=None,
        description="DCF 가치평가"
    )
    image: Optional[str] = Field(
        default=None,
        description="로고 이미지 URL"
    )
    ipo_date: Optional[date_type] = Field(
        default=None,
        description="IPO 날짜"
    )
    is_etf: Optional[bool] = Field(
        default=None,
        description="ETF 여부"
    )
    is_actively_trading: Optional[bool] = Field(
        default=None,
        description="활발히 거래 중 여부"
    )
    is_adr: Optional[bool] = Field(
        default=None,
        description="ADR 여부"
    )
    is_fund: Optional[bool] = Field(
        default=None,
        description="펀드 여부"
    )
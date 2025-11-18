"""AlphaVantage Company Overview Model (기업 개요)"""
from typing import Optional
from pydantic import Field
from data_fetcher.models.base import BaseQueryParams, BaseData


class CompanyOverviewQueryParams(BaseQueryParams):
    """기업 개요 조회 파라미터"""

    symbol: str = Field(
        description="종목 코드 (예: AAPL, MSFT)"
    )


class CompanyOverviewData(BaseData):
    """기업 개요 데이터 (AlphaVantage)"""

    # 기본 정보
    symbol: str = Field(description="종목 코드")
    name: Optional[str] = Field(default=None, description="회사명")
    description: Optional[str] = Field(default=None, description="회사 설명")
    exchange: Optional[str] = Field(default=None, description="거래소")
    currency: Optional[str] = Field(default=None, description="통화")
    country: Optional[str] = Field(default=None, description="국가")
    sector: Optional[str] = Field(default=None, description="섹터")
    industry: Optional[str] = Field(default=None, description="산업")

    # 재무 정보
    market_cap: Optional[int] = Field(default=None, description="시가총액")
    ebitda: Optional[int] = Field(default=None, description="EBITDA")
    pe_ratio: Optional[float] = Field(default=None, description="PER")
    peg_ratio: Optional[float] = Field(default=None, description="PEG")
    book_value: Optional[float] = Field(default=None, description="주당 장부가치")
    dividend_per_share: Optional[float] = Field(default=None, description="주당 배당금")
    dividend_yield: Optional[float] = Field(default=None, description="배당 수익률")
    eps: Optional[float] = Field(default=None, description="주당 순이익 (EPS)")
    revenue_per_share: Optional[float] = Field(default=None, description="주당 매출")
    profit_margin: Optional[float] = Field(default=None, description="순이익률")
    operating_margin: Optional[float] = Field(default=None, description="영업이익률")
    roe: Optional[float] = Field(default=None, description="자기자본이익률 (ROE)")
    roa: Optional[float] = Field(default=None, description="총자산이익률 (ROA)")

    # 성장성
    revenue_growth_yoy: Optional[float] = Field(default=None, description="연간 매출 성장률")
    earnings_growth_yoy: Optional[float] = Field(default=None, description="연간 이익 성장률")
    revenue_growth_quarterly: Optional[float] = Field(default=None, description="분기 매출 성장률")
    earnings_growth_quarterly: Optional[float] = Field(default=None, description="분기 이익 성장률")

    # 가격 정보
    week_52_high: Optional[float] = Field(default=None, description="52주 최고가")
    week_52_low: Optional[float] = Field(default=None, description="52주 최저가")
    day_50_ma: Optional[float] = Field(default=None, description="50일 이동평균")
    day_200_ma: Optional[float] = Field(default=None, description="200일 이동평균")

    # 주식 정보
    shares_outstanding: Optional[int] = Field(default=None, description="발행 주식 수")
    dividend_date: Optional[str] = Field(default=None, description="배당 지급일")
    ex_dividend_date: Optional[str] = Field(default=None, description="배당락일")

    # 애널리스트 목표가
    analyst_target_price: Optional[float] = Field(default=None, description="애널리스트 목표가")

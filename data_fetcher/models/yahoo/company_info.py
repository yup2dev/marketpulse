"""Yahoo Finance Company Info Model (회사 정보)"""
from typing import Optional
from pydantic import Field
from data_fetcher.models.base import BaseQueryParams, BaseData


class CompanyInfoQueryParams(BaseQueryParams):
    """회사 정보 조회 파라미터"""

    symbol: str = Field(
        description="종목 코드 (예: AAPL, MSFT)"
    )


class CompanyInfoData(BaseData):
    """회사 정보 데이터"""

    # 기본 정보
    symbol: str = Field(description="종목 코드")
    company_name: Optional[str] = Field(default=None, description="회사명")
    sector: Optional[str] = Field(default=None, description="섹터")
    industry: Optional[str] = Field(default=None, description="산업")
    country: Optional[str] = Field(default=None, description="국가")
    website: Optional[str] = Field(default=None, description="웹사이트")
    description: Optional[str] = Field(default=None, description="회사 설명")

    # 시가총액 및 규모
    market_cap: Optional[int] = Field(default=None, description="시가총액 (USD)")
    enterprise_value: Optional[int] = Field(default=None, description="기업 가치")
    shares_outstanding: Optional[int] = Field(default=None, description="발행 주식 수")
    float_shares: Optional[int] = Field(default=None, description="유통 주식 수")

    # 재무 비율
    pe_ratio: Optional[float] = Field(default=None, description="PER (주가수익비율)")
    pb_ratio: Optional[float] = Field(default=None, description="PBR (주가순자산비율)")
    ps_ratio: Optional[float] = Field(default=None, description="PSR (주가매출비율)")
    peg_ratio: Optional[float] = Field(default=None, description="PEG 비율")

    # 수익성
    profit_margin: Optional[float] = Field(default=None, description="순이익률 (%)")
    operating_margin: Optional[float] = Field(default=None, description="영업이익률 (%)")
    roe: Optional[float] = Field(default=None, description="ROE (자기자본이익률)")
    roa: Optional[float] = Field(default=None, description="ROA (총자산이익률)")

    # 배당
    dividend_rate: Optional[float] = Field(default=None, description="연간 배당금")
    dividend_yield: Optional[float] = Field(default=None, description="배당 수익률 (%)")
    payout_ratio: Optional[float] = Field(default=None, description="배당 성향 (%)")

    # 가격 정보
    current_price: Optional[float] = Field(default=None, description="현재가")
    day_high: Optional[float] = Field(default=None, description="당일 고가")
    day_low: Optional[float] = Field(default=None, description="당일 저가")
    week_52_high: Optional[float] = Field(default=None, description="52주 최고가")
    week_52_low: Optional[float] = Field(default=None, description="52주 최저가")

    # 거래량
    volume: Optional[int] = Field(default=None, description="거래량")
    average_volume: Optional[int] = Field(default=None, description="평균 거래량")

    # 재무 건전성
    debt_to_equity: Optional[float] = Field(default=None, description="부채비율")
    current_ratio: Optional[float] = Field(default=None, description="유동비율")
    quick_ratio: Optional[float] = Field(default=None, description="당좌비율")

    # 성장성
    revenue_growth: Optional[float] = Field(default=None, description="매출 성장률 (%)")
    earnings_growth: Optional[float] = Field(default=None, description="이익 성장률 (%)")

    # 애널리스트 의견
    target_price: Optional[float] = Field(default=None, description="목표주가")
    recommendation: Optional[str] = Field(default=None, description="추천 의견")
    num_analysts: Optional[int] = Field(default=None, description="애널리스트 수")

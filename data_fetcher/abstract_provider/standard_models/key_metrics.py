"""Standard Model: Key Metrics (핵심 투자 지표)"""
from typing import Optional

from pydantic import Field

from data_fetcher.abstract_provider.abstract.data import BaseData
from data_fetcher.abstract_provider.abstract.query_params import BaseQueryParams


class KeyMetricsQueryParams(BaseQueryParams):
    symbol: str = Field(description="종목 코드")


class KeyMetricsData(BaseData):
    symbol: str = Field(description="종목 코드")

    # 밸류에이션
    pe_ratio: Optional[float] = Field(default=None, description="PER (주가수익비율)")
    forward_pe: Optional[float] = Field(default=None, description="선행 PER")
    peg_ratio: Optional[float] = Field(default=None, description="PEG 비율")
    ps_ratio: Optional[float] = Field(default=None, description="PSR (주가매출비율)")
    pb_ratio: Optional[float] = Field(default=None, description="PBR (주가순자산비율)")
    ev_ebitda: Optional[float] = Field(default=None, description="EV/EBITDA")
    ev_revenue: Optional[float] = Field(default=None, description="EV/Revenue")
    price_to_fcf: Optional[float] = Field(default=None, description="주가/잉여현금흐름")

    # 수익성
    gross_margin: Optional[float] = Field(default=None, description="매출총이익률 (%)")
    operating_margin: Optional[float] = Field(default=None, description="영업이익률 (%)")
    net_margin: Optional[float] = Field(default=None, description="순이익률 (%)")
    roe: Optional[float] = Field(default=None, description="자기자본이익률 (%)")
    roa: Optional[float] = Field(default=None, description="총자산이익률 (%)")

    # 재무 건전성
    current_ratio: Optional[float] = Field(default=None, description="유동비율")
    quick_ratio: Optional[float] = Field(default=None, description="당좌비율")
    debt_to_equity: Optional[float] = Field(default=None, description="부채비율")

    # 현금흐름
    operating_cash_flow: Optional[float] = Field(default=None, description="영업활동 현금흐름")
    free_cash_flow: Optional[float] = Field(default=None, description="잉여현금흐름")

    # 주당 지표
    eps_trailing: Optional[float] = Field(default=None, description="최근 12개월 EPS")
    eps_forward: Optional[float] = Field(default=None, description="선행 EPS")
    book_value: Optional[float] = Field(default=None, description="주당 순자산")
    revenue_per_share: Optional[float] = Field(default=None, description="주당 매출")

    # 배당
    dividend_yield: Optional[float] = Field(default=None, description="배당 수익률 (%)")
    payout_ratio: Optional[float] = Field(default=None, description="배당성향 (%)")

    # 성장성
    revenue_growth: Optional[float] = Field(default=None, description="매출 성장률 (%)")
    earnings_growth: Optional[float] = Field(default=None, description="이익 성장률 (%)")
    earnings_quarterly_growth: Optional[float] = Field(default=None, description="분기 이익 성장률 (%)")

    # 시장 정보
    market_cap: Optional[float] = Field(default=None, description="시가총액")
    enterprise_value: Optional[float] = Field(default=None, description="기업가치 (EV)")
    beta: Optional[float] = Field(default=None, description="베타")
    week_52_high: Optional[float] = Field(default=None, description="52주 최고가")
    week_52_low: Optional[float] = Field(default=None, description="52주 최저가")
    ma_50_day: Optional[float] = Field(default=None, description="50일 이동평균")
    ma_200_day: Optional[float] = Field(default=None, description="200일 이동평균")

    # 주식 수
    shares_outstanding: Optional[float] = Field(default=None, description="총 발행주식수")
    float_shares: Optional[float] = Field(default=None, description="유통주식수")

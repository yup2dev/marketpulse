"""Standard Model: Income Statement (손익계산서)"""
from datetime import date as date_type
from typing import Optional

from pydantic import Field

from data_fetcher.abstract_provider.abstract.data import BaseData
from data_fetcher.abstract_provider.abstract.query_params import BaseQueryParams


class IncomeStatementQueryParams(BaseQueryParams):
    """손익계산서 조회 표준 파라미터"""

    symbol: str = Field(description="종목 코드")
    period: Optional[str] = Field(default="annual", description="기간 (annual / quarter)")
    limit: Optional[int] = Field(default=10, description="최대 결과 수")


class IncomeStatementData(BaseData):
    """손익계산서 표준 데이터"""

    # symbol/date/period 는 일부 provider(SEC XBRL 등)가 period_ending 기반이라 Optional.
    symbol: Optional[str] = Field(default=None, description="종목 코드")
    date: Optional[date_type] = Field(default=None, description="보고 날짜")
    period: Optional[str] = Field(default=None, description="보고 기간 (FY / Q1-Q4)")

    # 매출
    revenue: Optional[float] = Field(default=None, description="매출액")
    cost_of_revenue: Optional[float] = Field(default=None, description="매출원가")
    gross_profit: Optional[float] = Field(default=None, description="매출총이익")
    gross_profit_ratio: Optional[float] = Field(default=None, description="매출총이익률")

    # 영업비용
    research_and_development_expenses: Optional[float] = Field(default=None, description="연구개발비")
    selling_general_and_administrative_expenses: Optional[float] = Field(default=None, description="판매관리비")
    operating_expenses: Optional[float] = Field(default=None, description="영업비용 합계")

    # 영업이익
    operating_income: Optional[float] = Field(default=None, description="영업이익")
    operating_income_ratio: Optional[float] = Field(default=None, description="영업이익률")

    # 영업외
    interest_income: Optional[float] = Field(default=None, description="이자수익")
    interest_expense: Optional[float] = Field(default=None, description="이자비용")
    depreciation_and_amortization: Optional[float] = Field(default=None, description="감가상각비")

    # EBITDA
    ebitda: Optional[float] = Field(default=None, description="EBITDA")
    ebitda_ratio: Optional[float] = Field(default=None, description="EBITDA 비율")

    # 순이익
    income_before_tax: Optional[float] = Field(default=None, description="세전순이익")
    income_tax_expense: Optional[float] = Field(default=None, description="법인세비용")
    net_income: Optional[float] = Field(default=None, description="당기순이익")
    net_income_ratio: Optional[float] = Field(default=None, description="당기순이익률")

    # EPS
    eps: Optional[float] = Field(default=None, description="주당순이익 (EPS)")
    eps_diluted: Optional[float] = Field(default=None, description="희석 EPS")

    # 발행주식수
    weighted_average_shs_out: Optional[int] = Field(default=None, description="가중평균 발행주식수")
    weighted_average_shs_out_dil: Optional[int] = Field(default=None, description="희석 가중평균 발행주식수")

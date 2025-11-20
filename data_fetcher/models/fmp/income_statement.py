"""FMP Income Statement Model"""
from datetime import date as date_type
from typing import Optional
from pydantic import Field
from data_fetcher.models.base import BaseQueryParams, BaseData


class IncomeStatementQueryParams(BaseQueryParams):
    """손익계산서 조회 파라미터"""

    symbol: str = Field(
        description="종목 심볼 (예: AAPL, TSLA)"
    )
    period: Optional[str] = Field(
        default="annual",
        description="기간 (annual: 연간, quarter: 분기)"
    )
    limit: Optional[int] = Field(
        default=10,
        description="최대 결과 수"
    )


class IncomeStatementData(BaseData):
    """손익계산서 데이터"""

    symbol: str = Field(
        description="종목 심볼"
    )
    date: date_type = Field(
        description="보고 날짜"
    )
    period: str = Field(
        description="보고 기간 (FY: 회계연도, Q1-Q4: 분기)"
    )
    reporting_date: Optional[date_type] = Field(
        default=None,
        description="보고서 제출일"
    )
    fiscal_date_ending: Optional[date_type] = Field(
        default=None,
        description="회계연도 종료일"
    )

    # === 매출 및 비용 ===
    revenue: Optional[float] = Field(
        default=None,
        description="매출액"
    )
    cost_of_revenue: Optional[float] = Field(
        default=None,
        description="매출원가"
    )
    gross_profit: Optional[float] = Field(
        default=None,
        description="매출총이익"
    )
    gross_profit_ratio: Optional[float] = Field(
        default=None,
        description="매출총이익률"
    )

    # === 영업비용 ===
    research_and_development_expenses: Optional[float] = Field(
        default=None,
        description="연구개발비"
    )
    general_and_administrative_expenses: Optional[float] = Field(
        default=None,
        description="일반관리비"
    )
    selling_and_marketing_expenses: Optional[float] = Field(
        default=None,
        description="판매비"
    )
    selling_general_and_administrative_expenses: Optional[float] = Field(
        default=None,
        description="판매관리비 합계"
    )
    other_expenses: Optional[float] = Field(
        default=None,
        description="기타 비용"
    )
    operating_expenses: Optional[float] = Field(
        default=None,
        description="영업비용 합계"
    )

    # === 영업이익 ===
    cost_and_expenses: Optional[float] = Field(
        default=None,
        description="총 비용"
    )
    operating_income: Optional[float] = Field(
        default=None,
        description="영업이익"
    )
    operating_income_ratio: Optional[float] = Field(
        default=None,
        description="영업이익률"
    )

    # === 영업외 손익 ===
    interest_income: Optional[float] = Field(
        default=None,
        description="이자수익"
    )
    interest_expense: Optional[float] = Field(
        default=None,
        description="이자비용"
    )
    depreciation_and_amortization: Optional[float] = Field(
        default=None,
        description="감가상각비"
    )

    # === EBITDA ===
    ebitda: Optional[float] = Field(
        default=None,
        description="EBITDA (세전영업이익)"
    )
    ebitda_ratio: Optional[float] = Field(
        default=None,
        description="EBITDA 비율"
    )

    # === 세전이익 ===
    total_other_income_expenses_net: Optional[float] = Field(
        default=None,
        description="영업외 손익 합계"
    )
    income_before_tax: Optional[float] = Field(
        default=None,
        description="세전순이익"
    )
    income_before_tax_ratio: Optional[float] = Field(
        default=None,
        description="세전순이익률"
    )

    # === 법인세 ===
    income_tax_expense: Optional[float] = Field(
        default=None,
        description="법인세비용"
    )

    # === 순이익 ===
    net_income: Optional[float] = Field(
        default=None,
        description="당기순이익"
    )
    net_income_ratio: Optional[float] = Field(
        default=None,
        description="당기순이익률"
    )

    # === 주당 순이익 (EPS) ===
    eps: Optional[float] = Field(
        default=None,
        description="주당순이익 (EPS)"
    )
    eps_diluted: Optional[float] = Field(
        default=None,
        description="희석 주당순이익"
    )

    # === 발행주식수 ===
    weighted_average_shs_out: Optional[int] = Field(
        default=None,
        description="가중평균 발행주식수"
    )
    weighted_average_shs_out_dil: Optional[int] = Field(
        default=None,
        description="희석 가중평균 발행주식수"
    )

    # === 기타 ===
    link: Optional[str] = Field(
        default=None,
        description="SEC 보고서 링크"
    )
    final_link: Optional[str] = Field(
        default=None,
        description="최종 보고서 링크"
    )
    accepted_date: Optional[date_type] = Field(
        default=None,
        description="보고서 승인일"
    )
    calendar_year: Optional[int] = Field(
        default=None,
        description="달력 연도"
    )
    cik: Optional[str] = Field(
        default=None,
        description="SEC CIK 번호"
    )
    filling_date: Optional[date_type] = Field(
        default=None,
        description="보고서 제출일"
    )
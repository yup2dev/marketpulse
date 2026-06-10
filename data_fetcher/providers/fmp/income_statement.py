"""FMP Income Statement — QueryParams + Data + Fetcher"""
import logging
from datetime import date as date_type
from typing import Any, Dict, List, Optional

from pydantic import Field

from data_fetcher.abstract_provider.abstract.fetcher import Fetcher
from data_fetcher.abstract_provider.standard_models import IncomeStatementQueryParams, IncomeStatementData
from data_fetcher.utils.api_keys import get_api_key
from data_fetcher.utils.async_http_client import amake_request

log = logging.getLogger(__name__)

FMP_STABLE_BASE = "https://financialmodelingprep.com/stable"


# ── QueryParams ───────────────────────────────────────────────────────────────

class FMPIncomeStatementQueryParams(IncomeStatementQueryParams):
    """FMP 손익계산서 조회 파라미터 (IncomeStatementQueryParams 상속)"""
    pass


# ── Data ──────────────────────────────────────────────────────────────────────

class FMPIncomeStatementData(IncomeStatementData):
    """FMP 손익계산서 데이터

    Standard fields covered:
        symbol, date, period,
        revenue, cost_of_revenue, gross_profit, gross_profit_ratio,
        research_and_development_expenses, selling_general_and_administrative_expenses,
        operating_expenses, operating_income, operating_income_ratio,
        interest_income, interest_expense, depreciation_and_amortization,
        ebitda, ebitda_ratio,
        income_before_tax, income_tax_expense, net_income, net_income_ratio,
        eps, eps_diluted, weighted_average_shs_out, weighted_average_shs_out_dil
    """
    reporting_date: Optional[date_type] = Field(default=None, description="보고서 제출일")
    fiscal_date_ending: Optional[date_type] = Field(default=None, description="회계연도 종료일")
    general_and_administrative_expenses: Optional[float] = Field(default=None, description="일반관리비")
    selling_and_marketing_expenses: Optional[float] = Field(default=None, description="판매비")
    other_expenses: Optional[float] = Field(default=None, description="기타 비용")
    cost_and_expenses: Optional[float] = Field(default=None, description="총 비용")
    total_other_income_expenses_net: Optional[float] = Field(default=None, description="영업외 손익 합계")
    income_before_tax_ratio: Optional[float] = Field(default=None, description="세전순이익률")
    link: Optional[str] = Field(default=None, description="SEC 보고서 링크")
    final_link: Optional[str] = Field(default=None, description="최종 보고서 링크")
    accepted_date: Optional[date_type] = Field(default=None, description="보고서 승인일")
    calendar_year: Optional[int] = Field(default=None, description="달력 연도")
    cik: Optional[str] = Field(default=None, description="SEC CIK 번호")
    filling_date: Optional[date_type] = Field(default=None, description="보고서 제출일")

    __alias_dict__ = {
        "cost_of_revenue": "costOfRevenue",
        "gross_profit": "grossProfit",
        "gross_profit_ratio": "grossProfitRatio",
        "research_and_development_expenses": "researchAndDevelopmentExpenses",
        "selling_general_and_administrative_expenses": "sellingGeneralAndAdministrativeExpenses",
        "operating_expenses": "operatingExpenses",
        "operating_income": "operatingIncome",
        "operating_income_ratio": "operatingIncomeRatio",
        "interest_income": "interestIncome",
        "interest_expense": "interestExpense",
        "depreciation_and_amortization": "depreciationAndAmortization",
        "ebitda_ratio": "ebitdaratio",
        "income_before_tax": "incomeBeforeTax",
        "income_tax_expense": "incomeTaxExpense",
        "net_income": "netIncome",
        "net_income_ratio": "netIncomeRatio",
        "eps_diluted": "epsdiluted",
        "weighted_average_shs_out": "weightedAverageShsOut",
        "weighted_average_shs_out_dil": "weightedAverageShsOutDil",
        "general_and_administrative_expenses": "generalAndAdministrativeExpenses",
        "selling_and_marketing_expenses": "sellingAndMarketingExpenses",
        "other_expenses": "otherExpenses",
        "cost_and_expenses": "costAndExpenses",
        "total_other_income_expenses_net": "totalOtherIncomeExpensesNet",
        "income_before_tax_ratio": "incomeBeforeTaxRatio",
        "final_link": "finalLink",
        "accepted_date": "acceptedDate",
        "calendar_year": "calendarYear",
        "filling_date": "fillingDate",
    }


# ── Fetcher ───────────────────────────────────────────────────────────────────

class FMPIncomeStatementFetcher(Fetcher[FMPIncomeStatementQueryParams, FMPIncomeStatementData]):
    """FMP 손익계산서 Fetcher"""

    @staticmethod
    def transform_query(params: Dict[str, Any]) -> FMPIncomeStatementQueryParams:
        return FMPIncomeStatementQueryParams(**params)

    @staticmethod
    async def aextract_data(
        query: FMPIncomeStatementQueryParams,
        credentials: Optional[Dict[str, str]] = None,
        **kwargs: Any
    ) -> List[Dict[str, Any]]:
        api_key = get_api_key(credentials=credentials, api_name="FMP", env_var="FMP_API_KEY")
        params = {"symbol": query.symbol, "apikey": api_key, "limit": query.limit or 10}
        if query.period:
            params["period"] = query.period
        data = await amake_request(
            f"{FMP_STABLE_BASE}/income-statement",
            params=params,
            timeout=30,
        )
        if not isinstance(data, list):
            log.warning(f"Unexpected response format for {query.symbol}")
            return []
        return data

    @staticmethod
    def transform_data(
        query: FMPIncomeStatementQueryParams,
        data: List[Dict[str, Any]],
        **kwargs: Any
    ) -> List[FMPIncomeStatementData]:
        return [FMPIncomeStatementData.model_validate(d) for d in data]

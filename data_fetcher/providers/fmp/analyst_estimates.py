"""FMP Analyst Estimates — QueryParams + Data + Fetcher"""
import logging
from typing import Any, Dict, List, Optional

from pydantic import Field

from data_fetcher.abstract_provider.abstract.fetcher import Fetcher
from data_fetcher.abstract_provider.standard_models import AnalystEstimatesQueryParams, AnalystEstimatesData
from data_fetcher.utils.api_keys import get_api_key
from data_fetcher.utils.async_http_client import amake_request, HTTPClientError

log = logging.getLogger(__name__)

FMP_STABLE_BASE = "https://financialmodelingprep.com/stable"


# ── QueryParams ───────────────────────────────────────────────────────────────

class FMPAnalystEstimatesQueryParams(AnalystEstimatesQueryParams):
    """FMP 애널리스트 추정치 조회 파라미터 (AnalystEstimatesQueryParams 상속)"""
    page: Optional[int] = Field(default=0, description="페이지 번호")


# ── Data ──────────────────────────────────────────────────────────────────────

class FMPAnalystEstimatesData(AnalystEstimatesData):
    """FMP 애널리스트 추정치 데이터

    Standard fields covered:
        symbol, date,
        estimated_revenue_low/high/avg, number_analyst_estimated_revenue,
        estimated_eps_low/high/avg, number_analyst_estimated_eps,
        estimated_ebitda_low/high/avg,
        estimated_net_income_low/high/avg
    """
    number_analyst_estimated_ebitda: Optional[int] = Field(default=None, description="EBITDA 추정 애널리스트 수")
    estimated_ebit_low: Optional[float] = Field(default=None, description="EBIT 추정치 하한")
    estimated_ebit_high: Optional[float] = Field(default=None, description="EBIT 추정치 상한")
    estimated_ebit_avg: Optional[float] = Field(default=None, description="EBIT 추정치 평균")
    number_analyst_estimated_ebit: Optional[int] = Field(default=None, description="EBIT 추정 애널리스트 수")
    number_analyst_estimated_net_income: Optional[int] = Field(default=None, description="순이익 추정 애널리스트 수")
    estimated_sga_expense_low: Optional[float] = Field(default=None, description="판매관리비 추정치 하한")
    estimated_sga_expense_high: Optional[float] = Field(default=None, description="판매관리비 추정치 상한")
    estimated_sga_expense_avg: Optional[float] = Field(default=None, description="판매관리비 추정치 평균")
    number_analyst_estimated_sga_expense: Optional[int] = Field(default=None, description="판매관리비 추정 애널리스트 수")

    __alias_dict__ = {
        "estimated_revenue_low": "estimatedRevenueLow",
        "estimated_revenue_high": "estimatedRevenueHigh",
        "estimated_revenue_avg": "estimatedRevenueAvg",
        "number_analyst_estimated_revenue": "numberAnalystEstimatedRevenue",
        "estimated_eps_low": "estimatedEpsLow",
        "estimated_eps_high": "estimatedEpsHigh",
        "estimated_eps_avg": "estimatedEpsAvg",
        "number_analyst_estimated_eps": "numberAnalystsEstimatedEps",
        "estimated_ebitda_low": "estimatedEbitdaLow",
        "estimated_ebitda_high": "estimatedEbitdaHigh",
        "estimated_ebitda_avg": "estimatedEbitdaAvg",
        "estimated_net_income_low": "estimatedNetIncomeLow",
        "estimated_net_income_high": "estimatedNetIncomeHigh",
        "estimated_net_income_avg": "estimatedNetIncomeAvg",
        "number_analyst_estimated_ebitda": "numberAnalystsEstimatedEbitda",
        "estimated_ebit_low": "estimatedEbitLow",
        "estimated_ebit_high": "estimatedEbitHigh",
        "estimated_ebit_avg": "estimatedEbitAvg",
        "number_analyst_estimated_ebit": "numberAnalystsEstimatedEbit",
        "number_analyst_estimated_net_income": "numberAnalystsEstimatedNetIncome",
        "estimated_sga_expense_low": "estimatedSgaExpenseLow",
        "estimated_sga_expense_high": "estimatedSgaExpenseHigh",
        "estimated_sga_expense_avg": "estimatedSgaExpenseAvg",
        "number_analyst_estimated_sga_expense": "numberAnalystsEstimatedSgaExpense",
    }


# ── Fetcher ───────────────────────────────────────────────────────────────────

class FMPAnalystEstimatesFetcher(Fetcher[FMPAnalystEstimatesQueryParams, FMPAnalystEstimatesData]):
    """FMP 애널리스트 추정치 Fetcher"""

    @staticmethod
    def transform_query(params: Dict[str, Any]) -> FMPAnalystEstimatesQueryParams:
        return FMPAnalystEstimatesQueryParams(**params)

    @staticmethod
    async def aextract_data(
        query: FMPAnalystEstimatesQueryParams,
        credentials: Optional[Dict[str, str]] = None,
        **kwargs: Any
    ) -> List[Dict[str, Any]]:
        try:
            api_key = get_api_key(credentials=credentials, api_name="FMP", env_var="FMP_API_KEY")
            params = {
                "symbol": query.symbol,
                "period": query.period or "annual",
                "page": query.page or 0,
                "limit": query.limit or 10,
                "apikey": api_key,
            }
            data = await amake_request(f"{FMP_STABLE_BASE}/analyst-estimates", params=params, timeout=30)
            if not isinstance(data, list):
                log.warning(f"Unexpected response format for {query.symbol}")
                return []
            return data
        except HTTPClientError as e:
            log.error(f"Error fetching analyst estimates from FMP for {query.symbol}: {e}")
            raise
        except Exception as e:
            log.error(f"Unexpected error: {e}")
            raise

    @staticmethod
    def transform_data(
        query: FMPAnalystEstimatesQueryParams,
        data: List[Dict[str, Any]],
        **kwargs: Any
    ) -> List[FMPAnalystEstimatesData]:
        return [FMPAnalystEstimatesData.model_validate(d) for d in data]

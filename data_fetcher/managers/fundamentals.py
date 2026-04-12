"""
FundamentalsManager

재무제표 / 기업 펀더멘탈 관련 데이터 조회.
"""
from typing import Dict, List, Optional

from data_fetcher.query_executor import QueryExecutor
from data_fetcher.fetchers.base import AnnotatedResult
from data_fetcher.models.yahoo.financials import YFinanceFinancialsData
from data_fetcher.models.fmp.income_statement import IncomeStatementData
from data_fetcher.models.fmp.analyst_estimates import AnalystEstimatesData


class FundamentalsManager:
    """재무제표 / 펀더멘탈 데이터 관리"""

    # ── Yahoo ──────────────────────────────────────────────────────────────
    @classmethod
    async def yahoo_financials(
        cls,
        symbol: str,
        freq: str = "quarterly",
        limit: Optional[int] = None,
    ) -> List[YFinanceFinancialsData]:
        """Yahoo Finance 재무제표 조회"""
        raw = await QueryExecutor.fetch(
            provider="yahoo",
            model="financials",
            params={"symbol": symbol, "freq": freq},
        )
        result = raw.result if isinstance(raw, AnnotatedResult) else raw
        return result[:limit] if limit else result

    # ── FMP ────────────────────────────────────────────────────────────────
    @classmethod
    async def fmp_income_statement(
        cls,
        symbol: str,
        period: str = "annual",
        limit: int = 5,
        credentials: Optional[Dict] = None,
    ) -> List[IncomeStatementData]:
        """FMP 손익계산서 조회"""
        raw = await QueryExecutor.fetch(
            provider="fmp",
            model="income_statement",
            params={"symbol": symbol, "period": period, "limit": limit},
            credentials=credentials,
        )
        return raw.result if isinstance(raw, AnnotatedResult) else raw

    @classmethod
    async def fmp_analyst_estimates(
        cls,
        symbol: str,
        period: str = "annual",
        limit: int = 5,
        credentials: Optional[Dict] = None,
    ) -> List[AnalystEstimatesData]:
        """FMP 애널리스트 추정치 조회"""
        raw = await QueryExecutor.fetch(
            provider="fmp",
            model="analyst_estimates",
            params={"symbol": symbol, "period": period, "limit": limit},
            credentials=credentials,
        )
        return raw.result if isinstance(raw, AnnotatedResult) else raw

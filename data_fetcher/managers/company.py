"""
CompanyManager

기업 정보 / 프로필 관련 데이터 조회.
"""
from typing import Dict, List, Optional

from data_fetcher.query_executor import QueryExecutor
from data_fetcher.fetchers.base import AnnotatedResult
from data_fetcher.models.yahoo.company_info import YFinanceCompanyInfoData
from data_fetcher.models.fmp.company_profile import CompanyProfileData


class CompanyManager:
    """기업 정보 데이터 관리"""

    # ── Yahoo ──────────────────────────────────────────────────────────────
    @classmethod
    async def yahoo_company_info(
        cls,
        symbol: str,
    ) -> Optional[YFinanceCompanyInfoData]:
        """Yahoo Finance 기업 정보 조회"""
        raw = await QueryExecutor.fetch(
            provider="yahoo",
            model="company_info",
            params={"symbol": symbol},
        )
        result = raw.result if isinstance(raw, AnnotatedResult) else raw
        return result[0] if result else None

    # ── FMP ────────────────────────────────────────────────────────────────
    @classmethod
    async def fmp_company_profile(
        cls,
        symbol: str,
        credentials: Optional[Dict] = None,
    ) -> Optional[CompanyProfileData]:
        """FMP 기업 프로필 조회"""
        raw = await QueryExecutor.fetch(
            provider="fmp",
            model="company_profile",
            params={"symbol": symbol},
            credentials=credentials,
        )
        result = raw.result if isinstance(raw, AnnotatedResult) else raw
        return result[0] if result else None

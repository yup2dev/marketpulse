"""Yahoo Finance 기업 정보 서비스."""
from typing import Optional

from data_fetcher.query_executor import QueryExecutor
from data_fetcher.fetchers.base import AnnotatedResult
from data_fetcher.models.yahoo.company_info import YFinanceCompanyInfoData
from data_fetcher.models.yahoo.key_metrics import YFinanceKeyMetricsData
from data_fetcher.models.yahoo.management import YFinanceManagementData
from data_fetcher.models.yahoo.moat import YFinanceMoatData
from data_fetcher.models.yahoo.swot import YFinanceSWOTData
from data_fetcher.models.yahoo.scorecard import YFinanceScorecardData


def _first(raw):
    result = raw.result if isinstance(raw, AnnotatedResult) else raw
    return result[0] if result else None


async def get_company_info(symbol: str) -> Optional[YFinanceCompanyInfoData]:
    return _first(await QueryExecutor.fetch("yahoo", "company_info", {"symbol": symbol}))


async def get_key_metrics(symbol: str) -> Optional[YFinanceKeyMetricsData]:
    return _first(await QueryExecutor.fetch("yahoo", "key_metrics", {"symbol": symbol}))


async def get_management(symbol: str) -> Optional[YFinanceManagementData]:
    return _first(await QueryExecutor.fetch("yahoo", "management", {"symbol": symbol}))


async def get_moat_analysis(symbol: str) -> Optional[YFinanceMoatData]:
    return _first(await QueryExecutor.fetch("yahoo", "moat", {"symbol": symbol}))


async def get_swot(symbol: str) -> Optional[YFinanceSWOTData]:
    return _first(await QueryExecutor.fetch("yahoo", "swot", {"symbol": symbol}))


async def get_scorecard(symbol: str) -> Optional[YFinanceScorecardData]:
    return _first(await QueryExecutor.fetch("yahoo", "scorecard", {"symbol": symbol}))

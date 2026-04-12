"""Yahoo Finance 재무제표 / 이벤트 서비스."""
from typing import List, Optional

from data_fetcher.query_executor import QueryExecutor
from data_fetcher.fetchers.base import AnnotatedResult
from data_fetcher.models.yahoo.financials import YFinanceFinancialsData
from data_fetcher.models.yahoo.balance_sheet import YFinanceBalanceSheetData
from data_fetcher.models.yahoo.quarterly_pnl import YFinanceQuarterlyPnLData
from data_fetcher.models.yahoo.estimates import YFinanceEstimatesData
from data_fetcher.models.yahoo.dividends import YFinanceDividendData
from data_fetcher.models.yahoo.splits import YFinanceSplitData
from data_fetcher.models.yahoo.filings import YFinanceFilingData
from data_fetcher.models.yahoo.calendar import YFinanceCalendarData


def _unwrap(raw):
    return raw.result if isinstance(raw, AnnotatedResult) else raw


def _first(raw):
    result = _unwrap(raw)
    return result[0] if result else None


async def get_financials(
    symbol: str,
    freq: str = "quarterly",
    limit: int = 4,
) -> List[YFinanceFinancialsData]:
    raw = await QueryExecutor.fetch("yahoo", "financials", {"symbol": symbol, "freq": freq})
    return _unwrap(raw)[:limit]


async def get_balance_sheet(
    symbol: str,
    period: str = "annual",
    limit: int = 5,
) -> List[YFinanceBalanceSheetData]:
    raw = await QueryExecutor.fetch(
        "yahoo", "balance_sheet",
        {"symbol": symbol, "period": period, "limit": min(limit, 5)},
    )
    return _unwrap(raw)


async def get_quarterly_pnl(
    symbol: str,
    limit: int = 12,
) -> Optional[YFinanceQuarterlyPnLData]:
    return _first(await QueryExecutor.fetch("yahoo", "quarterly_pnl", {"symbol": symbol, "limit": limit}))


async def get_estimates(symbol: str) -> Optional[YFinanceEstimatesData]:
    return _first(await QueryExecutor.fetch("yahoo", "estimates", {"symbol": symbol}))


async def get_dividends(symbol: str, limit: int = 20) -> List[YFinanceDividendData]:
    raw = await QueryExecutor.fetch("yahoo", "dividends", {"symbol": symbol})
    return _unwrap(raw)[:limit]


async def get_splits(symbol: str, limit: int = 20) -> List[YFinanceSplitData]:
    raw = await QueryExecutor.fetch("yahoo", "splits", {"symbol": symbol, "limit": limit})
    return _unwrap(raw)


async def get_filings(symbol: str, limit: int = 20) -> List[YFinanceFilingData]:
    raw = await QueryExecutor.fetch("yahoo", "filings", {"symbol": symbol, "limit": limit})
    return _unwrap(raw)


async def get_calendar(
    symbol: str,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
) -> Optional[YFinanceCalendarData]:
    params = {"symbol": symbol}
    if start_date:
        params["start_date"] = start_date
    if end_date:
        params["end_date"] = end_date
    return _first(await QueryExecutor.fetch("yahoo", "calendar", params))

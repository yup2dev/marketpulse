"""Yahoo Finance 보유자 / 내부자 거래 서비스."""
from typing import List, Optional

from data_fetcher.query_executor import QueryExecutor
from data_fetcher.fetchers.base import AnnotatedResult
from data_fetcher.models.yahoo.holders import YFinanceHoldersData
from data_fetcher.models.yahoo.insider_trading import (
    YFinanceInsiderHolderData,
    YFinanceInsiderTradingSummaryData,
)


def _unwrap(raw):
    return raw.result if isinstance(raw, AnnotatedResult) else raw


def _first(raw):
    result = _unwrap(raw)
    return result[0] if result else None


async def get_holders(symbol: str) -> Optional[YFinanceHoldersData]:
    return _first(await QueryExecutor.fetch("yahoo", "holders", {"symbol": symbol}))


async def get_insider_trading(
    symbol: str,
    limit: int = 50,
) -> Optional[YFinanceInsiderTradingSummaryData]:
    return _first(await QueryExecutor.fetch(
        "yahoo", "insider_trading_summary",
        {"symbol": symbol, "limit": limit},
    ))


async def get_insider_holders(symbol: str) -> List[YFinanceInsiderHolderData]:
    raw = await QueryExecutor.fetch("yahoo", "insider_holders", {"symbol": symbol})
    return _unwrap(raw)

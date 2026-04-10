"""Institutional holders and insider trading methods."""
from typing import List, Optional

from data_fetcher.models.yahoo.holders import YFinanceHoldersQueryParams, YFinanceHoldersData
from data_fetcher.models.yahoo.insider_trading import (
    YFinanceInsiderTradingQueryParams,
    YFinanceInsiderHolderData,
    YFinanceInsiderTradingSummaryData,
)
from ._base import YFinanceInsiderHoldersQueryParams


class HoldersMixin:

    async def get_holders(self, symbol: str) -> Optional[YFinanceHoldersData]:
        """Get institutional and insider holder information."""
        return await self.yfinance.fetch_one(
            YFinanceHoldersQueryParams(symbol=symbol)
        )

    async def get_insider_trading(
        self, symbol: str, limit: int = 50
    ) -> Optional[YFinanceInsiderTradingSummaryData]:
        """Get insider trading data with buy/sell summary."""
        return await self.yfinance.fetch_one(
            YFinanceInsiderTradingQueryParams(symbol=symbol, limit=limit)
        )

    async def get_insider_holders(self, symbol: str) -> List[YFinanceInsiderHolderData]:
        """Get insider holders (roster) information."""
        return await self.yfinance.fetch(
            YFinanceInsiderHoldersQueryParams(symbol=symbol)
        )

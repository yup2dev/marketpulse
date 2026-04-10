"""Financials, balance sheet, estimates, dividends, splits, filings, calendar."""
from typing import List, Optional

from data_fetcher.models.yahoo.financials import YFinanceFinancialsQueryParams, YFinanceFinancialsData
from data_fetcher.models.yahoo.balance_sheet import YFinanceBalanceSheetQueryParams, YFinanceBalanceSheetData
from data_fetcher.models.yahoo.quarterly_pnl import YFinanceQuarterlyPnLQueryParams, YFinanceQuarterlyPnLData
from data_fetcher.models.yahoo.estimates import YFinanceEstimatesQueryParams, YFinanceEstimatesData
from data_fetcher.models.yahoo.dividends import YFinanceDividendsQueryParams, YFinanceDividendData
from data_fetcher.models.yahoo.splits import YFinanceSplitsQueryParams, YFinanceSplitData
from data_fetcher.models.yahoo.filings import YFinanceFilingsQueryParams, YFinanceFilingData
from data_fetcher.models.yahoo.calendar import YFinanceCalendarQueryParams, YFinanceCalendarData


class FinancialsMixin:

    async def get_financials(
        self,
        symbol: str,
        freq: str = 'quarterly',
        limit: int = 4,
    ) -> List[YFinanceFinancialsData]:
        """Get financial statements."""
        return await self.yfinance.fetch(
            YFinanceFinancialsQueryParams(symbol=symbol, freq=freq),
            limit=limit,
        )

    async def get_balance_sheet(
        self,
        symbol: str,
        period: str = 'annual',
        limit: int = 5,
    ) -> List[YFinanceBalanceSheetData]:
        """Get balance sheet data."""
        return await self.yfinance.fetch(
            YFinanceBalanceSheetQueryParams(symbol=symbol, period=period, limit=min(limit, 5))
        )

    async def get_quarterly_pnl(
        self, symbol: str, limit: int = 12
    ) -> Optional[YFinanceQuarterlyPnLData]:
        """Get quarterly P&L breakdown."""
        return await self.yfinance.fetch_one(
            YFinanceQuarterlyPnLQueryParams(symbol=symbol, limit=limit)
        )

    async def get_estimates(self, symbol: str) -> Optional[YFinanceEstimatesData]:
        """Get analyst estimates for EPS and revenue."""
        return await self.yfinance.fetch_one(
            YFinanceEstimatesQueryParams(symbol=symbol)
        )

    async def get_dividends(self, symbol: str, limit: int = 20) -> List[YFinanceDividendData]:
        """Get dividend history."""
        return await self.yfinance.fetch(
            YFinanceDividendsQueryParams(symbol=symbol),
            limit=limit,
        )

    async def get_splits(self, symbol: str, limit: int = 20) -> List[YFinanceSplitData]:
        """Get stock split history."""
        return await self.yfinance.fetch(
            YFinanceSplitsQueryParams(symbol=symbol, limit=limit)
        )

    async def get_filings(self, symbol: str, limit: int = 20) -> List[YFinanceFilingData]:
        """Get SEC filings."""
        return await self.yfinance.fetch(
            YFinanceFilingsQueryParams(symbol=symbol, limit=limit)
        )

    async def get_calendar(
        self,
        symbol: str,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
    ) -> Optional[YFinanceCalendarData]:
        """Get company calendar events."""
        return await self.yfinance.fetch_one(
            YFinanceCalendarQueryParams(symbol=symbol, start_date=start_date, end_date=end_date)
        )

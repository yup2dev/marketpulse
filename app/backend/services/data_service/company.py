"""Company info, metrics, and analysis methods."""
from typing import Optional

from data_fetcher.models.yahoo.company_info import YFinanceCompanyInfoQueryParams, YFinanceCompanyInfoData
from data_fetcher.models.yahoo.key_metrics import YFinanceKeyMetricsQueryParams, YFinanceKeyMetricsData
from data_fetcher.models.yahoo.management import YFinanceManagementQueryParams, YFinanceManagementData
from data_fetcher.models.yahoo.moat import YFinanceMoatQueryParams, YFinanceMoatData
from data_fetcher.models.yahoo.swot import YFinanceSWOTQueryParams, YFinanceSWOTData
from data_fetcher.models.yahoo.scorecard import YFinanceScorecardQueryParams, YFinanceScorecardData


class CompanyMixin:

    async def get_company_info(self, symbol: str) -> Optional[YFinanceCompanyInfoData]:
        """Get company information."""
        return await self.yfinance.fetch_one(
            YFinanceCompanyInfoQueryParams(symbol=symbol)
        )

    async def get_key_metrics(self, symbol: str) -> Optional[YFinanceKeyMetricsData]:
        """Get key financial metrics and ratios."""
        return await self.yfinance.fetch_one(
            YFinanceKeyMetricsQueryParams(symbol=symbol)
        )

    async def get_management(self, symbol: str) -> Optional[YFinanceManagementData]:
        """Get management team and governance risk data."""
        return await self.yfinance.fetch_one(
            YFinanceManagementQueryParams(symbol=symbol)
        )

    async def get_moat_analysis(self, symbol: str) -> Optional[YFinanceMoatData]:
        """Get 10-year moat metrics: ROE, ROIC, margins, FCF margin."""
        return await self.yfinance.fetch_one(
            YFinanceMoatQueryParams(symbol=symbol)
        )

    async def get_swot(self, symbol: str) -> Optional[YFinanceSWOTData]:
        """Auto-derive SWOT items from yfinance info + analyst data."""
        return await self.yfinance.fetch_one(
            YFinanceSWOTQueryParams(symbol=symbol)
        )

    async def get_scorecard(self, symbol: str) -> Optional[YFinanceScorecardData]:
        """Compute 5-category investment scorecard (0–100 each)."""
        return await self.yfinance.fetch_one(
            YFinanceScorecardQueryParams(symbol=symbol)
        )

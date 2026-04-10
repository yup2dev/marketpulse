"""Earnings, news, sentiment, analyst, search, and revenue methods."""
from typing import Any, Dict, List, Optional

from data_fetcher.models.polygon.earnings import EarningsQueryParams, EarningsData
from data_fetcher.models.polygon.news import NewsQueryParams, NewsData
from data_fetcher.models.polygon.sentiment import PolygonStockSentimentQueryParams, PolygonStockSentimentData
from data_fetcher.models.social.sentiment import SocialSentimentQueryParams, SocialSentimentData
from data_fetcher.models.fmp.analyst_data import FMPAnalystDataQueryParams, FMPAnalystDataData
from data_fetcher.models.fmp.revenue_segments import FMPRevenueSegmentsQueryParams, FMPRevenueSegmentsData
from data_fetcher.models.fmp.search import FMPSearchQueryParams, FMPSearchData
from data_fetcher.models.fmp.active_stocks import FMPActiveStocksQueryParams


class MarketMixin:

    async def get_earnings(self, symbol: str, limit: int = 8) -> List[EarningsData]:
        """Get earnings data."""
        return await self.polygon.fetch(
            EarningsQueryParams(ticker=symbol, limit=limit)
        )

    async def get_news(
        self, symbol: Optional[str] = None, limit: int = 10
    ) -> List[NewsData]:
        """Get market news."""
        return await self.polygon.fetch(
            NewsQueryParams(ticker=symbol),
            limit=limit,
        )

    async def get_stock_sentiment(self, symbol: str) -> Optional[PolygonStockSentimentData]:
        """Aggregate news sentiment from Polygon news feed."""
        return await self.polygon.fetch_one(
            PolygonStockSentimentQueryParams(ticker=symbol)
        )

    async def get_social_sentiment(self, symbol: str) -> Optional[SocialSentimentData]:
        """Fetch Reddit + StockTwits social sentiment."""
        return await self.social.fetch_one(
            SocialSentimentQueryParams(symbol=symbol)
        )

    async def get_analyst_data(self, symbol: str) -> Optional[FMPAnalystDataData]:
        """Get analyst recommendations and price targets."""
        return await self.fmp.fetch_one(
            FMPAnalystDataQueryParams(symbol=symbol)
        )

    async def get_revenue_segments(
        self, symbol: str, limit: int = 8
    ) -> Optional[FMPRevenueSegmentsData]:
        """Get revenue breakdown by segment and geography."""
        return await self.fmp.fetch_one(
            FMPRevenueSegmentsQueryParams(symbol=symbol, limit=limit)
        )

    async def search_stocks(self, query: str, limit: int = 10) -> List[Dict[str, Any]]:
        """Search for stocks by symbol or company name."""
        results: List[FMPSearchData] = await self.fmp.fetch(
            FMPSearchQueryParams(query=query, limit=limit)
        )
        if results:
            return [
                {
                    'symbol': r.symbol,
                    'name': r.name,
                    'exchange': r.exchange_short_name or r.stock_exchange,
                    'currency': r.currency,
                }
                for r in results
            ]
        # Fallback: active stocks filtered by query string
        actives = await self.fmp.fetch(FMPActiveStocksQueryParams(type='actives'))
        if actives:
            q = query.upper()
            return [
                {'symbol': a.symbol, 'name': a.name, 'exchange': 'NASDAQ', 'currency': 'USD'}
                for a in actives
                if q in (a.symbol or '').upper() or q in (a.name or '').upper()
            ][:limit]
        return []

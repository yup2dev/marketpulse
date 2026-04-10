"""Price & Quote methods."""
import asyncio
from typing import Dict, Any, List, Optional

from data_fetcher.fetchers.polygon.orderbook import fetch_stock_orderbook
from data_fetcher.models.yahoo.stock_price import YFinanceStockPriceQueryParams, YFinanceStockPriceData


class PriceMixin:

    async def get_stock_quote(self, symbol: str) -> Dict[str, Any]:
        """Get current stock quote."""
        prices: List[YFinanceStockPriceData] = await self.yfinance.fetch(
            YFinanceStockPriceQueryParams(
                symbol=self._map_symbol(symbol), interval='1d', period='5d'
            )
        )
        if prices:
            latest = prices[-1]
            return {
                'symbol': symbol,
                'price': latest.close,
                'change': latest.price_change,
                'change_percent': latest.price_change_pct,
                'volume': latest.volume,
                'timestamp': latest.date,
                'high': latest.high,
                'low': latest.low,
                'open': latest.open,
            }
        return {}

    async def get_stock_history(
        self,
        symbol: str,
        period: Optional[str] = None,
        interval: Optional[str] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
    ) -> List[YFinanceStockPriceData]:
        """Get historical stock prices."""
        if not interval:
            interval = self._get_default_interval(period)
        mapped = self._map_symbol(symbol)
        if start_date and end_date:
            query = YFinanceStockPriceQueryParams(
                symbol=mapped, interval=interval,
                start_date=start_date, end_date=end_date,
            )
        else:
            query = YFinanceStockPriceQueryParams(
                symbol=mapped, interval=interval, period=period or '1mo'
            )
        return await self.yfinance.fetch(query)

    async def get_stock_orderbook(self, symbol: str) -> dict:
        """Fetch approximate order book via Polygon NBBO quotes."""
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, fetch_stock_orderbook, symbol)

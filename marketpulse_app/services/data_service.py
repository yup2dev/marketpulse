"""
Data Service - Integration with data_fetcher
Provides unified interface for fetching financial data
"""
import sys
from pathlib import Path
from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta

# Ensure data_fetcher is in path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from data_fetcher.fetchers.yahoo.stock_price import YahooStockPriceFetcher
from data_fetcher.fetchers.yahoo.company_info import YahooCompanyInfoFetcher
from data_fetcher.fetchers.fred.gdp import FREDGDPFetcher
from data_fetcher.fetchers.fred.unemployment import FREDUnemploymentFetcher
from data_fetcher.fetchers.fred.cpi import FREDCPIFetcher
from data_fetcher.fetchers.fred.interest_rate import FREDInterestRateFetcher
from data_fetcher.fetchers.polygon.news import PolygonNewsFetcher


class DataService:
    """Unified data service for fetching market data"""

    async def get_stock_quote(self, symbol: str) -> Dict[str, Any]:
        """Get current stock quote"""
        try:
            result = await YahooStockPriceFetcher.fetch_data({
                'symbol': symbol,
                'interval': '1d'
            })

            if result:
                latest = result[-1]
                return {
                    'symbol': symbol,
                    'price': latest.close,
                    'change': latest.close - latest.open if latest.open else 0,
                    'change_percent': ((latest.close - latest.open) / latest.open * 100) if latest.open else 0,
                    'volume': latest.volume,
                    'timestamp': latest.date.isoformat() if latest.date else None,
                    'high': latest.high,
                    'low': latest.low,
                    'open': latest.open
                }
        except Exception as e:
            print(f"Error fetching stock quote: {e}")

        return {}

    async def get_stock_history(self, symbol: str, period: str = "1mo") -> List[Dict[str, Any]]:
        """Get historical stock prices"""
        try:
            result = await YahooStockPriceFetcher.fetch_data({
                'symbol': symbol,
                'interval': '1d'
            })

            if result:
                return [
                    {
                        'date': data.date.isoformat() if data.date else None,
                        'open': data.open,
                        'high': data.high,
                        'low': data.low,
                        'close': data.close,
                        'volume': data.volume
                    }
                    for data in result
                ]
        except Exception as e:
            print(f"Error fetching stock history: {e}")

        return []

    async def get_company_info(self, symbol: str) -> Dict[str, Any]:
        """Get company information"""
        try:
            result = await YahooCompanyInfoFetcher.fetch_data({'symbol': symbol})

            if result and len(result) > 0:
                data = result[0]
                return {
                    'symbol': symbol,
                    'name': data.company_name,
                    'sector': data.sector,
                    'industry': data.industry,
                    'description': data.description,
                    'website': data.website,
                    'employees': data.employees if hasattr(data, 'employees') else None,
                    'market_cap': data.market_cap,
                    'country': data.country,
                    'city': data.city if hasattr(data, 'city') else None,
                    'address': data.address if hasattr(data, 'address') else None
                }
        except Exception as e:
            print(f"Error fetching company info: {e}")

        return {}

    async def get_economic_indicators(self) -> Dict[str, Any]:
        """Get key economic indicators"""
        indicators = {}

        try:
            # GDP
            gdp_result = await FREDGDPFetcher.fetch_data({})
            if gdp_result and len(gdp_result) > 0:
                gdp = gdp_result[0]
                indicators['gdp'] = {
                    'value': gdp.value,
                    'date': gdp.date.isoformat() if gdp.date else None,
                    'unit': gdp.unit
                }
        except Exception as e:
            print(f"Error fetching GDP: {e}")

        try:
            # Unemployment
            unemployment_result = await FREDUnemploymentFetcher.fetch_data({})
            if unemployment_result and len(unemployment_result) > 0:
                unemployment = unemployment_result[0]
                indicators['unemployment'] = {
                    'value': unemployment.value,
                    'date': unemployment.date.isoformat() if unemployment.date else None,
                    'unit': '%'
                }
        except Exception as e:
            print(f"Error fetching unemployment: {e}")

        try:
            # CPI (Inflation)
            cpi_result = await FREDCPIFetcher.fetch_data({})
            if cpi_result and len(cpi_result) > 0:
                cpi = cpi_result[0]
                indicators['cpi'] = {
                    'value': cpi.value,
                    'date': cpi.date.isoformat() if cpi.date else None,
                    'unit': 'Index'
                }
        except Exception as e:
            print(f"Error fetching CPI: {e}")

        try:
            # Interest Rate - provide required rate_type parameter
            rate_result = await FREDInterestRateFetcher.fetch_data({'rate_type': 'DFF'})
            if rate_result and len(rate_result) > 0:
                rate = rate_result[0]
                indicators['interest_rate'] = {
                    'value': rate.value,
                    'date': rate.date.isoformat() if rate.date else None,
                    'unit': '%'
                }
        except Exception as e:
            print(f"Error fetching interest rate: {e}")

        return indicators

    async def get_news(self, symbol: Optional[str] = None, limit: int = 10) -> List[Dict[str, Any]]:
        """Get market news"""
        try:
            params = {}
            if symbol:
                params['ticker'] = symbol

            result = await PolygonNewsFetcher.fetch_data(params)

            if result:
                return [
                    {
                        'title': news.title,
                        'description': news.description,
                        'url': news.article_url,
                        'published_at': news.published_utc.isoformat() if news.published_utc else None,
                        'source': news.publisher_name,
                        'image_url': news.image_url,
                        'tickers': news.tickers
                    }
                    for news in result[:limit]
                ]
        except Exception as e:
            print(f"Error fetching news: {e}")

        return []


# Singleton instance
data_service = DataService()

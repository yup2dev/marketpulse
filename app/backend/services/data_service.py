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
from data_fetcher.fetchers.yahoo.financials import YahooFinancialsFetcher
from data_fetcher.fetchers.fred.gdp import FREDGDPFetcher
from data_fetcher.fetchers.fred.unemployment import FREDUnemploymentFetcher
from data_fetcher.fetchers.fred.cpi import FREDCPIFetcher
from data_fetcher.fetchers.fred.interest_rate import FREDInterestRateFetcher
from data_fetcher.fetchers.polygon.news import PolygonNewsFetcher
from data_fetcher.fetchers.fmp.search import FMPSearchFetcher


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
                'period': period,
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

    async def get_indicator_history(self, indicator: str) -> List[Dict[str, Any]]:
        """Get historical data for an economic indicator"""
        try:
            result = None

            if indicator == 'GDP':
                result = await FREDGDPFetcher.fetch_data({})
            elif indicator == 'UNEMPLOYMENT':
                result = await FREDUnemploymentFetcher.fetch_data({})
            elif indicator == 'CPI':
                result = await FREDCPIFetcher.fetch_data({})
            elif indicator == 'INTEREST_RATE':
                result = await FREDInterestRateFetcher.fetch_data({'rate_type': 'DFF'})

            if result:
                return [
                    {
                        'date': data.date.isoformat() if data.date else None,
                        'value': data.value
                    }
                    for data in result
                ]
        except Exception as e:
            print(f"Error fetching indicator history: {e}")

        return []

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

    async def get_financials(self, symbol: str, freq: str = 'quarterly', limit: int = 4) -> Dict[str, Any]:
        """
        Get financial statements for a company

        Args:
            symbol: Stock symbol
            freq: Frequency - 'quarterly' or 'annual'
            limit: Number of periods to return (default 4)
        """
        try:
            result = await YahooFinancialsFetcher.fetch_data({
                'symbol': symbol,
                'freq': freq
            })

            if result and len(result) > 0:
                # Return multiple periods for comparison
                periods = []
                for data in result[:limit]:
                    period = {
                        'date': data.as_of_date.isoformat() if data.as_of_date else None,
                        'period_type': freq,
                        'income_statement': {
                            'revenue': data.total_revenue,
                            'cost_of_revenue': data.cost_of_revenue,
                            'gross_profit': data.gross_profit,
                            'operating_expenses': data.operating_expense,
                            'operating_income': data.operating_income,
                            'net_income': data.net_income,
                            'ebitda': data.ebitda,
                            'basic_eps': data.basic_eps,
                            'diluted_eps': data.diluted_eps
                        },
                        'balance_sheet': {
                            'total_assets': data.total_assets,
                            'current_assets': data.current_assets,
                            'cash': data.cash,
                            'total_liabilities': data.total_liabilities_net_minority_interest,
                            'current_liabilities': data.current_liabilities,
                            'total_equity': data.stockholders_equity,
                            'total_debt': data.total_debt
                        },
                        'cash_flow': {
                            'operating_cash_flow': data.operating_cash_flow,
                            'investing_cash_flow': data.investing_cash_flow,
                            'financing_cash_flow': data.financing_cash_flow,
                            'free_cash_flow': data.free_cash_flow,
                            'capital_expenditure': data.capital_expenditure
                        }
                    }
                    periods.append(period)

                return {
                    'symbol': symbol,
                    'frequency': freq,
                    'periods': periods
                }
        except Exception as e:
            print(f"Error fetching financials: {e}")

        return {}

    async def search_stocks(self, query: str, limit: int = 10) -> List[Dict[str, Any]]:
        """
        Search for stocks by symbol or company name

        Args:
            query: Search query (symbol or company name)
            limit: Maximum number of results

        Returns:
            List of matching stocks with symbol and name
        """
        try:
            result = await FMPSearchFetcher.fetch_data({
                'query': query,
                'limit': limit
            })

            if result:
                return [
                    {
                        'symbol': stock.symbol,
                        'name': stock.name,
                        'exchange': stock.exchange_short_name or stock.stock_exchange,
                        'currency': stock.currency
                    }
                    for stock in result
                ]
        except Exception as e:
            print(f"Error searching stocks: {e}")

        return []


# Singleton instance
data_service = DataService()

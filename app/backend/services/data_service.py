"""
Data Service - Integration with data_fetcher
Provides unified interface for fetching financial data
"""
import sys
import asyncio
import logging
from pathlib import Path
from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta
import pandas as pd

log = logging.getLogger(__name__)

# Ensure data_fetcher is in path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from data_fetcher.fetchers.yahoo.stock_price import YahooStockPriceFetcher
from data_fetcher.fetchers.yahoo.company_info import YahooCompanyInfoFetcher
from data_fetcher.fetchers.yahoo.financials import YahooFinancialsFetcher
from data_fetcher.fetchers.yahoo.dividends import YahooDividendsFetcher
from data_fetcher.fetchers.yahoo.insider_trading import YahooInsiderTradingFetcher, YahooInsiderHoldersFetcher
from data_fetcher.fetchers.polygon.earnings import PolygonEarningsFetcher
from data_fetcher.fetchers.polygon.insider_trading import PolygonInsiderTradingFetcher
from data_fetcher.fetchers.fmp.analyst_recommendations import FMPAnalystRecommendationsFetcher
from data_fetcher.fetchers.fred.gdp import FREDGDPFetcher
from data_fetcher.fetchers.fred.unemployment import FREDUnemploymentFetcher
from data_fetcher.fetchers.fred.cpi import FREDCPIFetcher
from data_fetcher.fetchers.fred.interest_rate import FREDInterestRateFetcher
from data_fetcher.fetchers.fred.retail_sales import FREDRetailSalesFetcher
from data_fetcher.fetchers.fred.consumer_sentiment import FREDConsumerSentimentFetcher
from data_fetcher.fetchers.fred.nonfarm_payroll import FREDNonfarmPayrollFetcher
from data_fetcher.fetchers.fred.employment import FREDEmploymentFetcher
from data_fetcher.fetchers.fred.housing_starts import FREDHousingStartsFetcher
from data_fetcher.fetchers.fred.industrial_production import FREDIndustrialProductionFetcher
from data_fetcher.fetchers.polygon.news import PolygonNewsFetcher
from data_fetcher.fetchers.polygon.orderbook import fetch_stock_orderbook
from data_fetcher.fetchers.fmp.search import FMPSearchFetcher
from data_fetcher.fetchers.fmp.active_stocks import FMPActiveStocksFetcher
from data_fetcher.utils.helpers import parse_period_to_dates


class DataService:
    """Unified data service for fetching market data"""

    # 심볼 매핑 (검색 결과 심볼 -> Yahoo Finance 심볼)
    SYMBOL_MAPPING = {
        'KOSPI200.KS': '^KS200',
        'KOSPI200': '^KS200',
        'KOSPI.KS': '^KS11',
        'KOSPI': '^KS11',
        'KOSDAQ.KS': '^KQ11',
        'KOSDAQ': '^KQ11',
    }

    def _map_symbol(self, symbol: str) -> str:
        """심볼을 Yahoo Finance 형식으로 변환"""
        return self.SYMBOL_MAPPING.get(symbol.upper(), symbol)

    def _get_default_interval(self, period: str) -> str:
        """Get appropriate interval based on period to maintain consistent bar count"""
        interval_map = {
            '1d': '5m',    # ~78 bars (market hours)
            '5d': '30m',   # ~65 bars
            '1mo': '1h',   # ~130 bars
            '3mo': '1d',   # ~63 bars
            '6mo': '1d',   # ~126 bars
            '1y': '1d',    # ~252 bars
            '2y': '1wk',   # ~104 bars
            '5y': '1wk',   # ~260 bars
            '10y': '1mo',  # ~120 bars
            'max': '1mo',  # variable
        }
        return interval_map.get(period, '1d')

    async def get_stock_quote(self, symbol: str) -> Dict[str, Any]:
        """Get current stock quote"""
        mapped_symbol = self._map_symbol(symbol)
        try:
            result = await YahooStockPriceFetcher.fetch_data({
                'symbol': mapped_symbol,
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
            log.error(f"Error fetching stock quote: {e}")

        return {}

    async def get_stock_history(
        self,
        symbol: str,
        period: str = None,
        interval: str = None,
        start_date: str = None,
        end_date: str = None
    ) -> List[Dict[str, Any]]:
        """Get historical stock prices"""
        mapped_symbol = self._map_symbol(symbol)
        try:
            # Determine appropriate interval based on period if not specified
            if not interval:
                interval = self._get_default_interval(period)

            params = {
                'symbol': mapped_symbol,
                'interval': interval
            }

            # Use custom date range if provided, otherwise use period
            if start_date and end_date:
                params['start_date'] = start_date
                params['end_date'] = end_date
                log.debug(f"DATA_SERVICE - Using date range: {start_date} to {end_date}")
                # Do NOT set period when using date range
            elif period:
                params['period'] = period
                log.debug(f"DATA_SERVICE - Using period: {period}")
            else:
                # Default to 1 month if nothing provided
                params['period'] = '1mo'
                log.debug(f"DATA_SERVICE - Using default period: 1mo")

            log.debug(f"DATA_SERVICE - Final params: {params}")

            result = await YahooStockPriceFetcher.fetch_data(params)
            return YahooStockPriceFetcher.set_data(result)
        except Exception as e:
            log.error(f"Error fetching stock history: {e}")

        return []

    async def get_company_info(self, symbol: str) -> Dict[str, Any]:
        """Get company information"""
        try:
            result = await YahooCompanyInfoFetcher.fetch_data({'symbol': symbol})

            if result:
                return YahooCompanyInfoFetcher.set_data(result)[0]
        except Exception as e:
            log.error(f"Error fetching company info: {e}")

        return {}

    async def get_key_metrics(self, symbol: str) -> Dict[str, Any]:
        """
        Get key financial metrics and ratios for a company using yfinance

        Args:
            symbol: Stock symbol

        Returns:
            Dictionary with valuation, profitability, and other key metrics
        """
        try:
            import yfinance as yf
            ticker = yf.Ticker(symbol)
            info = ticker.info

            return {
                'symbol': symbol,
                # Valuation Multiples
                'pe_ratio': info.get('trailingPE'),
                'forward_pe': info.get('forwardPE'),
                'peg_ratio': info.get('pegRatio'),
                'ps_ratio': info.get('priceToSalesTrailing12Months'),
                'pb_ratio': info.get('priceToBook'),
                'ev_ebitda': info.get('enterpriseToEbitda'),
                'ev_revenue': info.get('enterpriseToRevenue'),
                'price_to_fcf': info.get('priceToFreeCashflow') if info.get('priceToFreeCashflow') else None,
                # Profitability
                'gross_margin': info.get('grossMargins'),
                'operating_margin': info.get('operatingMargins'),
                'net_margin': info.get('profitMargins'),
                'roe': info.get('returnOnEquity'),
                'roa': info.get('returnOnAssets'),
                # Liquidity & Leverage
                'current_ratio': info.get('currentRatio'),
                'quick_ratio': info.get('quickRatio'),
                'debt_to_equity': info.get('debtToEquity'),
                # Cash Flow
                'operating_cash_flow': info.get('operatingCashflow'),
                'free_cash_flow': info.get('freeCashflow'),
                # Per Share Data
                'eps_trailing': info.get('trailingEps'),
                'eps_forward': info.get('forwardEps'),
                'book_value': info.get('bookValue'),
                'revenue_per_share': info.get('revenuePerShare'),
                # Dividend
                'dividend_yield': info.get('dividendYield'),
                'payout_ratio': info.get('payoutRatio'),
                # Growth
                'revenue_growth': info.get('revenueGrowth'),
                'earnings_growth': info.get('earningsGrowth'),
                'earnings_quarterly_growth': info.get('earningsQuarterlyGrowth'),
                # Market Data
                'market_cap': info.get('marketCap'),
                'enterprise_value': info.get('enterpriseValue'),
                'beta': info.get('beta'),
                '52_week_high': info.get('fiftyTwoWeekHigh'),
                '52_week_low': info.get('fiftyTwoWeekLow'),
                '50_day_ma': info.get('fiftyDayAverage'),
                '200_day_ma': info.get('twoHundredDayAverage'),
                # Share Statistics
                'shares_outstanding': info.get('sharesOutstanding'),
                'float_shares': info.get('floatShares'),
                'short_ratio': info.get('shortRatio'),
                'short_percent_of_float': info.get('shortPercentOfFloat'),
                # Coverage Ratios
                'interest_coverage': info.get('interestCoverage') if info.get('interestCoverage') else None,
                # Additional efficiency metrics (if available)
                'asset_turnover': info.get('assetTurnover') if info.get('assetTurnover') else None,
                'inventory_turnover': info.get('inventoryTurnover') if info.get('inventoryTurnover') else None,
            }
        except Exception as e:
            log.error(f"Error fetching key metrics for {symbol}: {e}")
            return {'symbol': symbol}

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
            log.error(f"Error fetching GDP: {e}")

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
            log.error(f"Error fetching unemployment: {e}")

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
            log.error(f"Error fetching CPI: {e}")

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
            log.error(f"Error fetching interest rate: {e}")

        return indicators

    async def get_indicator_history(self, indicator: str, period: str = "5y") -> List[Dict[str, Any]]:
        """
        Get historical data for an economic indicator

        Args:
            indicator: Indicator name (GDP, UNEMPLOYMENT, CPI, FED_FUNDS_RATE, RETAIL_SALES,
                      CONSUMER_SENTIMENT, NONFARM_PAYROLL, HOUSING_STARTS, INDUSTRIAL_PRODUCTION)
            period: Period string (1mo, 3mo, 6mo, 1y, 2y, 3y, 5y, 10y, max)
        """
        try:
            # period를 start_date, end_date로 변환
            start_date, end_date = parse_period_to_dates(period)

            result = None

            if indicator == 'GDP':
                result = await FREDGDPFetcher.fetch_data({
                    'start_date': start_date,
                    'end_date': end_date
                })
            elif indicator == 'UNEMPLOYMENT':
                result = await FREDUnemploymentFetcher.fetch_data({
                    'start_date': start_date,
                    'end_date': end_date
                })
            elif indicator == 'CPI':
                result = await FREDCPIFetcher.fetch_data({
                    'start_date': start_date,
                    'end_date': end_date
                })
            elif indicator == 'FED_FUNDS_RATE' or indicator == 'INTEREST_RATE':
                result = await FREDInterestRateFetcher.fetch_data({
                    'rate_type': 'federal_funds',
                    'start_date': start_date,
                    'end_date': end_date
                })
            elif indicator == 'RETAIL_SALES':
                result = await FREDRetailSalesFetcher.fetch_data({
                    'start_date': start_date,
                    'end_date': end_date
                })
            elif indicator == 'CONSUMER_SENTIMENT':
                result = await FREDConsumerSentimentFetcher.fetch_data({
                    'start_date': start_date,
                    'end_date': end_date
                })
            elif indicator == 'NONFARM_PAYROLL':
                result = await FREDNonfarmPayrollFetcher.fetch_data({
                    'start_date': start_date,
                    'end_date': end_date
                })
            elif indicator == 'HOUSING_STARTS':
                result = await FREDHousingStartsFetcher.fetch_data({
                    'start_date': start_date,
                    'end_date': end_date
                })
            elif indicator == 'INDUSTRIAL_PRODUCTION':
                result = await FREDIndustrialProductionFetcher.fetch_data({
                    'start_date': start_date,
                    'end_date': end_date
                })

            if result:
                # rate 속성이 있으면 rate를, 없으면 value를 사용
                return [
                    {
                        'date': data.date.isoformat() if data.date else None,
                        'value': getattr(data, 'rate', None) or data.value
                    }
                    for data in result
                ]
        except Exception as e:
            log.error(f"Error fetching indicator history: {e}")

        return []

    async def get_news(self, symbol: Optional[str] = None, limit: int = 10) -> List[Dict[str, Any]]:
        """Get market news"""
        try:
            params = {}
            if symbol:
                params['ticker'] = symbol

            result = await PolygonNewsFetcher.fetch_data(params)
            return PolygonNewsFetcher.set_data(result)[:limit]
        except Exception as e:
            log.error(f"Error fetching news: {e}")

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
            log.error(f"Error fetching financials: {e}")

        return {}

    async def get_quarterly_pnl(self, symbol: str, limit: int = 12) -> Dict[str, Any]:
        """
        Get quarterly P&L breakdown from yfinance:
        Total Revenue, Cost of Revenue, Gross Profit, Operating Expenses,
        Operating Income, Net Income — last `limit` quarters.
        """
        try:
            import yfinance as yf
            import numpy as np

            ticker = yf.Ticker(symbol)
            q = ticker.quarterly_income_stmt

            if q is None or q.empty:
                return {'symbol': symbol, 'quarters': [], 'history': []}

            # Rows we want (order matters for stacked chart layers)
            row_map = {
                'revenue':   'Total Revenue',
                'cogs':      'Cost Of Revenue',
                'gross':     'Gross Profit',
                'op_income': 'Operating Income',
                'net':       'Net Income',
                'rd':        'Research And Development',
                'sga':       'Selling General And Administration',
            }

            # Sort columns ascending (oldest → newest), take last `limit`
            cols = sorted(q.columns)[-limit:]

            history = []
            for col in cols:
                date_str = str(col)[:10]
                row: Dict[str, Any] = {'date': date_str}
                for key, label in row_map.items():
                    if label in q.index:
                        val = q.loc[label, col]
                        row[key] = round(float(val) / 1e9, 3) if (val is not None and not (isinstance(val, float) and np.isnan(val))) else None
                    else:
                        row[key] = None
                # Derived margins (% of revenue)
                rev = row.get('revenue')
                if rev and rev > 0:
                    row['gross_margin']  = round(row['gross']      / rev * 100, 1) if row.get('gross')      is not None else None
                    row['op_margin']     = round(row['op_income']  / rev * 100, 1) if row.get('op_income')  is not None else None
                    row['net_margin']    = round(row['net']        / rev * 100, 1) if row.get('net')        is not None else None
                history.append(row)

            # YoY per quarter (compare same quarter prior year)
            yoy_revenue = {}
            for i, row in enumerate(history):
                prior_idx = i - 4  # same quarter last year
                if prior_idx >= 0:
                    cur = row.get('revenue')
                    prv = history[prior_idx].get('revenue')
                    if cur is not None and prv and prv != 0:
                        yoy_revenue[row['date']] = round((cur - prv) / abs(prv) * 100, 1)

            latest = history[-1] if history else {}
            return {
                'symbol': symbol,
                'history': history,
                'latest': latest,
                'yoy_revenue': yoy_revenue,
            }

        except Exception as e:
            log.error(f"Error fetching quarterly P&L for {symbol}: {e}")
            return {'symbol': symbol, 'history': [], 'latest': {}}

    async def get_revenue_segments(self, symbol: str, limit: int = 8) -> Dict[str, Any]:
        """
        Get revenue breakdown by product segment and geographic region.

        Uses FMP /stable/revenue-product-segmentation and
        /stable/revenue-geographic-segmentation endpoints.

        Args:
            symbol: Stock symbol (e.g. 'AAPL')
            limit: Number of annual periods to return (default 8)

        Returns:
            {
              'symbol': str,
              'product': {
                  'segments': ['iPhone', 'Mac', ...],   # all unique segment names
                  'history': [
                      {'date': '2024-09-28', 'total': float,
                       'iPhone': float, 'Mac': float, ...},
                      ...
                  ],
                  'latest': {'date': ..., 'iPhone': float, ...},
                  'yoy': {'iPhone': float, ...}  # % change vs prior year
              },
              'geo': { ... same structure ... },
              'has_product': bool,
              'has_geo': bool
            }
        """
        import requests as _requests

        try:
            from data_fetcher.utils.api_keys import get_api_key as _get_key
            fmp_key = _get_key(credentials=None, api_name='FMP', env_var='FMP_API_KEY')
        except Exception:
            fmp_key = None

        if not fmp_key:
            log.warning("FMP API key not configured — cannot fetch revenue segments")
            return {'symbol': symbol, 'has_product': False, 'has_geo': False}

        base_url = 'https://financialmodelingprep.com/stable'
        headers = {'User-Agent': 'MarketPulse/1.0'}

        def _fetch_segment(endpoint: str) -> List[Dict]:
            try:
                r = _requests.get(
                    f'{base_url}/{endpoint}',
                    params={'symbol': symbol, 'period': 'annual', 'apikey': fmp_key},
                    headers=headers, timeout=15
                )
                r.raise_for_status()
                return r.json() or []
            except Exception as e:
                log.warning(f"FMP segment fetch failed ({endpoint}): {e}")
                return []

        def _normalize(raw: List[Dict], limit: int) -> Dict:
            """Convert FMP list → {segments, history, latest, yoy}"""
            # Sort ascending by date, take last `limit` periods
            sorted_raw = sorted(raw, key=lambda x: x.get('date', ''))[-limit:]
            if not sorted_raw:
                return {'segments': [], 'history': [], 'latest': {}, 'yoy': {}}

            # Collect all segment keys (consistent across years)
            all_segs: set = set()
            for rec in sorted_raw:
                all_segs.update(rec.get('data', {}).keys())
            segments = sorted(all_segs)

            history = []
            for rec in sorted_raw:
                d = rec.get('data', {})
                total = sum(v for v in d.values() if isinstance(v, (int, float)))
                row: Dict[str, Any] = {
                    'date': rec.get('date', ''),
                    'total': round(total / 1e9, 3),  # → billions
                }
                for seg in segments:
                    val = d.get(seg)
                    row[seg] = round(val / 1e9, 3) if isinstance(val, (int, float)) else None
                history.append(row)

            latest = history[-1] if history else {}
            prior  = history[-2] if len(history) >= 2 else {}

            # YoY % change
            yoy: Dict[str, Optional[float]] = {}
            for seg in segments:
                cur = latest.get(seg)
                prv = prior.get(seg)
                if cur is not None and prv and prv != 0:
                    yoy[seg] = round((cur - prv) / abs(prv) * 100, 1)
                else:
                    yoy[seg] = None

            return {'segments': segments, 'history': history, 'latest': latest, 'yoy': yoy}

        product_raw = _fetch_segment('revenue-product-segmentation')
        geo_raw     = _fetch_segment('revenue-geographic-segmentation')

        product = _normalize(product_raw, limit)
        geo     = _normalize(geo_raw, limit)

        return {
            'symbol': symbol,
            'product': product if product['segments'] else None,
            'geo':     geo     if geo['segments']     else None,
            'has_product': bool(product['segments']),
            'has_geo':     bool(geo['segments']),
        }

    async def search_stocks(self, query: str, limit: int = 10) -> List[Dict[str, Any]]:
        """
        Search for stocks by symbol or company name

        Args:
            query: Search query (symbol or company name)
            limit: Maximum number of results

        Returns:
            List of matching stocks with symbol and name
        """
        # Try FMP first
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
            log.error(f"Error searching stocks from FMP for '{query}': {e}")

        # Fallback: Use most active stocks from FMP API and filter by query
        try:
            actives = await FMPActiveStocksFetcher.fetch_data({'type': 'actives'})
            if actives:
                query_upper = query.upper()
                results = [
                    {
                        'symbol': stock.symbol,
                        'name': stock.name,
                        'exchange': 'NASDAQ',  # Most actives are typically NASDAQ/NYSE
                        'currency': 'USD'
                    }
                    for stock in actives
                    if query_upper in stock.symbol.upper() or query_upper in stock.name.upper()
                ]
                if results:
                    return results[:limit]
        except Exception as e:
            log.error(f"Error fetching active stocks fallback: {e}")

        # If all else fails, return empty list
        return []


    async def get_earnings(self, symbol: str, limit: int = 8) -> Dict[str, Any]:
        """
        Get earnings data for a company

        Args:
            symbol: Stock symbol
            limit: Number of periods to return (default 8)

        Returns:
            Earnings data with EPS actual vs estimated
        """
        try:
            result = await PolygonEarningsFetcher.fetch_data({
                'ticker': symbol,
                'limit': limit
            })

            if result:
                return {'symbol': symbol, 'earnings': PolygonEarningsFetcher.set_data(result)}
        except Exception as e:
            log.error(f"Error fetching earnings: {e}")

        return {'symbol': symbol, 'earnings': []}

    async def get_insider_trading(self, symbol: str, limit: int = 50) -> Dict[str, Any]:
        """
        Get insider trading data for a company using Yahoo Finance

        Args:
            symbol: Stock symbol
            limit: Number of transactions to return (default 50)

        Returns:
            Insider trading transactions with summary statistics
        """
        # Try Yahoo Finance first
        try:
            result = await YahooInsiderTradingFetcher.fetch_data({
                'symbol': symbol
            })

            if result:
                transactions = []
                buy_count = 0
                sell_count = 0
                buy_value = 0
                sell_value = 0

                for data in result[:limit]:
                    tx_value = data.transaction_value or 0
                    tx_type = (data.transaction_type or '').lower()

                    # Determine if buy or sell
                    is_buy = 'purchase' in tx_type or 'buy' in tx_type or 'acquisition' in tx_type
                    is_sell = 'sale' in tx_type or 'sell' in tx_type or 'disposition' in tx_type

                    if is_buy:
                        buy_count += 1
                        buy_value += tx_value
                        acquisition_disposition = 'A'
                    elif is_sell:
                        sell_count += 1
                        sell_value += tx_value
                        acquisition_disposition = 'D'
                    else:
                        acquisition_disposition = None

                    transactions.append({
                        'transaction_date': data.transaction_date.isoformat() if data.transaction_date else None,
                        'filing_date': None,
                        'insider_name': data.insider_name,
                        'insider_title': data.insider_title,
                        'is_director': None,
                        'is_officer': None,
                        'transaction_type': data.transaction_type,
                        'acquisition_or_disposition': acquisition_disposition,
                        'shares_traded': data.shares_traded,
                        'price_per_share': data.price_per_share,
                        'transaction_value': data.transaction_value,
                        'shares_owned_after': data.shares_owned_after
                    })

                if transactions:
                    return {
                        'symbol': symbol,
                        'source': 'yahoo',
                        'summary': {
                            'buy_count': buy_count,
                            'sell_count': sell_count,
                            'buy_value': buy_value,
                            'sell_value': sell_value,
                            'net_value': buy_value - sell_value
                        },
                        'transactions': transactions
                    }
        except Exception as e:
            log.warning(f"Yahoo Finance insider trading failed for {symbol}: {e}")

        return {'symbol': symbol, 'summary': {}, 'transactions': []}

    async def get_insider_holders(self, symbol: str) -> Dict[str, Any]:
        """
        Get insider holders (roster) information using Yahoo Finance

        Args:
            symbol: Stock symbol

        Returns:
            List of insider holders with their positions
        """
        try:
            result = await YahooInsiderHoldersFetcher.fetch_data({
                'symbol': symbol
            })

            if result:
                return {'symbol': symbol, 'holders': YahooInsiderHoldersFetcher.set_data(result)}
        except Exception as e:
            log.error(f"Error fetching insider holders for {symbol}: {e}")

        return {'symbol': symbol, 'holders': []}

    async def get_analyst_data(self, symbol: str) -> Dict[str, Any]:
        """
        Get analyst recommendations and price targets

        Args:
            symbol: Stock symbol

        Returns:
            Analyst consensus, price targets, and recommendations
        """
        import requests as sync_requests
        from data_fetcher.utils.api_keys import get_api_key

        try:
            api_key = get_api_key(api_name="FMP", env_var="FMP_API_KEY")
            base = "https://financialmodelingprep.com/stable"

            # Fetch grades (individual analyst ratings), consensus targets, and individual price targets
            grades_res = sync_requests.get(
                f"{base}/grades",
                params={"symbol": symbol, "apikey": api_key, "limit": 30},
                timeout=15
            )
            consensus_res = sync_requests.get(
                f"{base}/price-target-consensus",
                params={"symbol": symbol, "apikey": api_key},
                timeout=15
            )
            pt_res = sync_requests.get(
                f"{base}/price-target",
                params={"symbol": symbol, "apikey": api_key, "limit": 30},
                timeout=15
            )

            grades_data = grades_res.json() if grades_res.ok else []
            consensus_data = consensus_res.json() if consensus_res.ok else []
            pt_data = pt_res.json() if pt_res.ok else []

            # Build lookup: (company, date) -> target price from price-target data
            pt_lookup = {}
            if isinstance(pt_data, list):
                for pt_item in pt_data:
                    company = pt_item.get('analystCompany') or pt_item.get('analystName') or ''
                    pt_date = (pt_item.get('publishedDate') or '')[:10]
                    target = pt_item.get('priceTarget') or pt_item.get('adjPriceTarget')
                    if company and pt_date and target:
                        pt_lookup[(company.lower(), pt_date)] = target

            # Parse consensus price targets
            avg_target_price = None
            min_target_price = None
            max_target_price = None
            if isinstance(consensus_data, list) and consensus_data:
                ct = consensus_data[0]
                avg_target_price = ct.get('targetConsensus') or ct.get('targetMedian')
                min_target_price = ct.get('targetLow')
                max_target_price = ct.get('targetHigh')

            # Aggregate ratings from grades
            strong_buy = 0
            buy = 0
            hold = 0
            sell = 0
            strong_sell = 0
            analysts = []

            if isinstance(grades_data, list):
                for item in grades_data[:20]:
                    grade = (item.get('newGrade') or '').lower()
                    if 'strong buy' in grade or grade == 'buy':
                        strong_buy += 1
                    elif 'buy' in grade or grade == 'outperform' or grade == 'overweight':
                        buy += 1
                    elif 'hold' in grade or grade == 'neutral' or grade == 'equal-weight':
                        hold += 1
                    elif 'sell' in grade or grade == 'underperform' or grade == 'underweight':
                        sell += 1
                    elif 'strong sell' in grade:
                        strong_sell += 1

                    company = item.get('gradingCompany')
                    date_str = item.get('date')
                    if company and date_str:
                        # Match with price target by company name and date
                        target = pt_lookup.get((company.lower(), date_str[:10]))
                        analysts.append({
                            'name': company,
                            'rating': item.get('newGrade'),
                            'prev_rating': item.get('previousGrade'),
                            'action': item.get('action'),
                            'date': date_str,
                            'target_price': target,
                        })

            total_ratings = strong_buy + buy + hold + sell + strong_sell
            if total_ratings > 0:
                if (strong_buy + buy) / total_ratings >= 0.6:
                    consensus_rating = 'Buy'
                elif (sell + strong_sell) / total_ratings >= 0.6:
                    consensus_rating = 'Sell'
                else:
                    consensus_rating = 'Hold'
            else:
                consensus_rating = 'N/A'

            return {
                'symbol': symbol,
                'consensus_rating': consensus_rating,
                'ratings': {
                    'strong_buy': strong_buy,
                    'buy': buy,
                    'hold': hold,
                    'sell': sell,
                    'strong_sell': strong_sell,
                    'total': total_ratings
                },
                'price_target': {
                    'average': avg_target_price,
                    'low': min_target_price,
                    'high': max_target_price
                },
                'number_of_analysts': total_ratings,
                'analysts': analysts,
            }
        except Exception as e:
            log.error(f"Error fetching analyst data: {e}")

        return {
            'symbol': symbol,
            'consensus_rating': 'N/A',
            'ratings': {},
            'price_target': {},
            'number_of_analysts': None,
            'analysts': [],
        }


    async def get_holders(self, symbol: str) -> Dict[str, Any]:
        """
        Get institutional and insider holder information

        Args:
            symbol: Stock symbol

        Returns:
            Holder information including institutional, insider, and summary data
        """
        try:
            import yfinance as yf
            ticker = yf.Ticker(symbol)

            # Get holder data
            institutional_holders = ticker.institutional_holders
            major_holders = ticker.major_holders

            # Get company info for shares data
            info = ticker.info

            # Process institutional holders
            institutions = []
            if institutional_holders is not None and not institutional_holders.empty:
                for _, row in institutional_holders.iterrows():
                    institutions.append({
                        'name': row.get('Holder', ''),
                        'shares': int(row.get('Shares', 0)) if row.get('Shares') else 0,
                        'value': float(row.get('Value', 0)) if row.get('Value') else 0,
                        'pct_held': float(row.get('% Out', 0)) if row.get('% Out') else 0,
                        'date_reported': row.get('Date Reported').strftime('%Y-%m-%d') if row.get('Date Reported') else None
                    })

            # Process major holders summary
            summary = {}
            if major_holders is not None and not major_holders.empty:
                for idx, row in major_holders.iterrows():
                    value = row.iloc[0] if len(row) > 0 else None
                    # Convert percentage string to float
                    if isinstance(value, str) and '%' in value:
                        value = float(value.replace('%', ''))
                    summary[idx] = value

            return {
                'symbol': symbol,
                'summary': {
                    'institutional_pct': summary.get('% of Shares Held by Institutions', 0),
                    'insider_pct': summary.get('% of Shares Held by Insiders', 0),
                    'institutional_float_pct': summary.get('% of Float Held by Institutions', 0),
                    'shares_outstanding': info.get('sharesOutstanding', 0),
                    'float_shares': info.get('floatShares', 0),
                    'short_interest': info.get('shortPercentOfFloat', 0) * 100 if info.get('shortPercentOfFloat') else 0,
                    'short_ratio': info.get('shortRatio', 0)
                },
                'institutional': institutions
            }
        except Exception as e:
            log.error(f"Error fetching holders for {symbol}: {e}")
            return {'symbol': symbol, 'summary': {}, 'institutional': []}

    async def get_calendar(
        self,
        symbol: str,
        start_date: str = None,
        end_date: str = None
    ) -> Dict[str, Any]:
        """
        Get company calendar events (earnings dates, dividends, etc.)

        Args:
            symbol: Stock symbol
            start_date: Start date filter (YYYY-MM-DD)
            end_date: End date filter (YYYY-MM-DD)

        Returns:
            Calendar events including earnings and dividend dates
        """
        try:
            import yfinance as yf
            from datetime import datetime as dt
            ticker = yf.Ticker(symbol)

            calendar = ticker.calendar  # This is a dict
            earnings_dates_df = ticker.earnings_dates  # Historical and future earnings
            info = ticker.info

            events = []
            upcoming_earnings = {}

            # Process calendar dict (contains next earnings info)
            if calendar and isinstance(calendar, dict):
                # Earnings dates from calendar
                earnings_date_list = calendar.get('Earnings Date', [])
                if earnings_date_list:
                    if not isinstance(earnings_date_list, list):
                        earnings_date_list = [earnings_date_list]
                    for ed in earnings_date_list:
                        if ed:
                            date_str = ed.strftime('%Y-%m-%d') if hasattr(ed, 'strftime') else str(ed)
                            events.append({
                                'type': 'earnings',
                                'title': 'Earnings Release',
                                'date': date_str,
                                'description': 'Quarterly earnings report',
                                'eps_estimate': calendar.get('Earnings Average'),
                                'eps_low': calendar.get('Earnings Low'),
                                'eps_high': calendar.get('Earnings High'),
                                'revenue_estimate': calendar.get('Revenue Average'),
                                'revenue_low': calendar.get('Revenue Low'),
                                'revenue_high': calendar.get('Revenue High')
                            })
                            upcoming_earnings['date'] = date_str
                            upcoming_earnings['eps_estimate'] = calendar.get('Earnings Average')

                # Ex-Dividend Date from calendar
                ex_div = calendar.get('Ex-Dividend Date')
                if ex_div:
                    date_str = ex_div.strftime('%Y-%m-%d') if hasattr(ex_div, 'strftime') else str(ex_div)
                    events.append({
                        'type': 'ex_dividend',
                        'title': 'Ex-Dividend Date',
                        'date': date_str,
                        'description': f"Dividend: ${info.get('dividendRate', 0):.2f}/share",
                        'amount': info.get('dividendRate', 0)
                    })

                # Dividend Payment Date from calendar
                div_date = calendar.get('Dividend Date')
                if div_date:
                    date_str = div_date.strftime('%Y-%m-%d') if hasattr(div_date, 'strftime') else str(div_date)
                    events.append({
                        'type': 'dividend_payment',
                        'title': 'Dividend Payment',
                        'date': date_str,
                        'description': f"Dividend: ${info.get('dividendRate', 0):.2f}/share",
                        'amount': info.get('dividendRate', 0)
                    })

            # Process earnings_dates DataFrame for historical earnings
            earnings_history = []
            if earnings_dates_df is not None and not earnings_dates_df.empty:
                for date_idx, row in earnings_dates_df.iterrows():
                    try:
                        date_str = date_idx.strftime('%Y-%m-%d') if hasattr(date_idx, 'strftime') else str(date_idx)[:10]
                        earnings_history.append({
                            'date': date_str,
                            'eps_estimate': float(row.get('EPS Estimate')) if row.get('EPS Estimate') and not pd.isna(row.get('EPS Estimate')) else None,
                            'eps_actual': float(row.get('Reported EPS')) if row.get('Reported EPS') and not pd.isna(row.get('Reported EPS')) else None,
                            'surprise_pct': float(row.get('Surprise(%)')) if row.get('Surprise(%)') and not pd.isna(row.get('Surprise(%)')) else None
                        })
                    except Exception as e:
                        log.warning(f"Error parsing earnings date: {e}")
                        continue

            # Sort events by date
            events.sort(key=lambda x: x.get('date', ''), reverse=False)

            # Filter events by date range if provided
            if start_date or end_date:
                filtered_events = []
                for event in events:
                    event_date = event.get('date', '')
                    if start_date and event_date < start_date:
                        continue
                    if end_date and event_date > end_date:
                        continue
                    filtered_events.append(event)
                events = filtered_events

            return {
                'symbol': symbol,
                'events': events,
                'upcoming_earnings': upcoming_earnings,
                'earnings_history': earnings_history[:12],  # Last 12 quarters
                'dividend_info': {
                    'rate': info.get('dividendRate'),
                    'yield': info.get('dividendYield'),
                    'payout_ratio': info.get('payoutRatio')
                }
            }
        except Exception as e:
            log.error(f"Error fetching calendar for {symbol}: {e}")
            return {'symbol': symbol, 'events': [], 'earnings_history': [], 'dividend_info': {}}

    async def get_dividends(self, symbol: str, limit: int = 20) -> Dict[str, Any]:
        """
        Get dividend history for a company

        Args:
            symbol: Stock symbol
            limit: Number of dividend records to return

        Returns:
            Dividend history with dates and amounts
        """
        try:
            result = await YahooDividendsFetcher.fetch_data({
                'symbol': symbol
            })

            if result:
                return {'symbol': symbol, 'history': YahooDividendsFetcher.set_data(result)[:limit]}
        except Exception as e:
            log.error(f"Error fetching dividends for {symbol}: {e}")

        return {'symbol': symbol, 'history': []}

    async def get_splits(self, symbol: str, limit: int = 20) -> Dict[str, Any]:
        """
        Get stock split history for a company

        Args:
            symbol: Stock symbol
            limit: Number of split records to return

        Returns:
            Split history with dates and ratios
        """
        try:
            import yfinance as yf
            ticker = yf.Ticker(symbol)
            splits = ticker.splits

            if splits is not None and not splits.empty:
                split_list = []
                for date_idx, ratio in splits.items():
                    split_list.append({
                        'date': date_idx.strftime('%Y-%m-%d') if hasattr(date_idx, 'strftime') else str(date_idx)[:10],
                        'ratio': float(ratio),
                        'description': f"{int(ratio)}:1 split" if ratio > 1 else f"1:{int(1/ratio)} reverse split"
                    })

                # Sort by date descending and limit
                split_list.sort(key=lambda x: x['date'], reverse=True)
                return {
                    'symbol': symbol,
                    'splits': split_list[:limit]
                }
        except Exception as e:
            log.error(f"Error fetching splits for {symbol}: {e}")

        return {'symbol': symbol, 'splits': []}

    async def get_filings(self, symbol: str, limit: int = 20) -> Dict[str, Any]:
        """
        Get SEC filings for a company

        Args:
            symbol: Stock symbol
            limit: Number of filings to return

        Returns:
            Recent SEC filings with links
        """
        try:
            import yfinance as yf
            ticker = yf.Ticker(symbol)
            info = ticker.info

            # Get SEC filings from yfinance
            sec_filings = ticker.sec_filings

            filings = []
            if sec_filings is not None and len(sec_filings) > 0:
                for filing in sec_filings[:limit]:
                    filings.append({
                        'type': filing.get('type', ''),
                        'title': filing.get('title', ''),
                        'date': filing.get('date', ''),
                        'url': filing.get('edgarUrl', '') or filing.get('url', ''),
                        'exhibits': filing.get('exhibits', {})
                    })

            return {
                'symbol': symbol,
                'cik': info.get('cik'),
                'filings': filings
            }
        except Exception as e:
            log.error(f"Error fetching filings for {symbol}: {e}")

        return {'symbol': symbol, 'filings': []}

    async def get_estimates(self, symbol: str) -> Dict[str, Any]:
        """
        Get analyst estimates for EPS and revenue

        Args:
            symbol: Stock symbol

        Returns:
            Analyst estimates including EPS and revenue forecasts
        """
        try:
            import yfinance as yf
            ticker = yf.Ticker(symbol)

            # Get earnings estimates
            earnings_est = ticker.earnings_estimate
            revenue_est = ticker.revenue_estimate
            eps_revisions = ticker.eps_revisions
            price_targets = ticker.analyst_price_targets
            recommendations = ticker.recommendations

            estimates = {
                'symbol': symbol,
                'eps': {},
                'revenue': {},
                'price_target': {},
                'recommendations': {}
            }

            # Process earnings estimates - periods are in INDEX (0q, +1q, 0y, +1y)
            if earnings_est is not None and not earnings_est.empty:
                for period in earnings_est.index:
                    period_key = self._format_period_key(period)
                    estimates['eps'][period_key] = {
                        'estimate': float(earnings_est.loc[period, 'avg']) if 'avg' in earnings_est.columns else None,
                        'low': float(earnings_est.loc[period, 'low']) if 'low' in earnings_est.columns else None,
                        'high': float(earnings_est.loc[period, 'high']) if 'high' in earnings_est.columns else None,
                        'year_ago': float(earnings_est.loc[period, 'yearAgoEps']) if 'yearAgoEps' in earnings_est.columns else None,
                        'num_analysts': int(earnings_est.loc[period, 'numberOfAnalysts']) if 'numberOfAnalysts' in earnings_est.columns else None,
                        'growth': float(earnings_est.loc[period, 'growth']) if 'growth' in earnings_est.columns else None
                    }

            # Process revenue estimates - periods are in INDEX
            if revenue_est is not None and not revenue_est.empty:
                for period in revenue_est.index:
                    period_key = self._format_period_key(period)
                    estimates['revenue'][period_key] = {
                        'estimate': float(revenue_est.loc[period, 'avg']) if 'avg' in revenue_est.columns else None,
                        'low': float(revenue_est.loc[period, 'low']) if 'low' in revenue_est.columns else None,
                        'high': float(revenue_est.loc[period, 'high']) if 'high' in revenue_est.columns else None,
                        'year_ago': float(revenue_est.loc[period, 'yearAgoRevenue']) if 'yearAgoRevenue' in revenue_est.columns else None,
                        'num_analysts': int(revenue_est.loc[period, 'numberOfAnalysts']) if 'numberOfAnalysts' in revenue_est.columns else None,
                        'growth': float(revenue_est.loc[period, 'growth']) if 'growth' in revenue_est.columns else None
                    }

            # Process price targets (dict format)
            if price_targets:
                estimates['price_target'] = {
                    'current': price_targets.get('current'),
                    'mean': price_targets.get('mean'),
                    'median': price_targets.get('median'),
                    'low': price_targets.get('low'),
                    'high': price_targets.get('high')
                }

            # Process recommendations
            if recommendations is not None and not recommendations.empty:
                latest = recommendations.iloc[0] if len(recommendations) > 0 else None
                if latest is not None:
                    estimates['recommendations'] = {
                        'strong_buy': int(latest.get('strongBuy', 0)),
                        'buy': int(latest.get('buy', 0)),
                        'hold': int(latest.get('hold', 0)),
                        'sell': int(latest.get('sell', 0)),
                        'strong_sell': int(latest.get('strongSell', 0))
                    }

            # Process EPS revisions
            if eps_revisions is not None and not eps_revisions.empty:
                revisions = {}
                for period in eps_revisions.index:
                    period_key = self._format_period_key(period)
                    revisions[period_key] = {
                        'up_last_7_days': int(eps_revisions.loc[period, 'upLast7days']) if 'upLast7days' in eps_revisions.columns else 0,
                        'up_last_30_days': int(eps_revisions.loc[period, 'upLast30days']) if 'upLast30days' in eps_revisions.columns else 0,
                        'down_last_7_days': int(eps_revisions.loc[period, 'downLast7days']) if 'downLast7days' in eps_revisions.columns else 0,
                        'down_last_30_days': int(eps_revisions.loc[period, 'downLast30days']) if 'downLast30days' in eps_revisions.columns else 0
                    }
                estimates['revisions'] = revisions

            return estimates
        except Exception as e:
            log.error(f"Error fetching estimates for {symbol}: {e}")
            return {'symbol': symbol, 'eps': {}, 'revenue': {}, 'price_target': {}, 'recommendations': {}}

    async def get_stock_orderbook(self, symbol: str) -> dict:
        """Fetch approximate order book for a US stock via Polygon NBBO quotes."""
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, fetch_stock_orderbook, symbol)

    def _format_period_key(self, period: str) -> str:
        """Format period key for readability"""
        period_map = {
            '0q': 'Current Quarter',
            '+1q': 'Next Quarter',
            '0y': 'Current Year',
            '+1y': 'Next Year'
        }
        return period_map.get(period, period)

    async def get_management(self, symbol: str) -> Dict[str, Any]:
        """Get management team and governance risk data via yfinance"""
        try:
            import yfinance as yf
            ticker = yf.Ticker(symbol)
            info = ticker.info

            officers_raw = info.get('companyOfficers', [])
            officers = []
            for o in officers_raw:
                officers.append({
                    'name': o.get('name', ''),
                    'title': o.get('title', ''),
                    'age': o.get('age'),
                    'total_pay': o.get('totalPay'),
                    'year_born': o.get('yearBorn'),
                })

            governance = {
                'audit_risk': info.get('auditRisk'),
                'board_risk': info.get('boardRisk'),
                'compensation_risk': info.get('compensationRisk'),
                'shareholder_rights_risk': info.get('shareHolderRightsRisk'),
                'overall_risk': info.get('overallRisk'),
            }

            return {
                'symbol': symbol,
                'officers': officers,
                'governance': governance,
            }
        except Exception as e:
            log.error(f"Error fetching management for {symbol}: {e}")
            return {'symbol': symbol, 'officers': [], 'governance': {}}

    async def get_moat_analysis(self, symbol: str) -> Dict[str, Any]:
        """Get 10-year moat metrics: ROE, ROIC, margins, FCF margin"""
        try:
            import yfinance as yf
            import numpy as np
            ticker = yf.Ticker(symbol)
            income = ticker.income_stmt        # annual
            balance = ticker.balance_sheet     # annual
            cashflow = ticker.cashflow         # annual

            if income is None or income.empty:
                return {'symbol': symbol, 'history': [], 'moat_score': 0, 'moat_type': 'None'}

            cols = sorted(income.columns)  # ascending by date

            def safe(df, row, col):
                try:
                    val = df.loc[row, col]
                    if val is None or (isinstance(val, float) and np.isnan(val)):
                        return None
                    return float(val)
                except Exception:
                    return None

            history = []
            roe_above_15 = 0
            for col in cols:
                year = str(col)[:4]
                revenue = safe(income, 'Total Revenue', col)
                gross   = safe(income, 'Gross Profit', col)
                op_inc  = safe(income, 'Operating Income', col)
                net_inc = safe(income, 'Net Income', col)
                ebit    = op_inc  # proxy for EBIT

                equity  = safe(balance, 'Stockholders Equity', col) if balance is not None and not balance.empty else None
                total_assets = safe(balance, 'Total Assets', col) if balance is not None and not balance.empty else None
                total_debt   = safe(balance, 'Total Debt', col) if balance is not None and not balance.empty else None

                fcf = None
                if cashflow is not None and not cashflow.empty:
                    ocf  = safe(cashflow, 'Operating Cash Flow', col)
                    capex = safe(cashflow, 'Capital Expenditure', col)
                    if ocf is not None and capex is not None:
                        fcf = ocf + capex  # capex is negative in yfinance

                roe = round(net_inc / equity * 100, 1) if (net_inc and equity and equity != 0) else None
                invested_capital = (total_assets - (total_assets - (equity or 0) - (total_debt or 0))) if total_assets else None
                roic = None
                if ebit and invested_capital and invested_capital != 0:
                    roic = round(ebit / invested_capital * 100, 1)

                gross_margin = round(gross / revenue * 100, 1) if (gross and revenue and revenue != 0) else None
                op_margin    = round(op_inc / revenue * 100, 1) if (op_inc and revenue and revenue != 0) else None
                net_margin   = round(net_inc / revenue * 100, 1) if (net_inc and revenue and revenue != 0) else None
                fcf_margin   = round(fcf / revenue * 100, 1) if (fcf and revenue and revenue != 0) else None

                if roe is not None and roe >= 15:
                    roe_above_15 += 1

                history.append({
                    'year': year,
                    'roe': roe,
                    'roic': roic,
                    'gross_margin': gross_margin,
                    'op_margin': op_margin,
                    'net_margin': net_margin,
                    'fcf_margin': fcf_margin,
                })

            if roe_above_15 >= 7:
                moat_type = 'Wide'
                moat_score = min(100, 60 + roe_above_15 * 5)
            elif roe_above_15 >= 4:
                moat_type = 'Narrow'
                moat_score = 30 + roe_above_15 * 5
            else:
                moat_type = 'None'
                moat_score = max(0, roe_above_15 * 5)

            return {
                'symbol': symbol,
                'history': history,
                'moat_score': moat_score,
                'moat_type': moat_type,
            }
        except Exception as e:
            log.error(f"Error fetching moat analysis for {symbol}: {e}")
            return {'symbol': symbol, 'history': [], 'moat_score': 0, 'moat_type': 'None'}

    async def get_swot(self, symbol: str) -> Dict[str, Any]:
        """Auto-derive SWOT items from yfinance info + analyst data"""
        try:
            import yfinance as yf
            ticker = yf.Ticker(symbol)
            info = ticker.info

            strengths = []
            weaknesses = []
            opportunities = []
            threats = []

            # Profitability strengths/weaknesses
            roe = info.get('returnOnEquity')
            if roe is not None:
                if roe > 0.15:
                    strengths.append({'label': 'High ROE', 'value': f"{roe*100:.1f}%", 'type': 'positive'})
                elif roe < 0.05:
                    weaknesses.append({'label': 'Low ROE', 'value': f"{roe*100:.1f}%", 'type': 'negative'})

            roa = info.get('returnOnAssets')
            if roa is not None:
                if roa > 0.08:
                    strengths.append({'label': 'Strong ROA', 'value': f"{roa*100:.1f}%", 'type': 'positive'})
                elif roa < 0.02:
                    weaknesses.append({'label': 'Low ROA', 'value': f"{roa*100:.1f}%", 'type': 'negative'})

            op_margin = info.get('operatingMargins')
            if op_margin is not None:
                if op_margin > 0.20:
                    strengths.append({'label': 'High Operating Margin', 'value': f"{op_margin*100:.1f}%", 'type': 'positive'})
                elif op_margin < 0.05:
                    weaknesses.append({'label': 'Thin Operating Margin', 'value': f"{op_margin*100:.1f}%", 'type': 'negative'})

            fcf = info.get('freeCashflow')
            if fcf and fcf > 0:
                strengths.append({'label': 'Positive FCF', 'value': f"${fcf/1e9:.1f}B", 'type': 'positive'})
            elif fcf and fcf < 0:
                weaknesses.append({'label': 'Negative FCF', 'value': f"${fcf/1e9:.1f}B", 'type': 'negative'})

            # Debt
            de = info.get('debtToEquity')
            if de is not None:
                if de > 100:
                    weaknesses.append({'label': 'High Debt/Equity', 'value': f"{de:.0f}%", 'type': 'negative'})
                    threats.append({'label': 'Leverage Risk', 'value': f"D/E {de:.0f}%", 'type': 'negative'})
                elif de < 30:
                    strengths.append({'label': 'Low Leverage', 'value': f"D/E {de:.0f}%", 'type': 'positive'})

            # Growth
            rev_growth = info.get('revenueGrowth')
            if rev_growth is not None:
                if rev_growth > 0.10:
                    strengths.append({'label': 'Revenue Growth', 'value': f"{rev_growth*100:.1f}%", 'type': 'positive'})
                elif rev_growth < 0:
                    weaknesses.append({'label': 'Revenue Decline', 'value': f"{rev_growth*100:.1f}%", 'type': 'negative'})

            eps_growth = info.get('earningsGrowth')
            if eps_growth is not None and eps_growth > 0.15:
                opportunities.append({'label': 'EPS Growth Trend', 'value': f"{eps_growth*100:.1f}%", 'type': 'positive'})

            # Analyst target upside
            current_price = info.get('currentPrice') or info.get('regularMarketPrice')
            target_mean = info.get('targetMeanPrice')
            if current_price and target_mean:
                upside = (target_mean - current_price) / current_price * 100
                if upside > 15:
                    opportunities.append({'label': 'Analyst Upside', 'value': f"+{upside:.1f}%", 'type': 'positive'})
                elif upside < -10:
                    threats.append({'label': 'Analyst Downside', 'value': f"{upside:.1f}%", 'type': 'negative'})

            # Beta / volatility
            beta = info.get('beta')
            if beta is not None:
                if beta > 1.5:
                    threats.append({'label': 'High Volatility', 'value': f"Beta {beta:.2f}", 'type': 'negative'})
                elif beta < 0.7:
                    strengths.append({'label': 'Low Volatility', 'value': f"Beta {beta:.2f}", 'type': 'positive'})

            # Market position
            market_cap = info.get('marketCap')
            if market_cap and market_cap > 100e9:
                strengths.append({'label': 'Large Cap Stability', 'value': f"${market_cap/1e9:.0f}B", 'type': 'positive'})

            # Forward growth opportunity
            forward_pe = info.get('forwardPE')
            trailing_pe = info.get('trailingPE')
            if forward_pe and trailing_pe and forward_pe < trailing_pe * 0.85:
                opportunities.append({'label': 'Improving Earnings Outlook', 'value': f"Fwd PE {forward_pe:.1f}", 'type': 'positive'})

            return {
                'symbol': symbol,
                'strengths': strengths,
                'weaknesses': weaknesses,
                'opportunities': opportunities,
                'threats': threats,
                'ai_analysis': None,
            }
        except Exception as e:
            log.error(f"Error fetching SWOT for {symbol}: {e}")
            return {'symbol': symbol, 'strengths': [], 'weaknesses': [], 'opportunities': [], 'threats': [], 'ai_analysis': None}

    async def get_stock_sentiment(self, symbol: str) -> Dict[str, Any]:
        """Aggregate news sentiment from Polygon news feed"""
        try:
            params = {'ticker': symbol}
            result = await PolygonNewsFetcher.fetch_data(params)

            if not result:
                return {'symbol': symbol, 'news': [], 'aggregate': {}, 'trend': []}

            from datetime import datetime as dt, timezone
            positive = 0
            negative = 0
            neutral = 0
            news_items = []

            for article in result[:50]:
                title = article.title or ''
                # Simple keyword-based sentiment
                title_lower = title.lower()
                pos_words = ['beat', 'surge', 'rally', 'gain', 'rise', 'up', 'growth', 'profit', 'record', 'strong', 'bullish', 'upgrade', 'buy']
                neg_words = ['miss', 'fall', 'drop', 'decline', 'loss', 'down', 'weak', 'bearish', 'downgrade', 'sell', 'concern', 'risk', 'cut']

                pos_score = sum(1 for w in pos_words if w in title_lower)
                neg_score = sum(1 for w in neg_words if w in title_lower)

                if pos_score > neg_score:
                    sentiment = 'positive'
                    sentiment_score = min(100, 50 + pos_score * 10)
                    positive += 1
                elif neg_score > pos_score:
                    sentiment = 'negative'
                    sentiment_score = max(0, 50 - neg_score * 10)
                    negative += 1
                else:
                    sentiment = 'neutral'
                    sentiment_score = 50
                    neutral += 1

                pub_at = article.published_utc.isoformat() if article.published_utc else None
                news_items.append({
                    'title': title,
                    'published_at': pub_at,
                    'source': article.publisher_name,
                    'url': article.article_url,
                    'sentiment': sentiment,
                    'sentiment_score': sentiment_score,
                })

            total = len(news_items)
            overall_score = int((positive * 100 + neutral * 50) / total) if total > 0 else 50

            # Build 30-day trend (group by day)
            from collections import defaultdict
            day_scores: Dict[str, list] = defaultdict(list)
            for item in news_items:
                if item['published_at']:
                    day = item['published_at'][:10]
                    day_scores[day].append(item['sentiment_score'])

            trend = sorted([
                {'date': day, 'score': round(sum(scores) / len(scores), 1)}
                for day, scores in day_scores.items()
            ], key=lambda x: x['date'])

            return {
                'symbol': symbol,
                'news': news_items,
                'aggregate': {
                    'positive': positive,
                    'negative': negative,
                    'neutral': neutral,
                    'overall_score': overall_score,
                },
                'trend': trend,
            }
        except Exception as e:
            log.error(f"Error fetching stock sentiment for {symbol}: {e}")
            return {'symbol': symbol, 'news': [], 'aggregate': {}, 'trend': []}

    async def get_social_sentiment(self, symbol: str) -> Dict[str, Any]:
        """Fetch Reddit + StockTwits social sentiment"""
        reddit_posts = []
        stocktwits_messages = []

        # StockTwits (free public API)
        try:
            import requests as sync_requests
            st_url = f"https://api.stocktwits.com/api/2/streams/symbol/{symbol}.json"
            st_res = sync_requests.get(st_url, timeout=10)
            if st_res.ok:
                st_data = st_res.json()
                for msg in (st_data.get('messages') or [])[:30]:
                    body = msg.get('body', '')
                    entities = msg.get('entities', {})
                    sentiment_obj = entities.get('sentiment', {}) or {}
                    basic_sent = sentiment_obj.get('basic', '')
                    sentiment = 'bullish' if basic_sent == 'Bullish' else ('bearish' if basic_sent == 'Bearish' else 'neutral')
                    stocktwits_messages.append({
                        'body': body,
                        'sentiment': sentiment,
                        'created_at': msg.get('created_at', ''),
                        'user': msg.get('user', {}).get('username', ''),
                    })
        except Exception as e:
            log.warning(f"StockTwits fetch failed for {symbol}: {e}")

        # Reddit (requires env vars)
        reddit_configured = False
        try:
            import os
            import requests as sync_requests
            client_id = os.environ.get('REDDIT_CLIENT_ID')
            client_secret = os.environ.get('REDDIT_CLIENT_SECRET')
            reddit_configured = bool(client_id and client_secret)

            if client_id and client_secret:
                # Get access token
                auth = (client_id, client_secret)
                token_res = sync_requests.post(
                    'https://www.reddit.com/api/v1/access_token',
                    auth=auth,
                    data={'grant_type': 'client_credentials'},
                    headers={'User-Agent': 'MarketPulse/1.0'},
                    timeout=10
                )
                if token_res.ok:
                    token = token_res.json().get('access_token', '')
                    headers = {'Authorization': f'bearer {token}', 'User-Agent': 'MarketPulse/1.0'}

                    for sub in ['stocks', 'investing', 'wallstreetbets']:
                        search_res = sync_requests.get(
                            f'https://oauth.reddit.com/r/{sub}/search',
                            params={'q': symbol, 'sort': 'new', 'limit': 10, 'restrict_sr': True},
                            headers=headers,
                            timeout=10
                        )
                        if search_res.ok:
                            posts = search_res.json().get('data', {}).get('children', [])
                            for post in posts:
                                d = post.get('data', {})
                                title = d.get('title', '')
                                title_lower = title.lower()
                                pos_w = ['beat', 'bull', 'buy', 'moon', 'surge', 'gain']
                                neg_w = ['bear', 'sell', 'dump', 'crash', 'loss', 'miss']
                                ps = sum(1 for w in pos_w if w in title_lower)
                                ns = sum(1 for w in neg_w if w in title_lower)
                                sentiment = 'positive' if ps > ns else ('negative' if ns > ps else 'neutral')
                                import datetime
                                created = datetime.datetime.fromtimestamp(d.get('created_utc', 0)).isoformat()
                                reddit_posts.append({
                                    'subreddit': sub,
                                    'title': title,
                                    'score': d.get('score', 0),
                                    'num_comments': d.get('num_comments', 0),
                                    'created_utc': created,
                                    'sentiment': sentiment,
                                    'url': f"https://reddit.com{d.get('permalink', '')}",
                                })
        except Exception as e:
            log.warning(f"Reddit fetch failed for {symbol}: {e}")

        # Aggregate
        all_sentiments = [m['sentiment'] for m in stocktwits_messages] + [p['sentiment'] for p in reddit_posts]
        bullish = sum(1 for s in all_sentiments if s in ('bullish', 'positive'))
        bearish = sum(1 for s in all_sentiments if s in ('bearish', 'negative'))
        neutral_count = len(all_sentiments) - bullish - bearish
        total = len(all_sentiments)

        return {
            'symbol': symbol,
            'reddit_posts': reddit_posts,
            'stocktwits_messages': stocktwits_messages,
            'aggregate': {
                'bullish_pct': round(bullish / total * 100, 1) if total else 0,
                'bearish_pct': round(bearish / total * 100, 1) if total else 0,
                'neutral_pct': round(neutral_count / total * 100, 1) if total else 0,
                'message_volume': total,
            },
            'has_reddit': reddit_configured,
        }

    async def get_scorecard(self, symbol: str) -> Dict[str, Any]:
        """Compute 5-category investment scorecard (0-100 each)"""
        try:
            import yfinance as yf
            ticker = yf.Ticker(symbol)
            info = ticker.info

            # ── Fundamentals (ROE, ROA, margins) ──────────────────────────────
            roe = info.get('returnOnEquity') or 0
            roa = info.get('returnOnAssets') or 0
            op_margin = info.get('operatingMargins') or 0
            net_margin = info.get('profitMargins') or 0
            fundamentals_score = min(100, max(0, int(
                (min(roe / 0.20, 1) * 30) +
                (min(roa / 0.10, 1) * 20) +
                (min(op_margin / 0.25, 1) * 30) +
                (min(net_margin / 0.15, 1) * 20)
            ) * 100 // 100))
            fundamentals_detail = {
                'ROE': f"{roe*100:.1f}%" if roe else 'N/A',
                'ROA': f"{roa*100:.1f}%" if roa else 'N/A',
                'Op Margin': f"{op_margin*100:.1f}%" if op_margin else 'N/A',
            }

            # ── Growth ────────────────────────────────────────────────────────
            rev_growth = info.get('revenueGrowth') or 0
            eps_growth = info.get('earningsGrowth') or 0
            eq_growth  = info.get('earningsQuarterlyGrowth') or 0
            growth_score = min(100, max(0, int(
                (min(max(rev_growth, 0) / 0.20, 1) * 40) +
                (min(max(eps_growth, 0) / 0.25, 1) * 40) +
                (min(max(eq_growth,  0) / 0.20, 1) * 20)
            ) * 100 // 100))
            growth_detail = {
                'Rev Growth': f"{rev_growth*100:.1f}%" if rev_growth else 'N/A',
                'EPS Growth': f"{eps_growth*100:.1f}%" if eps_growth else 'N/A',
            }

            # ── Valuation ─────────────────────────────────────────────────────
            pe = info.get('trailingPE') or 0
            pb = info.get('priceToBook') or 0
            ev_ebitda = info.get('enterpriseToEbitda') or 0
            # Lower is better; score 100 if very cheap, 0 if very expensive
            pe_score    = max(0, 100 - min(pe / 30, 1) * 100) if pe > 0 else 50
            pb_score    = max(0, 100 - min(pb / 5, 1) * 100) if pb > 0 else 50
            eveb_score  = max(0, 100 - min(ev_ebitda / 20, 1) * 100) if ev_ebitda > 0 else 50
            valuation_score = int((pe_score * 0.4 + pb_score * 0.3 + eveb_score * 0.3))
            valuation_detail = {
                'P/E': f"{pe:.1f}" if pe else 'N/A',
                'P/B': f"{pb:.1f}" if pb else 'N/A',
                'EV/EBITDA': f"{ev_ebitda:.1f}" if ev_ebitda else 'N/A',
            }

            # ── Sentiment (analyst) ───────────────────────────────────────────
            current_price = info.get('currentPrice') or info.get('regularMarketPrice') or 0
            target_mean   = info.get('targetMeanPrice') or 0
            upside = ((target_mean - current_price) / current_price * 100) if current_price and target_mean else 0
            rec_mean = info.get('recommendationMean') or 3  # 1=Strong Buy, 5=Strong Sell
            analyst_score = max(0, 100 - (rec_mean - 1) / 4 * 100)
            upside_score  = min(100, max(0, 50 + upside * 2))
            sentiment_score = int(analyst_score * 0.6 + upside_score * 0.4)
            sentiment_detail = {
                'Analyst Rating': f"{rec_mean:.1f}/5" if rec_mean else 'N/A',
                'Price Upside': f"+{upside:.1f}%" if upside > 0 else f"{upside:.1f}%",
            }

            # ── Technical (MA position, RSI) ──────────────────────────────────
            price     = info.get('currentPrice') or info.get('regularMarketPrice') or 0
            ma50      = info.get('fiftyDayAverage') or 0
            ma200     = info.get('twoHundredDayAverage') or 0
            ma_score  = 0
            if price and ma50 and ma200:
                if price > ma50 > ma200:
                    ma_score = 100
                elif price > ma50 or price > ma200:
                    ma_score = 60
                else:
                    ma_score = 20
            technical_score = ma_score
            technical_detail = {
                '50 MA': f"${ma50:.2f}" if ma50 else 'N/A',
                '200 MA': f"${ma200:.2f}" if ma200 else 'N/A',
                'Price vs MAs': 'Above' if price > ma50 else 'Below',
            }

            # ── Overall (weighted) ────────────────────────────────────────────
            overall = int(
                fundamentals_score * 0.30 +
                growth_score       * 0.25 +
                valuation_score    * 0.20 +
                sentiment_score    * 0.15 +
                technical_score    * 0.10
            )

            if overall >= 80:
                grade = 'Strong Buy'
            elif overall >= 65:
                grade = 'Buy'
            elif overall >= 45:
                grade = 'Hold'
            elif overall >= 30:
                grade = 'Sell'
            else:
                grade = 'Strong Sell'

            return {
                'symbol': symbol,
                'overall_score': overall,
                'investment_grade': grade,
                'categories': {
                    'fundamentals': {'score': fundamentals_score, 'detail': fundamentals_detail},
                    'growth':       {'score': growth_score,       'detail': growth_detail},
                    'valuation':    {'score': valuation_score,    'detail': valuation_detail},
                    'sentiment':    {'score': sentiment_score,    'detail': sentiment_detail},
                    'technical':    {'score': technical_score,    'detail': technical_detail},
                },
                'outlook': {
                    'short_term':  'Positive' if technical_score >= 60 else 'Neutral' if technical_score >= 30 else 'Negative',
                    'medium_term': 'Positive' if growth_score >= 60 else 'Neutral' if growth_score >= 30 else 'Negative',
                    'long_term':   'Positive' if fundamentals_score >= 60 else 'Neutral' if fundamentals_score >= 30 else 'Negative',
                },
                'ai_report': None,
            }
        except Exception as e:
            log.error(f"Error computing scorecard for {symbol}: {e}")
            return {
                'symbol': symbol, 'overall_score': 0, 'investment_grade': 'N/A',
                'categories': {}, 'outlook': {}, 'ai_report': None,
            }


    # ── Company relations: DB-first pipeline ──────────────────────────────────

    async def _fetch_yahoo_similar_fallback(self, symbol: str, base_sector: str) -> list[dict]:
        """
        Fallback: Yahoo Finance recommendationsbysymbol → competitor 목록
        DB에 데이터 없을 때만 호출 (실시간)
        """
        import httpx
        import asyncio

        url = f"https://query2.finance.yahoo.com/v6/finance/recommendationsbysymbol/{symbol}"
        headers = {"User-Agent": "Mozilla/5.0 (compatible; MarketPulse/1.0)"}
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                r = await client.get(url, headers=headers)
                if r.status_code != 200:
                    return []
                result = r.json().get("finance", {}).get("result", [])
                if not result:
                    return []
                syms = result[0].get("recommendedSymbols", [])
        except Exception as e:
            log.warning(f"Yahoo 유사종목 fallback 실패 [{symbol}]: {e}")
            return []

        nodes = []
        for item in syms[:10]:
            sym = item.get("symbol", "")
            if not sym or sym == symbol:
                continue
            try:
                info = await asyncio.to_thread(lambda s=sym: yf.Ticker(s).info)
                nodes.append({
                    "symbol": sym,
                    "name": info.get("longName", sym),
                    "type": "competitor",
                    "detail": f"{info.get('industry', base_sector)} peer",
                })
            except Exception:
                nodes.append({"symbol": sym, "name": sym, "type": "competitor", "detail": "Peer"})

        return nodes

    async def get_company_relations(self, symbol: str) -> dict:
        """
        종목 관계 그래프 반환 (DB-first)

          Tier 1 – DB (mbs_in_stk_relations)
                   stock_collect_module이 주기적으로 FMP peers로 채운 데이터
                   Coverage: S&P 500 전체
                   Quality : ★★★★

          Tier 2 – Yahoo Finance 실시간 (DB 없을 때 fallback)
                   recommendationsbysymbol → competitor 목록
                   Coverage: 대부분 US 상장 종목
                   Quality : ★★ (peers, supply-chain 아님)
        """
        import asyncio
        from index_analyzer.services.stock_service import (
            get_relations_from_db, get_profile_from_db
        )

        symbol = symbol.upper()

        # ── Tier 1: DB 조회 ────────────────────────────────────────────────
        db_nodes = await asyncio.to_thread(get_relations_from_db, symbol)
        profile  = await asyncio.to_thread(get_profile_from_db, symbol)

        name   = profile.get("stk_nm", symbol) if profile else symbol
        sector = profile.get("sector", "") if profile else ""

        if db_nodes:
            return {
                "symbol": symbol,
                "name":   name,
                "sector": sector,
                "nodes":  db_nodes,
                "found":  True,
                "data_source": "db_fmp_peers",
            }

        # ── Tier 2: Yahoo Finance 실시간 fallback ─────────────────────────
        if not sector:
            try:
                info = await asyncio.to_thread(lambda: yf.Ticker(symbol).info)
                name   = info.get("longName", symbol)
                sector = info.get("sector", "")
            except Exception:
                pass

        yahoo_nodes = await self._fetch_yahoo_similar_fallback(symbol, sector)

        return {
            "symbol": symbol,
            "name":   name,
            "sector": sector,
            "nodes":  yahoo_nodes,
            "found":  bool(yahoo_nodes),
            "data_source": "yahoo_finance",
        }


# Singleton instance
data_service = DataService()

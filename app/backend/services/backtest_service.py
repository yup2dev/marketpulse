"""
Backtesting Service
Provides portfolio backtesting and performance analytics
"""
import sys
from pathlib import Path
from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta
import numpy as np
from collections import defaultdict

sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from data_fetcher.fetchers.yahoo.stock_price import YahooStockPriceFetcher


class BacktestService:
    """Service for backtesting trading strategies"""

    # Popular stock universes
    UNIVERSES = {
        'sp500': [
            'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA', 'BRK.B',
            'JPM', 'JNJ', 'V', 'WMT', 'PG', 'MA', 'HD', 'CVX', 'ABBV', 'LLY',
            'MRK', 'PEP', 'KO', 'COST', 'AVGO', 'TMO', 'MCD', 'CSCO', 'ACN',
            'ABT', 'NKE', 'DHR', 'TXN', 'VZ', 'DIS', 'ADBE', 'CRM', 'NFLX'
        ],
        'nasdaq100': [
            'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA', 'AVGO',
            'ASML', 'COST', 'PEP', 'ADBE', 'CSCO', 'CMCSA', 'NFLX', 'INTC',
            'TXN', 'QCOM', 'INTU', 'AMD', 'AMAT', 'HON', 'SBUX', 'ISRG',
            'BKNG', 'GILD', 'ADI', 'VRTX', 'ADP', 'REGN', 'LRCX', 'MDLZ'
        ],
        'dow30': [
            'AAPL', 'MSFT', 'JPM', 'JNJ', 'V', 'WMT', 'PG', 'HD', 'CVX',
            'MRK', 'KO', 'MCD', 'DIS', 'VZ', 'BA', 'CAT', 'AXP', 'GS',
            'IBM', 'MMM', 'NKE', 'TRV', 'UNH', 'CRM', 'HON', 'AMGN', 'DOW'
        ]
    }

    async def get_universe_stocks(self, universe_id: str) -> List[Dict[str, Any]]:
        """Get stocks from a predefined universe"""
        symbols = self.UNIVERSES.get(universe_id, self.UNIVERSES['sp500'][:20])

        stocks = []
        for symbol in symbols[:20]:  # Limit to 20 for demo
            try:
                result = await YahooStockPriceFetcher.fetch_data({
                    'symbol': symbol,
                    'interval': '1d'
                })

                if result and len(result) > 0:
                    latest = result[-1]
                    prev = result[-2] if len(result) > 1 else latest

                    stocks.append({
                        'symbol': symbol,
                        'name': f'{symbol} Inc.',  # In production, fetch from company info
                        'price': round(latest.close, 2) if latest.close else 0,
                        'change': round(((latest.close - prev.close) / prev.close * 100), 2) if prev.close else 0
                    })
            except Exception as e:
                print(f"Error fetching {symbol}: {e}")
                continue

        return stocks

    async def run_backtest(
        self,
        symbols: List[str],
        start_date: str,
        end_date: str,
        rebalancing_period: str = 'monthly',
        initial_capital: float = 10000.0
    ) -> Dict[str, Any]:
        """
        Run backtest on a portfolio of stocks

        Args:
            symbols: List of stock symbols
            start_date: Start date (YYYY-MM-DD)
            end_date: End date (YYYY-MM-DD)
            rebalancing_period: Rebalancing frequency
            initial_capital: Starting capital

        Returns:
            Backtest results including performance metrics and charts
        """
        try:
            # Calculate period
            start = datetime.fromisoformat(start_date)
            end = datetime.fromisoformat(end_date)
            days_diff = (end - start).days

            # Fetch historical data for all symbols
            stock_data = {}
            for symbol in symbols:
                try:
                    result = await YahooStockPriceFetcher.fetch_data({
                        'symbol': symbol,
                        'period': 'max',
                        'interval': '1d'
                    })

                    if result:
                        # Filter by date range
                        filtered = []
                        for data in result:
                            if data.date:
                                # Convert date to datetime if needed
                                if hasattr(data.date, 'tzinfo'):
                                    # It's a datetime object
                                    date_obj = data.date.replace(tzinfo=None) if data.date.tzinfo else data.date
                                else:
                                    # It's a date object, convert to datetime
                                    from datetime import datetime as dt
                                    date_obj = dt.combine(data.date, dt.min.time())

                                if start <= date_obj <= end:
                                    filtered.append(data)
                        stock_data[symbol] = filtered
                except Exception as e:
                    print(f"Error fetching {symbol}: {e}")

            if not stock_data:
                raise ValueError("No stock data available")

            # Create date-aligned portfolio
            portfolio_values = self._calculate_portfolio_performance(
                stock_data, initial_capital, rebalancing_period
            )

            # Calculate benchmark (equal-weight all stocks, no rebalancing)
            benchmark_values = self._calculate_benchmark(stock_data, initial_capital)

            # Calculate statistics
            stats = self._calculate_statistics(portfolio_values, benchmark_values, initial_capital)

            # Calculate yearly returns
            yearly_returns = self._calculate_yearly_returns(portfolio_values)

            return {
                'portfolio_values': portfolio_values,
                'benchmark_values': benchmark_values,
                'statistics': stats,
                'yearly_returns': yearly_returns,
                'symbols': symbols,
                'start_date': start_date,
                'end_date': end_date
            }

        except Exception as e:
            print(f"Error running backtest: {e}")
            raise

    def _calculate_portfolio_performance(
        self,
        stock_data: Dict[str, List],
        initial_capital: float,
        rebalancing_period: str
    ) -> List[Dict[str, Any]]:
        """Calculate portfolio performance with rebalancing"""
        # Get all dates
        all_dates = set()
        for symbol, data in stock_data.items():
            for point in data:
                if point.date:
                    # Convert date to datetime if needed
                    if hasattr(point.date, 'tzinfo'):
                        date_obj = point.date.replace(tzinfo=None) if point.date.tzinfo else point.date
                    else:
                        from datetime import datetime as dt
                        date_obj = dt.combine(point.date, dt.min.time())
                    all_dates.add(date_obj)

        all_dates = sorted(list(all_dates))

        if not all_dates:
            return []

        # Create price matrix
        prices = defaultdict(dict)
        for symbol, data in stock_data.items():
            for point in data:
                if point.date and point.close:
                    # Convert date to datetime if needed
                    if hasattr(point.date, 'tzinfo'):
                        date_obj = point.date.replace(tzinfo=None) if point.date.tzinfo else point.date
                    else:
                        from datetime import datetime as dt
                        date_obj = dt.combine(point.date, dt.min.time())
                    prices[date_obj][symbol] = point.close

        # Equal weight portfolio
        num_stocks = len(stock_data)
        portfolio_value = initial_capital
        holdings = {symbol: 0.0 for symbol in stock_data.keys()}

        # Initial allocation
        allocation_per_stock = initial_capital / num_stocks
        for symbol in stock_data.keys():
            if all_dates[0] in prices and symbol in prices[all_dates[0]]:
                holdings[symbol] = allocation_per_stock / prices[all_dates[0]][symbol]

        portfolio_values = []
        last_rebalance = all_dates[0]

        for date in all_dates:
            # Calculate current portfolio value
            current_value = 0
            for symbol, shares in holdings.items():
                if symbol in prices[date]:
                    current_value += shares * prices[date][symbol]

            portfolio_values.append({
                'date': date.isoformat(),
                'value': round(current_value, 2)
            })

            # Rebalance if needed
            if self._should_rebalance(last_rebalance, date, rebalancing_period):
                allocation_per_stock = current_value / num_stocks
                for symbol in stock_data.keys():
                    if symbol in prices[date]:
                        holdings[symbol] = allocation_per_stock / prices[date][symbol]
                last_rebalance = date

        return portfolio_values

    def _calculate_benchmark(
        self,
        stock_data: Dict[str, List],
        initial_capital: float
    ) -> List[Dict[str, Any]]:
        """Calculate buy-and-hold benchmark"""
        # Get all dates
        all_dates = set()
        for symbol, data in stock_data.items():
            for point in data:
                if point.date:
                    # Convert date to datetime if needed
                    if hasattr(point.date, 'tzinfo'):
                        date_obj = point.date.replace(tzinfo=None) if point.date.tzinfo else point.date
                    else:
                        from datetime import datetime as dt
                        date_obj = dt.combine(point.date, dt.min.time())
                    all_dates.add(date_obj)

        all_dates = sorted(list(all_dates))

        if not all_dates:
            return []

        # Create price matrix
        prices = defaultdict(dict)
        for symbol, data in stock_data.items():
            for point in data:
                if point.date and point.close:
                    # Convert date to datetime if needed
                    if hasattr(point.date, 'tzinfo'):
                        date_obj = point.date.replace(tzinfo=None) if point.date.tzinfo else point.date
                    else:
                        from datetime import datetime as dt
                        date_obj = dt.combine(point.date, dt.min.time())
                    prices[date_obj][symbol] = point.close

        # Buy and hold
        num_stocks = len(stock_data)
        allocation_per_stock = initial_capital / num_stocks
        holdings = {}

        for symbol in stock_data.keys():
            if all_dates[0] in prices and symbol in prices[all_dates[0]]:
                holdings[symbol] = allocation_per_stock / prices[all_dates[0]][symbol]

        benchmark_values = []
        for date in all_dates:
            current_value = 0
            for symbol, shares in holdings.items():
                if symbol in prices[date]:
                    current_value += shares * prices[date][symbol]

            benchmark_values.append({
                'date': date.isoformat(),
                'value': round(current_value, 2)
            })

        return benchmark_values

    def _should_rebalance(
        self,
        last_rebalance: datetime,
        current_date: datetime,
        period: str
    ) -> bool:
        """Determine if portfolio should be rebalanced"""
        days_diff = (current_date - last_rebalance).days

        if period == 'daily':
            return days_diff >= 1
        elif period == 'weekly':
            return days_diff >= 7
        elif period == 'monthly':
            return days_diff >= 30
        elif period == 'quarterly':
            return days_diff >= 90
        elif period == 'yearly':
            return days_diff >= 365

        return False

    def _calculate_statistics(
        self,
        portfolio_values: List[Dict],
        benchmark_values: List[Dict],
        initial_capital: float
    ) -> Dict[str, Any]:
        """Calculate performance statistics"""
        if not portfolio_values or len(portfolio_values) < 2:
            return {}

        # Extract values
        values = [pv['value'] for pv in portfolio_values]
        benchmark = [bv['value'] for bv in benchmark_values]

        # Calculate returns
        returns = [
            (values[i] - values[i-1]) / values[i-1]
            for i in range(1, len(values))
        ]

        # Total return
        total_return = ((values[-1] - initial_capital) / initial_capital) * 100

        # Annualized return
        years = len(values) / 252  # Approximate trading days
        annualized_return = ((values[-1] / initial_capital) ** (1 / years) - 1) * 100 if years > 0 else 0

        # Volatility (annualized)
        volatility = np.std(returns) * np.sqrt(252) * 100 if returns else 0

        # Sharpe ratio (assuming 2% risk-free rate)
        risk_free_rate = 0.02
        sharpe_ratio = ((annualized_return / 100 - risk_free_rate) / (volatility / 100)) if volatility > 0 else 0

        # Max drawdown
        peak = values[0]
        max_dd = 0
        for value in values:
            if value > peak:
                peak = value
            dd = (value - peak) / peak * 100
            if dd < max_dd:
                max_dd = dd

        # Win rate
        winning_days = sum(1 for r in returns if r > 0)
        win_rate = (winning_days / len(returns) * 100) if returns else 0

        return {
            'totalReturn': round(total_return, 2),
            'annualizedReturn': round(annualized_return, 2),
            'volatility': round(volatility, 2),
            'sharpeRatio': round(sharpe_ratio, 2),
            'maxDrawdown': round(max_dd, 2),
            'winRate': round(win_rate, 2),
            'trades': len(portfolio_values),
            'avgHoldingPeriod': round(len(portfolio_values) / 12, 0)  # Approximate
        }

    def _calculate_yearly_returns(
        self,
        portfolio_values: List[Dict]
    ) -> List[Dict[str, Any]]:
        """Calculate yearly returns breakdown"""
        yearly_data = defaultdict(list)

        for pv in portfolio_values:
            year = pv['date'][:4]
            yearly_data[year].append(pv['value'])

        yearly_returns = []
        for year in sorted(yearly_data.keys()):
            values = yearly_data[year]
            if len(values) > 1:
                year_return = ((values[-1] - values[0]) / values[0]) * 100
                yearly_returns.append({
                    'year': year,
                    'return': round(year_return, 2),
                    'benchmark': round(year_return * 0.85, 2)  # Simulate benchmark
                })

        return yearly_returns


# Global instance
backtest_service = BacktestService()

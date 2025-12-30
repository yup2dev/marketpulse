"""
Macro Economic Service
Provides comprehensive macroeconomic data and analysis
"""
import sys
import logging
from pathlib import Path
from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta

sys.path.insert(0, str(Path(__file__).parent.parent.parent))

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
from data_fetcher.fetchers.fred.series import FredSeriesFetcher
from data_fetcher.fetchers.alphavantage.forex import AlphaVantageForexFetcher
from data_fetcher.utils.helpers import parse_period_to_dates
from data_fetcher.utils.api_keys import get_api_key

log = logging.getLogger(__name__)


class MacroService:
    """Service for comprehensive macroeconomic data"""

    # FRED Series IDs for additional macro indicators
    FRED_SERIES = {
        # Banking & Credit
        'bank_loans': {
            'id': 'TOTLL',
            'name': 'Total Loans and Leases at Commercial Banks',
            'category': 'Banking',
            'unit': 'Billions of Dollars'
        },
        'foreign_bank_assets': {
            'id': 'BALBFRBFF',
            'name': 'Assets and Liabilities of U.S. Branches and Agencies of Foreign Banks',
            'category': 'Banking',
            'unit': 'Billions of Dollars'
        },
        'consumer_credit': {
            'id': 'TOTALSL',
            'name': 'Consumer Credit Outstanding',
            'category': 'Credit',
            'unit': 'Billions of Dollars'
        },
        # Money Supply
        'money_supply_m1': {
            'id': 'M1SL',
            'name': 'M1 Money Supply',
            'category': 'Money Supply',
            'unit': 'Billions of Dollars'
        },
        'money_supply_m2': {
            'id': 'M2SL',
            'name': 'M2 Money Supply',
            'category': 'Money Supply',
            'unit': 'Billions of Dollars'
        },
        # Treasury Rates
        'treasury_10y': {
            'id': 'DGS10',
            'name': '10-Year Treasury Constant Maturity Rate',
            'category': 'Interest Rates',
            'unit': 'Percent'
        },
        'treasury_2y': {
            'id': 'DGS2',
            'name': '2-Year Treasury Constant Maturity Rate',
            'category': 'Interest Rates',
            'unit': 'Percent'
        },
        # Trade
        'trade_balance': {
            'id': 'BOPGSTB',
            'name': 'Trade Balance: Goods and Services',
            'category': 'Trade',
            'unit': 'Millions of Dollars'
        },
        # Real Estate
        'case_shiller': {
            'id': 'CSUSHPISA',
            'name': 'S&P/Case-Shiller U.S. National Home Price Index',
            'category': 'Real Estate',
            'unit': 'Index Jan 2000=100'
        },
    }

    # Major forex pairs
    FOREX_PAIRS = [
        {'from': 'EUR', 'to': 'USD', 'name': 'Euro to US Dollar'},
        {'from': 'USD', 'to': 'JPY', 'name': 'US Dollar to Japanese Yen'},
        {'from': 'GBP', 'to': 'USD', 'name': 'British Pound to US Dollar'},
        {'from': 'USD', 'to': 'CNY', 'name': 'US Dollar to Chinese Yuan'},
        {'from': 'AUD', 'to': 'USD', 'name': 'Australian Dollar to US Dollar'},
    ]

    async def get_economic_indicators_overview(self) -> Dict[str, Any]:
        """Get overview of all major economic indicators (latest values)"""
        indicators = {}

        try:
            # GDP
            gdp_data = await FREDGDPFetcher.fetch_data({})
            if gdp_data and len(gdp_data) > 0:
                indicators['gdp'] = {
                    'value': gdp_data[0].value,
                    'date': gdp_data[0].date.isoformat() if gdp_data[0].date else None,
                    'unit': 'Billions of Dollars',
                    'change': self._calculate_change(gdp_data[:2]) if len(gdp_data) > 1 else None
                }
        except Exception as e:
            log.error(f"Error fetching GDP: {e}")

        try:
            # Unemployment
            unemployment_data = await FREDUnemploymentFetcher.fetch_data({})
            if unemployment_data and len(unemployment_data) > 0:
                indicators['unemployment'] = {
                    'value': unemployment_data[0].value,
                    'date': unemployment_data[0].date.isoformat() if unemployment_data[0].date else None,
                    'unit': 'Percent',
                    'change': self._calculate_change(unemployment_data[:2]) if len(unemployment_data) > 1 else None
                }
        except Exception as e:
            log.error(f"Error fetching unemployment: {e}")

        try:
            # CPI
            cpi_data = await FREDCPIFetcher.fetch_data({})
            if cpi_data and len(cpi_data) > 0:
                indicators['cpi'] = {
                    'value': cpi_data[0].value,
                    'date': cpi_data[0].date.isoformat() if cpi_data[0].date else None,
                    'unit': 'Index',
                    'change': self._calculate_change(cpi_data[:2]) if len(cpi_data) > 1 else None
                }
        except Exception as e:
            log.error(f"Error fetching CPI: {e}")

        try:
            # Fed Funds Rate
            rate_data = await FREDInterestRateFetcher.fetch_data({'rate_type': 'DFF'})
            if rate_data and len(rate_data) > 0:
                indicators['fed_funds_rate'] = {
                    'value': rate_data[0].value,
                    'date': rate_data[0].date.isoformat() if rate_data[0].date else None,
                    'unit': 'Percent',
                    'change': self._calculate_change(rate_data[:2]) if len(rate_data) > 1 else None
                }
        except Exception as e:
            log.error(f"Error fetching Fed Funds Rate: {e}")

        try:
            # Retail Sales
            retail_data = await FREDRetailSalesFetcher.fetch_data({})
            if retail_data and len(retail_data) > 0:
                indicators['retail_sales'] = {
                    'value': retail_data[0].value,
                    'date': retail_data[0].date.isoformat() if retail_data[0].date else None,
                    'unit': 'Millions of Dollars',
                    'change': self._calculate_change(retail_data[:2]) if len(retail_data) > 1 else None
                }
        except Exception as e:
            log.error(f"Error fetching retail sales: {e}")

        try:
            # Consumer Sentiment
            sentiment_data = await FREDConsumerSentimentFetcher.fetch_data({})
            if sentiment_data and len(sentiment_data) > 0:
                indicators['consumer_sentiment'] = {
                    'value': sentiment_data[0].value,
                    'date': sentiment_data[0].date.isoformat() if sentiment_data[0].date else None,
                    'unit': 'Index',
                    'change': self._calculate_change(sentiment_data[:2]) if len(sentiment_data) > 1 else None
                }
        except Exception as e:
            log.error(f"Error fetching consumer sentiment: {e}")

        return indicators

    async def get_fred_series_data(
        self,
        series_key: str,
        period: str = "5y"
    ) -> Dict[str, Any]:
        """
        Get data for a specific FRED series

        Args:
            series_key: Key from FRED_SERIES dict
            period: Time period (1y, 3y, 5y, 10y, max)
        """
        if series_key not in self.FRED_SERIES:
            raise ValueError(f"Unknown series: {series_key}")

        series_info = self.FRED_SERIES[series_key]
        start_date, end_date = parse_period_to_dates(period)

        try:
            api_key = get_api_key(
                credentials=None,
                api_name="FRED",
                env_var="FRED_API_KEY"
            )

            observations = FredSeriesFetcher.fetch_series(
                series_id=series_info['id'],
                api_key=api_key,
                start_date=start_date,
                end_date=end_date
            )

            data = [
                {
                    'date': obs['date'],
                    'value': float(obs['value']) if obs['value'] != '.' else None
                }
                for obs in observations
                if obs['value'] != '.'
            ]

            return {
                'series_key': series_key,
                'series_id': series_info['id'],
                'name': series_info['name'],
                'category': series_info['category'],
                'unit': series_info['unit'],
                'data': data
            }

        except Exception as e:
            log.error(f"Error fetching FRED series {series_key}: {e}")
            raise

    async def get_all_fred_series_overview(self) -> List[Dict[str, Any]]:
        """Get latest values for all additional FRED series"""
        results = []

        for key, info in self.FRED_SERIES.items():
            try:
                api_key = get_api_key(
                    credentials=None,
                    api_name="FRED",
                    env_var="FRED_API_KEY"
                )

                observations = FredSeriesFetcher.fetch_series(
                    series_id=info['id'],
                    api_key=api_key,
                    limit=2
                )

                if observations:
                    latest = observations[-1]
                    prev = observations[-2] if len(observations) > 1 else None

                    value = float(latest['value']) if latest['value'] != '.' else None
                    prev_value = float(prev['value']) if prev and prev['value'] != '.' else None

                    change = None
                    if value is not None and prev_value is not None and prev_value != 0:
                        change = ((value - prev_value) / prev_value) * 100

                    results.append({
                        'key': key,
                        'name': info['name'],
                        'category': info['category'],
                        'value': value,
                        'unit': info['unit'],
                        'date': latest['date'],
                        'change': change
                    })

            except Exception as e:
                log.warning(f"Error fetching {key}: {e}")
                continue

        return results

    async def get_forex_rates(self) -> List[Dict[str, Any]]:
        """Get latest forex exchange rates"""
        rates = []

        for pair in self.FOREX_PAIRS:
            try:
                data = await AlphaVantageForexFetcher.fetch_data({
                    'from_currency': pair['from'],
                    'to_currency': pair['to'],
                    'interval': 'daily'
                })

                if data and len(data) > 0:
                    latest = data[0]
                    prev = data[1] if len(data) > 1 else None

                    change = None
                    if prev and prev.close:
                        change = ((latest.close - prev.close) / prev.close) * 100

                    rates.append({
                        'pair': f"{pair['from']}/{pair['to']}",
                        'name': pair['name'],
                        'rate': latest.close,
                        'date': latest.date.isoformat() if latest.date else None,
                        'change': change,
                        'high': latest.high,
                        'low': latest.low
                    })

            except Exception as e:
                log.warning(f"Error fetching {pair['from']}/{pair['to']}: {e}")
                continue

        return rates

    async def get_forex_history(
        self,
        from_currency: str,
        to_currency: str,
        period: str = "1y"
    ) -> Dict[str, Any]:
        """Get historical forex data"""
        try:
            data = await AlphaVantageForexFetcher.fetch_data({
                'from_currency': from_currency,
                'to_currency': to_currency,
                'interval': 'daily'
            })

            start_date, _ = parse_period_to_dates(period)

            filtered_data = [
                {
                    'date': d.date.isoformat() if d.date else None,
                    'open': d.open,
                    'high': d.high,
                    'low': d.low,
                    'close': d.close
                }
                for d in data
                if d.date and d.date >= start_date
            ]

            return {
                'pair': f"{from_currency}/{to_currency}",
                'data': filtered_data
            }

        except Exception as e:
            log.error(f"Error fetching forex history: {e}")
            raise

    def _calculate_change(self, data: List) -> Optional[float]:
        """Calculate percentage change between two data points"""
        if len(data) < 2:
            return None

        current = data[0].value if hasattr(data[0], 'value') else None
        previous = data[1].value if hasattr(data[1], 'value') else None

        if current is None or previous is None or previous == 0:
            return None

        return ((current - previous) / previous) * 100


# Global instance
macro_service = MacroService()

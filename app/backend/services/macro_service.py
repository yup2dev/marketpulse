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
        # 'foreign_bank_assets': {
        #     'id': 'BALBFRBFF',
        #     'name': 'Assets and Liabilities of U.S. Branches and Agencies of Foreign Banks',
        #     'category': 'Banking',
        #     'unit': 'Billions of Dollars'
        # },
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
        # Commodities - Precious Metals (DEPRECATED - FRED series no longer available)
        # 'gold': {
        #     'id': 'GOLDPMGBD228NLBM',
        #     'name': 'Gold Fixing Price (London)',
        #     'category': 'Commodities',
        #     'unit': 'USD per Troy Ounce'
        # },
        # 'silver': {
        #     'id': 'SLVPRUSD',
        #     'name': 'Global Price of Silver',
        #     'category': 'Commodities',
        #     'unit': 'USD per Troy Ounce'
        # },
        # 'platinum': {
        #     'id': 'PLTMLGBD228NLBM',
        #     'name': 'Platinum Price (London)',
        #     'category': 'Commodities',
        #     'unit': 'USD per Troy Ounce'
        # },
        # 'palladium': {
        #     'id': 'PALUMLGBD228NLBM',
        #     'name': 'Palladium Price (London)',
        #     'category': 'Commodities',
        #     'unit': 'USD per Troy Ounce'
        # },
        # Commodities - Energy
        'crude_oil_wti': {
            'id': 'DCOILWTICO',
            'name': 'Crude Oil Prices: West Texas Intermediate (WTI)',
            'category': 'Commodities',
            'unit': 'USD per Barrel'
        },
        'natural_gas': {
            'id': 'DHHNGSP',
            'name': 'Henry Hub Natural Gas Spot Price',
            'category': 'Commodities',
            'unit': 'USD per Million Btu'
        },
        # Commodities - Industrial Metals
        'copper': {
            'id': 'PCOPPUSDM',
            'name': 'Global Price of Copper',
            'category': 'Commodities',
            'unit': 'USD per Metric Ton'
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
            rate_data = await FREDInterestRateFetcher.fetch_data({'rate_type': 'federal_funds'})
            if rate_data and len(rate_data) > 0:
                # Get the most recent data (last item in sorted list)
                latest = rate_data[-1]
                prev = rate_data[-2] if len(rate_data) > 1 else None

                indicators['fed_funds_rate'] = {
                    'value': latest.rate,
                    'date': latest.date.isoformat() if latest.date else None,
                    'unit': 'Percent',
                    'change': ((latest.rate - prev.rate) / prev.rate * 100) if prev and prev.rate else None
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

    async def get_indicator_history(
        self,
        indicator_key: str,
        period: str = "5y"
    ) -> Dict[str, Any]:
        """
        Get historical data for a specific economic indicator

        Args:
            indicator_key: Indicator identifier (gdp, unemployment, cpi, fed_funds_rate, retail_sales, consumer_sentiment)
            period: Time period (1y, 3y, 5y, 10y, max)

        Returns:
            Dictionary with indicator history data formatted for charts
        """
        # Map indicator keys to fetchers and metadata
        indicator_map = {
            'gdp': {
                'fetcher': FREDGDPFetcher,
                'name': 'Gross Domestic Product',
                'unit': 'Billions of Dollars',
                'params': {}
            },
            'unemployment': {
                'fetcher': FREDUnemploymentFetcher,
                'name': 'Unemployment Rate',
                'unit': 'Percent',
                'params': {}
            },
            'cpi': {
                'fetcher': FREDCPIFetcher,
                'name': 'Consumer Price Index',
                'unit': 'Index',
                'params': {}
            },
            'fed_funds_rate': {
                'fetcher': FREDInterestRateFetcher,
                'name': 'Federal Funds Effective Rate',
                'unit': 'Percent',
                'params': {'rate_type': 'federal_funds'}
            },
            'retail_sales': {
                'fetcher': FREDRetailSalesFetcher,
                'name': 'Advance Retail Sales',
                'unit': 'Millions of Dollars',
                'params': {}
            },
            'consumer_sentiment': {
                'fetcher': FREDConsumerSentimentFetcher,
                'name': 'University of Michigan Consumer Sentiment',
                'unit': 'Index',
                'params': {}
            }
        }

        if indicator_key not in indicator_map:
            raise ValueError(f"Unknown indicator: {indicator_key}")

        indicator_info = indicator_map[indicator_key]
        start_date, end_date = parse_period_to_dates(period)

        try:
            # Fetch historical data
            params = indicator_info['params'].copy()
            if 'start_date' not in params:
                params['start_date'] = start_date
            if 'end_date' not in params:
                params['end_date'] = end_date

            data = await indicator_info['fetcher'].fetch_data(params)

            if not data:
                return {
                    'key': indicator_key,
                    'name': indicator_info['name'],
                    'unit': indicator_info['unit'],
                    'data': []
                }

            # Format data for charts
            chart_data = []
            for item in data:
                # Handle different data structures
                if hasattr(item, 'rate'):  # Interest rate data
                    value = item.rate
                elif hasattr(item, 'value'):  # GDP, CPI, etc.
                    value = item.value
                else:
                    continue

                if hasattr(item, 'date') and item.date:
                    chart_data.append({
                        'date': item.date.isoformat(),
                        'value': round(value, 2) if value is not None else None
                    })

            return {
                'key': indicator_key,
                'name': indicator_info['name'],
                'unit': indicator_info['unit'],
                'data': chart_data
            }

        except Exception as e:
            log.error(f"Error fetching indicator history for {indicator_key}: {e}")
            raise

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

            # Fetch historical data in ascending order for charts
            observations = FredSeriesFetcher.fetch_series(
                series_id=series_info['id'],
                api_key=api_key,
                start_date=start_date,
                end_date=end_date,
                sort_order='asc'
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

                # Fetch with sort_order='desc' to get most recent data first
                observations = FredSeriesFetcher.fetch_series(
                    series_id=info['id'],
                    api_key=api_key,
                    limit=2,
                    sort_order='desc'
                )

                if observations:
                    # With sort_order='desc', index 0 is most recent
                    latest = observations[0]
                    prev = observations[1] if len(observations) > 1 else None

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

        # Check if AlphaVantage API key is available
        try:
            from data_fetcher.utils.api_keys import get_api_key
            api_key = get_api_key(
                credentials=None,
                api_name="AlphaVantage",
                env_var="ALPHAVANTAGE_API_KEY"
            )
            if not api_key:
                log.info("AlphaVantage API key not configured, skipping forex rates")
                return rates
        except Exception as e:
            log.info(f"AlphaVantage API key not available, skipping forex rates: {e}")
            return rates

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

    async def get_commodity_ratios(self) -> Dict[str, Any]:
        """
        Calculate important commodity ratios
        Returns ratios like Gold/Silver, Gold/Oil, Copper/Gold

        NOTE: Precious metal series (gold, silver) are currently unavailable from FRED.
        This function is deprecated and returns empty dict.
        """
        ratios = {}

        # DEPRECATED: Gold and silver series are no longer available from FRED
        # Commodity ratios cannot be calculated without these base prices
        log.warning("Commodity ratios are currently unavailable - FRED precious metal series deprecated")

        return ratios

    async def get_ratio_history(
        self,
        ratio_type: str,
        period: str = "5y"
    ) -> Dict[str, Any]:
        """
        Get historical data for commodity ratios

        Args:
            ratio_type: Type of ratio (gold_silver, gold_oil, copper_gold)
            period: Time period (1y, 3y, 5y, 10y, max)

        NOTE: DEPRECATED - Precious metal series are no longer available from FRED.
        This function will return empty data.
        """
        log.warning(f"Ratio history for {ratio_type} is unavailable - FRED precious metal series deprecated")

        return {
            'ratio_type': ratio_type,
            'name': f'{ratio_type} Ratio (Unavailable)',
            'description': 'FRED precious metal series deprecated',
            'data': []
        }

    def _calculate_ratio_series(
        self,
        numerator_obs: List,
        denominator_obs: List,
        numerator_scale: float = 1.0
    ) -> List[Dict[str, Any]]:
        """Calculate ratio time series from two observation series"""
        # Create date map for denominator
        denom_map = {
            obs['date']: float(obs['value']) if obs['value'] != '.' else None
            for obs in denominator_obs
        }

        data = []
        for num_obs in numerator_obs:
            if num_obs['value'] == '.':
                continue

            date = num_obs['date']
            num_value = float(num_obs['value']) * numerator_scale
            denom_value = denom_map.get(date)

            if denom_value and denom_value != 0:
                data.append({
                    'date': date,
                    'value': num_value / denom_value
                })

        return data

    def _calculate_change(self, data: List) -> Optional[float]:
        """Calculate percentage change between two data points"""
        if len(data) < 2:
            return None

        current = data[0].value if hasattr(data[0], 'value') else None
        previous = data[1].value if hasattr(data[1], 'value') else None

        if current is None or previous is None or previous == 0:
            return None

        return ((current - previous) / previous) * 100

    async def get_current_regime(self) -> Dict[str, Any]:
        """
        Calculate current economic regime based on Growth and Inflation

        Returns:
            {
                'regime': str,  # 'goldilocks', 'reflation', 'stagflation', 'deflation'
                'growth_score': float,  # -100 to +100
                'inflation_score': float,  # -100 to +100
                'growth_momentum': float,  # 3m change
                'inflation_momentum': float,  # 3m change
                'timestamp': str,
                'components': {
                    'gdp_growth': float,  # Already in %
                    'industrial_production_yoy': float,
                    'employment_yoy': float,
                    'cpi_yoy': float
                }
            }
        """
        try:
            components = {}

            # Fetch Growth components
            # 1. GDP Growth Rate (already in % from FRED)
            # FRED series A191RA1Q225SBEA: Real GDP, Percent Change from Preceding Period, SAAR
            gdp_data = await FREDGDPFetcher.fetch_data({})
            # GDP data comes DESC (most recent first)
            if gdp_data and len(gdp_data) > 0:
                # value is already the growth rate %
                components['gdp_growth'] = gdp_data[0].value
            else:
                components['gdp_growth'] = 0

            # 2. Industrial Production YoY
            try:
                indpro_data = await FREDIndustrialProductionFetcher.fetch_data({})
                # Check data ordering
                if indpro_data and len(indpro_data) > 0:
                    # Sort DESC by date
                    indpro_sorted = sorted(indpro_data, key=lambda x: x.date, reverse=True)
                    if len(indpro_sorted) >= 13:  # Need 12 months for YoY
                        current_ip = indpro_sorted[0].value
                        year_ago_ip = indpro_sorted[12].value
                        components['industrial_production_yoy'] = ((current_ip - year_ago_ip) / year_ago_ip * 100) if year_ago_ip else 0
                    else:
                        components['industrial_production_yoy'] = 0
                else:
                    components['industrial_production_yoy'] = 0
            except Exception as e:
                log.warning(f"Could not fetch industrial production: {e}")
                components['industrial_production_yoy'] = 0

            # 3. Employment YoY (using Nonfarm Payroll)
            try:
                employment_data = await FREDNonfarmPayrollFetcher.fetch_data({})
                if employment_data and len(employment_data) > 0:
                    # Sort DESC by date
                    emp_sorted = sorted(employment_data, key=lambda x: x.date, reverse=True)
                    if len(emp_sorted) >= 13:
                        current_emp = emp_sorted[0].value
                        year_ago_emp = emp_sorted[12].value
                        components['employment_yoy'] = ((current_emp - year_ago_emp) / year_ago_emp * 100) if year_ago_emp else 0
                    else:
                        components['employment_yoy'] = 0
                else:
                    components['employment_yoy'] = 0
            except Exception as e:
                log.warning(f"Could not fetch employment: {e}")
                components['employment_yoy'] = 0

            # Fetch Inflation components
            # 4. CPI YoY
            cpi_data = await FREDCPIFetcher.fetch_data({})
            if cpi_data and len(cpi_data) > 0:
                # Sort DESC by date (CPI comes ASC)
                cpi_sorted = sorted(cpi_data, key=lambda x: x.date, reverse=True)
                if len(cpi_sorted) >= 13:  # Need 12 months for YoY
                    current_cpi = cpi_sorted[0].value
                    year_ago_cpi = cpi_sorted[12].value
                    components['cpi_yoy'] = ((current_cpi - year_ago_cpi) / year_ago_cpi * 100) if year_ago_cpi else 0
                else:
                    components['cpi_yoy'] = 0
            else:
                components['cpi_yoy'] = 0

            # Calculate composite scores
            # Growth Score: weighted average, normalized to -100 to +100
            # Typical ranges: GDP -5 to +10%, IndPro -10 to +10%, Employment -2 to +4%
            growth_score = (
                (components['gdp_growth'] / 5.0) * 100 * 0.5 +  # GDP weighted 50%
                (components['industrial_production_yoy'] / 10.0) * 100 * 0.25 +  # IndPro 25%
                (components['employment_yoy'] / 3.0) * 100 * 0.25  # Employment 25%
            )
            growth_score = max(-100, min(100, growth_score))  # Clamp

            # Inflation Score: normalized
            # CPI YoY: -2% to +10% range, centered at 2% target
            inflation_score = (components['cpi_yoy'] - 2.0) / 6.0 * 100
            inflation_score = max(-100, min(100, inflation_score))

            # Calculate momentum (quarterly for GDP, monthly for CPI)
            growth_momentum = 0.0
            inflation_momentum = 0.0

            if gdp_data and len(gdp_data) >= 2:
                # Momentum = difference in growth rates (not percentage of percentage!)
                growth_momentum = gdp_data[0].value - gdp_data[1].value

            if cpi_data and len(cpi_data) > 0:
                cpi_sorted = sorted(cpi_data, key=lambda x: x.date, reverse=True)
                if len(cpi_sorted) >= 4:
                    # CPI momentum: 3-month change in YoY rate
                    current_cpi_yoy = components['cpi_yoy']
                    # Calculate YoY for 3 months ago
                    if len(cpi_sorted) >= 16:  # Need 12 + 3 months
                        three_mo_ago = cpi_sorted[3].value
                        fifteen_mo_ago = cpi_sorted[15].value
                        three_mo_cpi_yoy = ((three_mo_ago - fifteen_mo_ago) / fifteen_mo_ago * 100) if fifteen_mo_ago else current_cpi_yoy
                        inflation_momentum = current_cpi_yoy - three_mo_cpi_yoy
                    else:
                        inflation_momentum = 0

            # Determine regime
            regime = self._classify_regime(growth_score, inflation_score, components['cpi_yoy'])

            return {
                'regime': regime,
                'growth_score': round(growth_score, 2),
                'inflation_score': round(inflation_score, 2),
                'growth_momentum': round(growth_momentum, 2),
                'inflation_momentum': round(inflation_momentum, 2),
                'timestamp': datetime.now().isoformat(),
                'components': {k: round(v, 2) for k, v in components.items()}
            }

        except Exception as e:
            log.error(f"Error calculating current regime: {e}")
            raise

    def _classify_regime(self, growth_score: float, inflation_score: float, cpi_yoy: float) -> str:
        """
        Classify economic regime based on growth and inflation scores

        4 Regimes:
        - Goldilocks: Growth positive, Inflation moderate (ideal)
        - Reflation: Growth recovering, Inflation rising (recovery phase)
        - Stagflation: Growth weak, Inflation high (worst case)
        - Deflation: Growth weak, Inflation low/negative (recession)
        """
        # Thresholds
        GROWTH_THRESHOLD = 0  # Above 0 is positive growth
        INFLATION_TARGET = 2.0  # Fed's 2% target
        INFLATION_HIGH = 3.0  # Above 3% is concerning

        if growth_score > GROWTH_THRESHOLD:
            # Positive growth
            if cpi_yoy < INFLATION_HIGH:
                return 'goldilocks'  # Growth + moderate inflation = ideal
            else:
                return 'reflation'  # Growth + high inflation = overheating
        else:
            # Negative/weak growth
            if cpi_yoy > INFLATION_HIGH:
                return 'stagflation'  # Weak growth + high inflation = worst
            else:
                return 'deflation'  # Weak growth + low inflation = recession

    async def get_regime_history(self, period: str = '5y') -> Dict[str, Any]:
        """
        Get historical economic regime data

        Args:
            period: Time period (1y, 3y, 5y, 10y, max)

        Returns:
            {
                'history': [
                    {
                        'date': str,
                        'regime': str,
                        'growth_score': float,
                        'inflation_score': float
                    },
                    ...
                ],
                'regime_transitions': [
                    {
                        'date': str,
                        'from': str,
                        'to': str
                    },
                    ...
                ]
            }
        """
        try:
            start_date, end_date = parse_period_to_dates(period)

            # Fetch historical data
            gdp_data = await FREDGDPFetcher.fetch_data({})
            cpi_data = await FREDCPIFetcher.fetch_data({})

            # Filter and sort by date
            gdp_filtered = [d for d in gdp_data if d.date and start_date <= d.date <= end_date]
            cpi_filtered = [d for d in cpi_data if d.date and start_date <= d.date <= end_date]

            # Sort ascending for chronological order
            gdp_filtered.sort(key=lambda x: x.date)
            cpi_filtered.sort(key=lambda x: x.date)

            # Sort CPI descending for easier YoY calc
            cpi_all_sorted = sorted(cpi_data, key=lambda x: x.date, reverse=True)

            history = []

            # Calculate regime for each GDP data point (quarterly)
            for gdp_point in gdp_filtered:
                # GDP value is already growth rate %
                gdp_growth = gdp_point.value

                # Find closest CPI data point
                closest_cpi = min(cpi_filtered, key=lambda x: abs((x.date - gdp_point.date).days))

                # Calculate CPI YoY
                try:
                    cpi_idx = next(i for i, c in enumerate(cpi_all_sorted) if c.date == closest_cpi.date)
                    if cpi_idx + 12 < len(cpi_all_sorted):
                        year_ago_cpi = cpi_all_sorted[cpi_idx + 12].value
                        cpi_yoy = ((closest_cpi.value - year_ago_cpi) / year_ago_cpi * 100) if year_ago_cpi else 0
                    else:
                        cpi_yoy = 0
                except (StopIteration, ValueError):
                    cpi_yoy = 0

                # Growth score (GDP is already %, just normalize)
                growth_score = (gdp_growth / 5.0) * 100
                growth_score = max(-100, min(100, growth_score))

                # Inflation score
                inflation_score = (cpi_yoy - 2.0) / 6.0 * 100
                inflation_score = max(-100, min(100, inflation_score))

                # Classify regime
                regime = self._classify_regime(growth_score, inflation_score, cpi_yoy)

                history.append({
                    'date': gdp_point.date.isoformat(),
                    'regime': regime,
                    'growth_score': round(growth_score, 2),
                    'inflation_score': round(inflation_score, 2),
                    'gdp_growth': round(gdp_growth, 2),
                    'cpi_yoy': round(cpi_yoy, 2)
                })

            # Detect regime transitions
            transitions = []
            for i in range(1, len(history)):
                if history[i]['regime'] != history[i-1]['regime']:
                    transitions.append({
                        'date': history[i]['date'],
                        'from': history[i-1]['regime'],
                        'to': history[i]['regime']
                    })

            return {
                'history': history,
                'regime_transitions': transitions,
                'period': period
            }

        except Exception as e:
            log.error(f"Error fetching regime history: {e}")
            raise

    async def get_fed_policy_stance(self) -> Dict[str, Any]:
        """
        Calculate Federal Reserve policy stance

        Returns analysis of Fed's hawkish/dovish position based on:
        - Fed Funds Rate level and trajectory
        - Rate change velocity
        - Historical context
        """
        try:
            # Fetch Fed Funds Rate history
            rate_data = await FREDInterestRateFetcher.fetch_data({'rate_type': 'federal_funds'})

            if not rate_data or len(rate_data) < 2:
                raise ValueError("Insufficient Fed Funds Rate data")

            # Sort by date descending (most recent first)
            rate_data_sorted = sorted(rate_data, key=lambda x: x.date, reverse=True)

            # Current rate
            current_rate = rate_data_sorted[0].rate
            current_date = rate_data_sorted[0].date

            # Calculate rate changes over 12 months
            twelve_months_ago = datetime.now().date() - timedelta(days=365)
            recent_rates = [r for r in rate_data_sorted if r.date and r.date >= twelve_months_ago]

            # Count rate changes
            rate_changes_12m = 0
            for i in range(len(recent_rates) - 1):
                if abs(recent_rates[i].rate - recent_rates[i+1].rate) > 0.01:  # Significant change
                    rate_changes_12m += 1

            # Historical context
            peak_rate = max(r.rate for r in rate_data_sorted)
            trough_rate = min(r.rate for r in rate_data_sorted)

            # Calculate stance score (-100 to +100)
            # Based on: rate level, rate momentum, change frequency
            rate_level_score = ((current_rate - 2.0) / 3.0) * 50  # Normalized around 2% neutral

            # Momentum: compare current to 3 months ago
            three_months_ago = datetime.now().date() - timedelta(days=90)
            three_month_rates = [r for r in rate_data_sorted if r.date and r.date >= three_months_ago]
            if len(three_month_rates) >= 2:
                rate_momentum = (three_month_rates[0].rate - three_month_rates[-1].rate) * 10
            else:
                rate_momentum = 0

            stance_score = rate_level_score + rate_momentum
            stance_score = max(-100, min(100, stance_score))

            # Classify stance
            if stance_score > 30:
                stance = 'hawkish'
            elif stance_score < -30:
                stance = 'dovish'
            else:
                stance = 'neutral'

            # Simplified next meeting probabilities
            # In reality, this would use Fed Funds Futures data
            # For now, base on recent momentum
            if stance == 'hawkish' and current_rate < peak_rate - 0.5:
                probs = {'hike': 65, 'hold': 30, 'cut': 5}
            elif stance == 'dovish' and current_rate > trough_rate + 0.5:
                probs = {'hike': 5, 'hold': 30, 'cut': 65}
            else:
                probs = {'hike': 20, 'hold': 60, 'cut': 20}

            return {
                'stance': stance,
                'stance_score': round(stance_score, 2),
                'fed_funds_rate': round(current_rate, 2),
                'fed_funds_target_range': {
                    'lower': round(current_rate - 0.25, 2),
                    'upper': round(current_rate, 2)
                },
                'last_updated': current_date.isoformat() if current_date else None,
                'next_meeting': {
                    'date': 'TBD',  # Would need FOMC calendar integration
                    'probabilities': probs
                },
                'historical_context': {
                    'rate_changes_12m': rate_changes_12m,
                    'peak_rate': round(peak_rate, 2),
                    'trough_rate': round(trough_rate, 2),
                    'percentile': round((current_rate - trough_rate) / (peak_rate - trough_rate) * 100, 1) if peak_rate != trough_rate else 50
                }
            }

        except Exception as e:
            log.error(f"Error calculating Fed policy stance: {e}")
            raise

    async def get_yield_curve(self) -> Dict[str, Any]:
        """
        Get current Treasury yield curve and calculate key metrics

        Returns full curve data, spreads, and shape analysis
        """
        try:
            api_key = get_api_key(
                credentials=None,
                api_name="FRED",
                env_var="FRED_API_KEY"
            )

            # Define Treasury maturities to fetch
            maturities = [
                {'key': '3m', 'series': 'DGS3MO', 'years': 0.25, 'name': '3-Month'},
                {'key': '6m', 'series': 'DGS6MO', 'years': 0.5, 'name': '6-Month'},
                {'key': '1y', 'series': 'DGS1', 'years': 1, 'name': '1-Year'},
                {'key': '2y', 'series': 'DGS2', 'years': 2, 'name': '2-Year'},
                {'key': '5y', 'series': 'DGS5', 'years': 5, 'name': '5-Year'},
                {'key': '10y', 'series': 'DGS10', 'years': 10, 'name': '10-Year'},
                {'key': '30y', 'series': 'DGS30', 'years': 30, 'name': '30-Year'}
            ]

            curve = []
            yields_dict = {}

            # Fetch current yield for each maturity
            for mat in maturities:
                try:
                    obs = FredSeriesFetcher.fetch_series(
                        series_id=mat['series'],
                        api_key=api_key,
                        limit=1,
                        sort_order='desc'
                    )
                    if obs and obs[0]['value'] != '.':
                        yield_value = float(obs[0]['value'])
                        curve.append({
                            'maturity': mat['name'],
                            'years': mat['years'],
                            'yield': yield_value
                        })
                        yields_dict[mat['key']] = yield_value
                except Exception as e:
                    log.warning(f"Could not fetch {mat['name']}: {e}")
                    continue

            # Calculate key spreads
            spreads = {}
            if '2y' in yields_dict and '10y' in yields_dict:
                spreads['2y10y'] = round(yields_dict['10y'] - yields_dict['2y'], 2)
            if '3m' in yields_dict and '10y' in yields_dict:
                spreads['3m10y'] = round(yields_dict['10y'] - yields_dict['3m'], 2)
            if '5y' in yields_dict and '30y' in yields_dict:
                spreads['5y30y'] = round(yields_dict['30y'] - yields_dict['5y'], 2)

            # Determine curve shape
            inversion_signal = False
            curve_shape = 'normal'

            if '2y10y' in spreads:
                if spreads['2y10y'] < 0:
                    curve_shape = 'inverted'
                    inversion_signal = True
                elif spreads['2y10y'] < 0.25:
                    curve_shape = 'flat'

            # Historical percentile (simplified - would need historical data)
            historical_percentile = {}
            if '2y10y' in spreads:
                # Typical range: -2% to +3%
                percentile = ((spreads['2y10y'] + 2) / 5) * 100
                historical_percentile['2y10y'] = round(max(0, min(100, percentile)), 1)

            return {
                'curve': curve,
                'spreads': spreads,
                'curve_shape': curve_shape,
                'inversion_signal': inversion_signal,
                'historical_percentile': historical_percentile,
                'timestamp': datetime.now().isoformat()
            }

        except Exception as e:
            log.error(f"Error fetching yield curve: {e}")
            raise

    async def get_yield_curve_history(self, period: str = '5y') -> Dict[str, Any]:
        """
        Get historical yield curve spread data

        Args:
            period: Time period (1y, 3y, 5y, 10y, max)

        Returns:
            Historical spreads and inversion events
        """
        try:
            start_date, end_date = parse_period_to_dates(period)

            api_key = get_api_key(
                credentials=None,
                api_name="FRED",
                env_var="FRED_API_KEY"
            )

            # Fetch historical data for key maturities
            # Using FRED series IDs matching interest_rate.py FRED_SERIES_MAP
            series_to_fetch = {
                '3m': 'DTB3',     # 3-Month Treasury Bill
                '6m': 'DTB6',     # 6-Month Treasury Bill
                '1y': 'DGS1',     # 1-Year Treasury Rate
                '2y': 'DGS2',     # 2-Year Treasury Rate
                '5y': 'DGS5',     # 5-Year Treasury Rate
                '10y': 'DGS10',   # 10-Year Treasury Rate
                '30y': 'DGS30'    # 30-Year Treasury Rate
            }

            historical_data = {}
            for key, series_id in series_to_fetch.items():
                try:
                    obs = FredSeriesFetcher.fetch_series(
                        series_id=series_id,
                        api_key=api_key,
                        start_date=start_date,
                        end_date=end_date,
                        sort_order='asc'
                    )
                    historical_data[key] = {
                        obs['date']: float(obs['value']) if obs['value'] != '.' else None
                        for obs in obs
                    }
                except Exception as e:
                    log.warning(f"Could not fetch historical data for {key}: {e}")
                    historical_data[key] = {}

            # Calculate historical spreads
            spreads_history = []

            # Get all dates where we have data
            all_dates = sorted(set(
                date for series_data in historical_data.values()
                for date in series_data.keys()
            ))

            for date in all_dates:
                point = {'date': date}

                # 2y-10y spread
                if (date in historical_data.get('2y', {}) and
                    date in historical_data.get('10y', {}) and
                    historical_data['2y'][date] is not None and
                    historical_data['10y'][date] is not None):
                    point['2y10y'] = round(
                        historical_data['10y'][date] - historical_data['2y'][date],
                        2
                    )

                # 3m-10y spread
                if (date in historical_data.get('3m', {}) and
                    date in historical_data.get('10y', {}) and
                    historical_data['3m'][date] is not None and
                    historical_data['10y'][date] is not None):
                    point['3m10y'] = round(
                        historical_data['10y'][date] - historical_data['3m'][date],
                        2
                    )

                if len(point) > 1:  # Has date + at least one spread
                    spreads_history.append(point)

            # Detect inversion events (2y-10y spread goes negative)
            inversions = []
            in_inversion = False
            inversion_start = None

            for point in spreads_history:
                if '2y10y' in point:
                    if point['2y10y'] < 0 and not in_inversion:
                        in_inversion = True
                        inversion_start = point['date']
                    elif point['2y10y'] >= 0 and in_inversion:
                        inversions.append({
                            'start': inversion_start,
                            'end': point['date']
                        })
                        in_inversion = False
                        inversion_start = None

            # If still in inversion at end of period
            if in_inversion:
                inversions.append({
                    'start': inversion_start,
                    'end': spreads_history[-1]['date']
                })

            # Prepare individual yields history for charting
            yields_history = []
            for date in all_dates:
                point = {'date': date}
                # Add all available maturity yields
                for key in ['3m', '6m', '1y', '2y', '5y', '10y', '30y']:
                    if date in historical_data.get(key, {}) and historical_data[key][date] is not None:
                        point[key] = round(historical_data[key][date], 2)

                if len(point) > 1:  # Has date + at least one yield
                    yields_history.append(point)

            return {
                'spreads_history': spreads_history,
                'yields_history': yields_history,
                'inversion_events': inversions,
                'period': period
            }

        except Exception as e:
            log.error(f"Error fetching yield curve history: {e}")
            raise

    async def get_inflation_decomposition(self) -> Dict[str, Any]:
        """
        Get detailed inflation breakdown and analysis

        Returns inflation components, sticky vs flexible prices, and expectations
        """
        try:
            api_key = get_api_key(
                credentials=None,
                api_name="FRED",
                env_var="FRED_API_KEY"
            )

            # Fetch CPI data
            cpi_data = await FREDCPIFetcher.fetch_data({})
            cpi_sorted = sorted(cpi_data, key=lambda x: x.date, reverse=True)

            # Calculate headline CPI metrics
            headline_cpi = {}
            if len(cpi_sorted) >= 13:
                current_cpi = cpi_sorted[0].value
                month_ago_cpi = cpi_sorted[1].value if len(cpi_sorted) > 1 else current_cpi
                year_ago_cpi = cpi_sorted[12].value

                headline_cpi = {
                    'current': round(current_cpi, 2),
                    'yoy': round(((current_cpi - year_ago_cpi) / year_ago_cpi * 100), 2),
                    'mom': round(((current_cpi - month_ago_cpi) / month_ago_cpi * 100), 2),
                    'date': cpi_sorted[0].date.isoformat() if cpi_sorted[0].date else None
                }

            # Fetch Core CPI (CPI Less Food and Energy)
            core_cpi = {}
            try:
                core_obs = FredSeriesFetcher.fetch_series(
                    series_id='CPILFESL',  # Core CPI
                    api_key=api_key,
                    limit=13,
                    sort_order='desc'
                )
                if core_obs and len(core_obs) >= 13:
                    current_core = float(core_obs[0]['value'])
                    month_ago_core = float(core_obs[1]['value'])
                    year_ago_core = float(core_obs[12]['value'])

                    core_cpi = {
                        'current': round(current_core, 2),
                        'yoy': round(((current_core - year_ago_core) / year_ago_core * 100), 2),
                        'mom': round(((current_core - month_ago_core) / month_ago_core * 100), 2)
                    }
            except Exception as e:
                log.warning(f"Could not fetch core CPI: {e}")

            # CPI Component breakdown (simplified - FRED has limited granular data)
            # In production, would fetch from BLS API with detailed categories
            components = [
                {
                    'category': 'Food',
                    'weight': 13.4,  # % of CPI basket
                    'yoy_change': 2.5,  # Simplified estimate
                    'contribution': 0.34
                },
                {
                    'category': 'Energy',
                    'weight': 7.2,
                    'yoy_change': -5.0,
                    'contribution': -0.36
                },
                {
                    'category': 'Shelter',
                    'weight': 32.9,
                    'yoy_change': 5.5,
                    'contribution': 1.81
                },
                {
                    'category': 'Services (ex-shelter)',
                    'weight': 24.5,
                    'yoy_change': 3.8,
                    'contribution': 0.93
                },
                {
                    'category': 'Goods (ex-food, energy)',
                    'weight': 22.0,
                    'yoy_change': 1.2,
                    'contribution': 0.26
                }
            ]

            # Sticky vs Flexible CPI (from Atlanta Fed)
            sticky_vs_flexible = {}
            try:
                # Sticky CPI: CORESTICKM159SFRBATL
                sticky_obs = FredSeriesFetcher.fetch_series(
                    series_id='CORESTICKM159SFRBATL',
                    api_key=api_key,
                    limit=1,
                    sort_order='desc'
                )
                # Flexible CPI: COREFLEXM159SFRBATL
                flexible_obs = FredSeriesFetcher.fetch_series(
                    series_id='COREFLEXM159SFRBATL',
                    api_key=api_key,
                    limit=1,
                    sort_order='desc'
                )

                if sticky_obs and flexible_obs:
                    sticky_vs_flexible = {
                        'sticky_cpi_yoy': round(float(sticky_obs[0]['value']), 2) if sticky_obs[0]['value'] != '.' else None,
                        'flexible_cpi_yoy': round(float(flexible_obs[0]['value']), 2) if flexible_obs[0]['value'] != '.' else None
                    }
            except Exception as e:
                log.warning(f"Could not fetch sticky/flexible CPI: {e}")

            # Inflation Expectations (Breakeven rates)
            expectations = {}
            try:
                # 5-Year Breakeven: T5YIE
                five_yr_obs = FredSeriesFetcher.fetch_series(
                    series_id='T5YIE',
                    api_key=api_key,
                    limit=1,
                    sort_order='desc'
                )
                # 10-Year Breakeven: T10YIE
                ten_yr_obs = FredSeriesFetcher.fetch_series(
                    series_id='T10YIE',
                    api_key=api_key,
                    limit=1,
                    sort_order='desc'
                )

                if five_yr_obs and five_yr_obs[0]['value'] != '.':
                    expectations['5y_breakeven'] = round(float(five_yr_obs[0]['value']), 2)
                if ten_yr_obs and ten_yr_obs[0]['value'] != '.':
                    expectations['10y_breakeven'] = round(float(ten_yr_obs[0]['value']), 2)
            except Exception as e:
                log.warning(f"Could not fetch breakeven rates: {e}")

            return {
                'headline_cpi': headline_cpi,
                'core_cpi': core_cpi,
                'components': components,
                'sticky_vs_flexible': sticky_vs_flexible,
                'expectations': expectations,
                'timestamp': datetime.now().isoformat()
            }

        except Exception as e:
            log.error(f"Error fetching inflation decomposition: {e}")
            raise

    async def get_labor_dashboard(self) -> Dict[str, Any]:
        """
        Get comprehensive labor market metrics

        Returns unemployment, job market, wages, and labor market heat index
        """
        try:
            api_key = get_api_key(
                credentials=None,
                api_name="FRED",
                env_var="FRED_API_KEY"
            )

            # Unemployment metrics
            unemployment = {}
            try:
                # U3 (official unemployment rate)
                u3_data = await FREDUnemploymentFetcher.fetch_data({})
                u3_sorted = sorted(u3_data, key=lambda x: x.date, reverse=True)

                # U6 (broader unemployment) - FRED: U6RATE
                u6_obs = FredSeriesFetcher.fetch_series(
                    series_id='U6RATE',
                    api_key=api_key,
                    limit=2,
                    sort_order='desc'
                )

                # Labor Force Participation Rate - FRED: CIVPART
                lfpr_obs = FredSeriesFetcher.fetch_series(
                    series_id='CIVPART',
                    api_key=api_key,
                    limit=2,
                    sort_order='desc'
                )

                if u3_sorted:
                    current_u3 = u3_sorted[0].value
                    prev_u3 = u3_sorted[1].value if len(u3_sorted) > 1 else current_u3

                    # Determine trend
                    if current_u3 < prev_u3 - 0.1:
                        trend = 'improving'
                    elif current_u3 > prev_u3 + 0.1:
                        trend = 'deteriorating'
                    else:
                        trend = 'stable'

                    unemployment = {
                        'u3': round(current_u3, 1),
                        'u6': round(float(u6_obs[0]['value']), 1) if u6_obs and u6_obs[0]['value'] != '.' else None,
                        'participation_rate': round(float(lfpr_obs[0]['value']), 1) if lfpr_obs and lfpr_obs[0]['value'] != '.' else None,
                        'trend': trend
                    }
            except Exception as e:
                log.warning(f"Error fetching unemployment data: {e}")

            # Job market metrics
            job_market = {}
            try:
                # Nonfarm Payrolls
                payroll_data = await FREDNonfarmPayrollFetcher.fetch_data({})
                payroll_sorted = sorted(payroll_data, key=lambda x: x.date, reverse=True)

                # JOLTS Job Openings - JTSJOL
                jolts_obs = FredSeriesFetcher.fetch_series(
                    series_id='JTSJOL',
                    api_key=api_key,
                    limit=1,
                    sort_order='desc'
                )

                # Quits Rate - JTSQUR
                quits_obs = FredSeriesFetcher.fetch_series(
                    series_id='JTSQUR',
                    api_key=api_key,
                    limit=1,
                    sort_order='desc'
                )

                # Initial Jobless Claims - ICSA
                claims_obs = FredSeriesFetcher.fetch_series(
                    series_id='ICSA',
                    api_key=api_key,
                    limit=1,
                    sort_order='desc'
                )

                # Continuing Claims - CCSA
                cont_claims_obs = FredSeriesFetcher.fetch_series(
                    series_id='CCSA',
                    api_key=api_key,
                    limit=1,
                    sort_order='desc'
                )

                if payroll_sorted and len(payroll_sorted) >= 2:
                    current_payroll = payroll_sorted[0].value
                    prev_payroll = payroll_sorted[1].value
                    payroll_change = int(current_payroll - prev_payroll)

                    job_market = {
                        'nonfarm_payrolls': int(current_payroll),
                        'payroll_change_mom': payroll_change,
                        'jolts_openings': int(float(jolts_obs[0]['value'])) if jolts_obs and jolts_obs[0]['value'] != '.' else None,
                        'quits_rate': round(float(quits_obs[0]['value']), 1) if quits_obs and quits_obs[0]['value'] != '.' else None,
                        'initial_claims': int(float(claims_obs[0]['value'])) if claims_obs and claims_obs[0]['value'] != '.' else None,
                        'continuing_claims': int(float(cont_claims_obs[0]['value'])) if cont_claims_obs and cont_claims_obs[0]['value'] != '.' else None
                    }
            except Exception as e:
                log.warning(f"Error fetching job market data: {e}")

            # Wage metrics
            wages = {}
            try:
                # Average Hourly Earnings - CES0500000003
                earnings_obs = FredSeriesFetcher.fetch_series(
                    series_id='CES0500000003',
                    api_key=api_key,
                    limit=13,
                    sort_order='desc'
                )

                # Unit Labor Cost (nonfarm business) - ULCNFB
                ulc_obs = FredSeriesFetcher.fetch_series(
                    series_id='ULCNFB',
                    api_key=api_key,
                    limit=1,
                    sort_order='desc'
                )

                # Nonfarm Business Productivity - OPHNFB
                prod_obs = FredSeriesFetcher.fetch_series(
                    series_id='OPHNFB',
                    api_key=api_key,
                    limit=5,
                    sort_order='desc'
                )

                if earnings_obs and len(earnings_obs) >= 13:
                    current_earnings = float(earnings_obs[0]['value'])
                    year_ago_earnings = float(earnings_obs[12]['value'])
                    earnings_yoy = ((current_earnings - year_ago_earnings) / year_ago_earnings * 100)

                    wages = {
                        'hourly_earnings': round(current_earnings, 2),
                        'hourly_earnings_yoy': round(earnings_yoy, 2),
                        'unit_labor_cost': round(float(ulc_obs[0]['value']), 1) if ulc_obs and ulc_obs[0]['value'] != '.' else None,
                        'productivity_growth': round(float(prod_obs[0]['value']), 1) if prod_obs and prod_obs[0]['value'] != '.' else None
                    }
            except Exception as e:
                log.warning(f"Error fetching wage data: {e}")

            # Calculate Labor Market Heat Index (0-100)
            heat_index = 50.0  # Default neutral
            try:
                # Factors: low unemployment, high job openings, high quits rate, low claims
                heat_factors = []

                if 'u3' in unemployment:
                    # Lower unemployment = hotter (invert)
                    u3_score = max(0, min(100, 100 - (unemployment['u3'] * 20)))
                    heat_factors.append(u3_score)

                if job_market.get('quits_rate'):
                    # Higher quits = hotter labor market
                    quits_score = min(100, job_market['quits_rate'] * 40)
                    heat_factors.append(quits_score)

                if job_market.get('initial_claims'):
                    # Lower claims = hotter (normalize around 250k)
                    claims_score = max(0, min(100, 100 - ((job_market['initial_claims'] - 200000) / 2000)))
                    heat_factors.append(claims_score)

                if heat_factors:
                    heat_index = round(sum(heat_factors) / len(heat_factors), 1)
            except Exception as e:
                log.warning(f"Error calculating heat index: {e}")

            # Phillips Curve current point
            phillips_curve = {}
            try:
                cpi_data = await FREDCPIFetcher.fetch_data({})
                cpi_sorted = sorted(cpi_data, key=lambda x: x.date, reverse=True)

                if unemployment.get('u3') and len(cpi_sorted) >= 13:
                    current_cpi = cpi_sorted[0].value
                    year_ago_cpi = cpi_sorted[12].value
                    cpi_yoy = ((current_cpi - year_ago_cpi) / year_ago_cpi * 100)

                    phillips_curve = {
                        'current_point': {
                            'unemployment': round(unemployment['u3'], 1),
                            'inflation': round(cpi_yoy, 1)
                        },
                        'historical_average': {
                            'unemployment': 5.5,  # Historical average
                            'inflation': 2.5
                        }
                    }
            except Exception as e:
                log.warning(f"Error calculating Phillips Curve: {e}")

            return {
                'unemployment': unemployment,
                'job_market': job_market,
                'wages': wages,
                'heat_index': heat_index,
                'phillips_curve': phillips_curve,
                'timestamp': datetime.now().isoformat()
            }

        except Exception as e:
            log.error(f"Error fetching labor dashboard: {e}")
            raise

    async def get_labor_history(self, period: str = '5y') -> Dict[str, Any]:
        """
        Get historical labor market data for Phillips Curve visualization

        Args:
            period: Time period (1y, 3y, 5y, 10y, max)

        Returns:
            Historical unemployment and inflation data points
        """
        try:
            start_date, end_date = parse_period_to_dates(period)

            # Fetch historical unemployment and CPI data
            unemployment_data = await FREDUnemploymentFetcher.fetch_data({})
            cpi_data = await FREDCPIFetcher.fetch_data({})

            # Filter by date range
            unemployment_filtered = [u for u in unemployment_data if u.date and start_date <= u.date <= end_date]
            cpi_filtered = [c for c in cpi_data if c.date and start_date <= c.date <= end_date]

            # Sort ascending
            unemployment_filtered.sort(key=lambda x: x.date)
            cpi_all_sorted = sorted(cpi_data, key=lambda x: x.date, reverse=True)

            # Create Phillips Curve data points
            phillips_points = []

            for u_point in unemployment_filtered:
                # Find closest CPI point
                closest_cpi = min(cpi_filtered, key=lambda c: abs((c.date - u_point.date).days))

                # Calculate CPI YoY
                try:
                    cpi_idx = next(i for i, c in enumerate(cpi_all_sorted) if c.date == closest_cpi.date)
                    if cpi_idx + 12 < len(cpi_all_sorted):
                        year_ago_cpi = cpi_all_sorted[cpi_idx + 12].value
                        cpi_yoy = ((closest_cpi.value - year_ago_cpi) / year_ago_cpi * 100)

                        phillips_points.append({
                            'date': u_point.date.isoformat(),
                            'unemployment': round(u_point.value, 1),
                            'inflation': round(cpi_yoy, 1)
                        })
                except (StopIteration, ValueError):
                    continue

            return {
                'phillips_curve_data': phillips_points,
                'period': period
            }

        except Exception as e:
            log.error(f"Error fetching labor history: {e}")
            raise

    async def get_financial_conditions(self) -> Dict[str, Any]:
        """
        Get comprehensive financial conditions analysis

        Returns FCI, credit spreads, liquidity indicators, and health metrics
        """
        try:
            api_key = get_api_key(
                credentials=None,
                api_name="FRED",
                env_var="FRED_API_KEY"
            )

            # Financial Conditions Index (Chicago Fed NFCI)
            fci_composite = {}
            try:
                # Chicago Fed National Financial Conditions Index - NFCI
                nfci_obs = FredSeriesFetcher.fetch_series(
                    series_id='NFCI',
                    api_key=api_key,
                    limit=1,
                    sort_order='desc'
                )

                if nfci_obs and nfci_obs[0]['value'] != '.':
                    nfci_value = float(nfci_obs[0]['value'])

                    # Normalize to -100 to +100 scale (NFCI typically ranges from -1 to +2)
                    normalized_value = (nfci_value / 2.0) * 100
                    normalized_value = max(-100, min(100, normalized_value))

                    # Determine status
                    if nfci_value > 0.5:
                        status = 'very_tight'
                    elif nfci_value > 0:
                        status = 'tight'
                    elif nfci_value > -0.5:
                        status = 'neutral'
                    else:
                        status = 'loose'

                    fci_composite = {
                        'value': round(normalized_value, 2),
                        'raw_value': round(nfci_value, 2),
                        'status': status,
                        'sources': {
                            'chicago_fed': round(nfci_value, 2)
                        }
                    }
            except Exception as e:
                log.warning(f"Could not fetch FCI: {e}")

            # Credit Spreads
            credit_spreads = {}
            try:
                # BAA Corporate Bond Yield - BAMLC0A4CBBB
                baa_obs = FredSeriesFetcher.fetch_series(
                    series_id='BAMLC0A4CBBB',
                    api_key=api_key,
                    limit=1,
                    sort_order='desc'
                )

                # AAA Corporate Bond Yield - BAMLC0A1CAAA
                aaa_obs = FredSeriesFetcher.fetch_series(
                    series_id='BAMLC0A1CAAA',
                    api_key=api_key,
                    limit=1,
                    sort_order='desc'
                )

                # High Yield Option-Adjusted Spread - BAMLH0A0HYM2
                hy_obs = FredSeriesFetcher.fetch_series(
                    series_id='BAMLH0A0HYM2',
                    api_key=api_key,
                    limit=1,
                    sort_order='desc'
                )

                # BBB Option-Adjusted Spread - BAMLC0A4CBBBEY
                bbb_spread_obs = FredSeriesFetcher.fetch_series(
                    series_id='BAMLC0A4CBBBEY',
                    api_key=api_key,
                    limit=1,
                    sort_order='desc'
                )

                # Calculate Investment Grade spread (approximate)
                ig_spread = None
                if aaa_obs and aaa_obs[0]['value'] != '.':
                    aaa_yield = float(aaa_obs[0]['value'])
                    # Assume 10Y Treasury around 4% (would fetch DGS10 for accuracy)
                    ig_spread = aaa_yield * 100  # Convert to basis points approximation

                # High Yield spread
                hy_spread = None
                hy_percentile = None
                if hy_obs and hy_obs[0]['value'] != '.':
                    hy_spread = float(hy_obs[0]['value'])
                    # Estimate percentile (typical range: 200-800bp, crisis: >1000bp)
                    hy_percentile = min(100, max(0, ((hy_spread - 200) / 800) * 100))

                # BBB-Treasury spread
                bbb_spread = None
                if bbb_spread_obs and bbb_spread_obs[0]['value'] != '.':
                    bbb_spread = float(bbb_spread_obs[0]['value'])

                # Distressed ratio (simplified estimate)
                distressed_ratio = 0
                if hy_spread and hy_spread > 1000:
                    distressed_ratio = min(50, (hy_spread - 1000) / 20)  # Rough estimate

                credit_spreads = {
                    'investment_grade': {
                        'spread': round(ig_spread, 0) if ig_spread else None,
                        'percentile': 50.0  # Placeholder
                    },
                    'high_yield': {
                        'spread': round(hy_spread, 0) if hy_spread else None,
                        'percentile': round(hy_percentile, 1) if hy_percentile else None
                    },
                    'bbb_treasury': {
                        'spread': round(bbb_spread, 0) if bbb_spread else None,
                        'description': 'Lower end of Investment Grade'
                    },
                    'distressed_ratio': round(distressed_ratio, 1)
                }
            except Exception as e:
                log.warning(f"Could not fetch credit spreads: {e}")

            # Liquidity Indicators
            liquidity = {}
            try:
                # TED Spread - TEDRATE
                ted_obs = FredSeriesFetcher.fetch_series(
                    series_id='TEDRATE',
                    api_key=api_key,
                    limit=1,
                    sort_order='desc'
                )

                # Commercial Paper Outstanding - COMPOUT (discontinued, use COMPNSA)
                cp_obs = FredSeriesFetcher.fetch_series(
                    series_id='COMPNSA',
                    api_key=api_key,
                    limit=1,
                    sort_order='desc'
                )

                liquidity = {
                    'ted_spread': round(float(ted_obs[0]['value']), 2) if ted_obs and ted_obs[0]['value'] != '.' else None,
                    'libor_ois_spread': None,  # LIBOR discontinued, would need SOFR alternative
                    'commercial_paper_outstanding': round(float(cp_obs[0]['value']), 1) if cp_obs and cp_obs[0]['value'] != '.' else None
                }
            except Exception as e:
                log.warning(f"Could not fetch liquidity indicators: {e}")

            # Consumer Health
            consumer_health = {}
            try:
                # Consumer Credit Outstanding - TOTALSL
                consumer_credit_obs = FredSeriesFetcher.fetch_series(
                    series_id='TOTALSL',
                    api_key=api_key,
                    limit=13,
                    sort_order='desc'
                )

                # Credit Card Delinquency Rate - DRCCLACBS
                cc_delinq_obs = FredSeriesFetcher.fetch_series(
                    series_id='DRCCLACBS',
                    api_key=api_key,
                    limit=1,
                    sort_order='desc'
                )

                # Auto Loan Delinquency Rate - DREALACBS
                auto_delinq_obs = FredSeriesFetcher.fetch_series(
                    series_id='DREALACBS',
                    api_key=api_key,
                    limit=1,
                    sort_order='desc'
                )

                # Mortgage Delinquency Rate - DRSFRMACBS
                mortgage_delinq_obs = FredSeriesFetcher.fetch_series(
                    series_id='DRSFRMACBS',
                    api_key=api_key,
                    limit=1,
                    sort_order='desc'
                )

                # Calculate consumer credit growth
                credit_growth = None
                if consumer_credit_obs and len(consumer_credit_obs) >= 13:
                    current = float(consumer_credit_obs[0]['value'])
                    year_ago = float(consumer_credit_obs[12]['value'])
                    credit_growth = ((current - year_ago) / year_ago * 100)

                consumer_health = {
                    'consumer_credit_growth': round(credit_growth, 2) if credit_growth else None,
                    'credit_card_delinquency': round(float(cc_delinq_obs[0]['value']), 2) if cc_delinq_obs and cc_delinq_obs[0]['value'] != '.' else None,
                    'auto_loan_delinquency': round(float(auto_delinq_obs[0]['value']), 2) if auto_delinq_obs and auto_delinq_obs[0]['value'] != '.' else None,
                    'mortgage_delinquency': round(float(mortgage_delinq_obs[0]['value']), 2) if mortgage_delinq_obs and mortgage_delinq_obs[0]['value'] != '.' else None
                }
            except Exception as e:
                log.warning(f"Could not fetch consumer health: {e}")

            # Corporate Health
            corporate_health = {}
            try:
                # Nonfinancial Corporate Business Debt - BCNSDODNS
                corp_debt_obs = FredSeriesFetcher.fetch_series(
                    series_id='BCNSDODNS',
                    api_key=api_key,
                    limit=13,
                    sort_order='desc'
                )

                # GDP for debt-to-GDP ratio
                gdp_data = await FREDGDPFetcher.fetch_data({})
                gdp_sorted = sorted(gdp_data, key=lambda x: x.date, reverse=True)

                # Calculate metrics
                debt_to_gdp = None
                debt_growth = None

                if corp_debt_obs and len(corp_debt_obs) >= 1 and gdp_sorted:
                    current_debt = float(corp_debt_obs[0]['value'])
                    current_gdp = gdp_sorted[0].value

                    # Debt is in millions, GDP in billions - convert
                    debt_to_gdp = (current_debt / 1000) / current_gdp * 100

                    if len(corp_debt_obs) >= 5:  # Quarterly data
                        year_ago_debt = float(corp_debt_obs[4]['value'])
                        debt_growth = ((current_debt - year_ago_debt) / year_ago_debt * 100)

                corporate_health = {
                    'corporate_debt_to_gdp': round(debt_to_gdp, 1) if debt_to_gdp else None,
                    'interest_coverage_ratio': None,  # Would need earnings data
                    'debt_growth_yoy': round(debt_growth, 2) if debt_growth else None
                }
            except Exception as e:
                log.warning(f"Could not fetch corporate health: {e}")

            return {
                'fci_composite': fci_composite,
                'credit_spreads': credit_spreads,
                'liquidity': liquidity,
                'consumer_health': consumer_health,
                'corporate_health': corporate_health,
                'timestamp': datetime.now().isoformat()
            }

        except Exception as e:
            log.error(f"Error fetching financial conditions: {e}")
            raise

    async def get_financial_conditions_history(self, period: str = '5y') -> Dict[str, Any]:
        """
        Get historical financial conditions data

        Args:
            period: Time period (1y, 3y, 5y, 10y, max)

        Returns:
            Historical FCI and credit spread data
        """
        try:
            start_date, end_date = parse_period_to_dates(period)

            api_key = get_api_key(
                credentials=None,
                api_name="FRED",
                env_var="FRED_API_KEY"
            )

            # Fetch historical FCI
            nfci_history = []
            try:
                nfci_obs = FredSeriesFetcher.fetch_series(
                    series_id='NFCI',
                    api_key=api_key,
                    start_date=start_date,
                    end_date=end_date,
                    sort_order='asc'
                )

                nfci_history = [
                    {
                        'date': obs['date'],
                        'value': float(obs['value'])
                    }
                    for obs in nfci_obs
                    if obs['value'] != '.'
                ]
            except Exception as e:
                log.warning(f"Could not fetch NFCI history: {e}")

            # Fetch historical credit spreads
            credit_spread_history = []
            try:
                # High Yield spread history
                hy_obs = FredSeriesFetcher.fetch_series(
                    series_id='BAMLH0A0HYM2',
                    api_key=api_key,
                    start_date=start_date,
                    end_date=end_date,
                    sort_order='asc'
                )

                credit_spread_history = [
                    {
                        'date': obs['date'],
                        'high_yield_spread': float(obs['value'])
                    }
                    for obs in hy_obs
                    if obs['value'] != '.'
                ]
            except Exception as e:
                log.warning(f"Could not fetch credit spread history: {e}")

            return {
                'fci_history': nfci_history,
                'credit_spread_history': credit_spread_history,
                'period': period
            }

        except Exception as e:
            log.error(f"Error fetching financial conditions history: {e}")
            raise

    async def get_sentiment_composite(self) -> Dict[str, Any]:
        """
        Get comprehensive market sentiment analysis

        Returns Fear & Greed Index, volatility metrics, positioning, and cross-asset signals
        """
        try:
            api_key = get_api_key(
                credentials=None,
                api_name="FRED",
                env_var="FRED_API_KEY"
            )

            # Fear & Greed Index Components
            components = {}

            # 1. VIX (CBOE Volatility Index) - VIXCLS
            vix_value = None
            vix_score = 50  # Neutral default
            try:
                vix_obs = FredSeriesFetcher.fetch_series(
                    series_id='VIXCLS',
                    api_key=api_key,
                    limit=1,
                    sort_order='desc'
                )
                if vix_obs and vix_obs[0]['value'] != '.':
                    vix_value = float(vix_obs[0]['value'])
                    # Lower VIX = more greed, Higher VIX = more fear
                    # Normalize: VIX 10-15 = greedy, 15-20 = neutral, 20-30 = fear, >30 = extreme fear
                    if vix_value < 15:
                        vix_score = 100 - ((vix_value - 10) / 5) * 30  # 70-100 range
                    elif vix_value < 20:
                        vix_score = 70 - ((vix_value - 15) / 5) * 40  # 30-70 range
                    elif vix_value < 30:
                        vix_score = 30 - ((vix_value - 20) / 10) * 20  # 10-30 range
                    else:
                        vix_score = max(0, 10 - ((vix_value - 30) / 10) * 10)  # 0-10 range

                    components['vix'] = {
                        'value': round(vix_value, 2),
                        'score': round(vix_score, 1)
                    }
            except Exception as e:
                log.warning(f"Could not fetch VIX: {e}")

            # 2. SKEW Index (tail risk) - SKEW data not available in FRED, use placeholder
            # In production, would fetch from CBOE
            components['skew'] = {
                'value': None,
                'score': 50  # Neutral placeholder
            }

            # 3. Put/Call Ratio - Not directly in FRED, use placeholder
            components['put_call_ratio'] = {
                'value': None,
                'score': 50  # Neutral placeholder
            }

            # 4. High Yield Spread (already have this)
            hy_score = 50
            try:
                hy_obs = FredSeriesFetcher.fetch_series(
                    series_id='BAMLH0A0HYM2',
                    api_key=api_key,
                    limit=1,
                    sort_order='desc'
                )
                if hy_obs and hy_obs[0]['value'] != '.':
                    hy_spread = float(hy_obs[0]['value'])
                    # Lower spread = greed, Higher spread = fear
                    # Normalize: <300bp = greedy, 300-500 = neutral, >500 = fear
                    if hy_spread < 300:
                        hy_score = 100 - ((300 - hy_spread) / 100) * 20
                    elif hy_spread < 500:
                        hy_score = 80 - ((hy_spread - 300) / 200) * 50
                    else:
                        hy_score = max(0, 30 - ((hy_spread - 500) / 500) * 30)

                    components['high_yield_spread'] = {
                        'value': round(hy_spread, 0),
                        'score': round(hy_score, 1)
                    }
            except Exception as e:
                log.warning(f"Could not fetch HY spread for sentiment: {e}")

            # 5. Safe Haven Demand (Gold, Treasury yields)
            safe_haven_score = 50
            try:
                # Gold price increase = fear, decrease = greed
                # 10Y Treasury yield decrease = fear (flight to safety)
                treasury_obs = FredSeriesFetcher.fetch_series(
                    series_id='DGS10',
                    api_key=api_key,
                    limit=20,
                    sort_order='desc'
                )
                if treasury_obs and len(treasury_obs) >= 20:
                    current_yield = float(treasury_obs[0]['value'])
                    avg_yield = sum(float(obs['value']) for obs in treasury_obs[:20] if obs['value'] != '.') / 20
                    # If current < average, flight to safety (fear)
                    yield_diff = current_yield - avg_yield
                    safe_haven_score = 50 - (yield_diff * 10)  # Rough estimate
                    safe_haven_score = max(0, min(100, safe_haven_score))

                components['safe_haven_demand'] = {
                    'score': round(safe_haven_score, 1)
                }
            except Exception as e:
                log.warning(f"Could not calculate safe haven demand: {e}")

            # Calculate composite Fear & Greed Index
            valid_scores = [v['score'] for v in components.values() if 'score' in v and v['score'] is not None]
            if valid_scores:
                fear_greed_value = sum(valid_scores) / len(valid_scores)
            else:
                fear_greed_value = 50  # Neutral default

            # Classify status
            if fear_greed_value < 20:
                status = 'extreme_fear'
            elif fear_greed_value < 40:
                status = 'fear'
            elif fear_greed_value < 60:
                status = 'neutral'
            elif fear_greed_value < 80:
                status = 'greed'
            else:
                status = 'extreme_greed'

            fear_greed_index = {
                'value': round(fear_greed_value, 1),
                'status': status,
                'components': components
            }

            # Volatility metrics
            volatility = {}
            if vix_value is not None:
                # Estimate percentile (VIX historical range: 10-80, typical 15-25)
                vix_percentile = min(100, max(0, ((vix_value - 10) / 70) * 100))

                if vix_value < 15:
                    vix_status = 'low'
                elif vix_value < 20:
                    vix_status = 'normal'
                elif vix_value < 30:
                    vix_status = 'elevated'
                else:
                    vix_status = 'high'

                volatility = {
                    'vix': round(vix_value, 2),
                    'vix_percentile': round(vix_percentile, 1),
                    'vix_status': vix_status,
                    'skew': None  # CBOE SKEW not in FRED
                }

            # Positioning (simplified - real data would come from AAII, fund flows)
            positioning = {
                'aaii_sentiment': {
                    'bullish': None,  # AAII data not in FRED
                    'bearish': None,
                    'neutral': None,
                    'bull_bear_spread': None
                },
                'fund_flows': {
                    'equity_flows': None,
                    'bond_flows': None,
                    'money_market_flows': None
                }
            }

            # Cross-asset signals
            cross_asset_signals = {
                'stock_bond_correlation': None,  # Would need daily price data
                'risk_on_off': 'mixed',  # Default
                'safe_haven_strength': safe_haven_score
            }

            # Determine risk-on/off based on VIX and spreads
            if vix_value and hy_obs:
                if vix_value < 18 and hy_spread < 400:
                    cross_asset_signals['risk_on_off'] = 'risk_on'
                elif vix_value > 25 or hy_spread > 600:
                    cross_asset_signals['risk_on_off'] = 'risk_off'

            return {
                'fear_greed_index': fear_greed_index,
                'volatility': volatility,
                'positioning': positioning,
                'cross_asset_signals': cross_asset_signals,
                'timestamp': datetime.now().isoformat()
            }

        except Exception as e:
            log.error(f"Error fetching sentiment composite: {e}")
            raise

    async def get_sentiment_history(self, period: str = '5y') -> Dict[str, Any]:
        """
        Get historical sentiment data

        Args:
            period: Time period (1y, 3y, 5y, 10y, max)

        Returns:
            Historical VIX and calculated sentiment scores
        """
        try:
            start_date, end_date = parse_period_to_dates(period)

            api_key = get_api_key(
                credentials=None,
                api_name="FRED",
                env_var="FRED_API_KEY"
            )

            # Fetch historical VIX
            vix_history = []
            try:
                vix_obs = FredSeriesFetcher.fetch_series(
                    series_id='VIXCLS',
                    api_key=api_key,
                    start_date=start_date,
                    end_date=end_date,
                    sort_order='asc'
                )

                vix_history = [
                    {
                        'date': obs['date'],
                        'vix': float(obs['value'])
                    }
                    for obs in vix_obs
                    if obs['value'] != '.'
                ]
            except Exception as e:
                log.warning(f"Could not fetch VIX history: {e}")

            # Fetch historical High Yield spreads for fear/greed calculation
            hy_history = []
            try:
                hy_obs = FredSeriesFetcher.fetch_series(
                    series_id='BAMLH0A0HYM2',
                    api_key=api_key,
                    start_date=start_date,
                    end_date=end_date,
                    sort_order='asc'
                )

                hy_history = [
                    {
                        'date': obs['date'],
                        'hy_spread': float(obs['value'])
                    }
                    for obs in hy_obs
                    if obs['value'] != '.'
                ]
            except Exception as e:
                log.warning(f"Could not fetch HY spread history: {e}")

            # Calculate historical Fear/Greed scores
            # Merge VIX and HY data by date
            sentiment_history = []
            vix_dict = {v['date']: v['vix'] for v in vix_history}
            hy_dict = {h['date']: h['hy_spread'] for h in hy_history}

            all_dates = sorted(set(list(vix_dict.keys()) + list(hy_dict.keys())))

            for date in all_dates:
                vix_val = vix_dict.get(date)
                hy_val = hy_dict.get(date)

                scores = []

                # Calculate VIX score
                if vix_val is not None:
                    if vix_val < 15:
                        vix_score = 100 - ((vix_val - 10) / 5) * 30
                    elif vix_val < 20:
                        vix_score = 70 - ((vix_val - 15) / 5) * 40
                    elif vix_val < 30:
                        vix_score = 30 - ((vix_val - 20) / 10) * 20
                    else:
                        vix_score = max(0, 10 - ((vix_val - 30) / 10) * 10)
                    scores.append(vix_score)

                # Calculate HY score
                if hy_val is not None:
                    if hy_val < 300:
                        hy_score = 100 - ((300 - hy_val) / 100) * 20
                    elif hy_val < 500:
                        hy_score = 80 - ((hy_val - 300) / 200) * 50
                    else:
                        hy_score = max(0, 30 - ((hy_val - 500) / 500) * 30)
                    scores.append(hy_score)

                if scores:
                    fear_greed_score = sum(scores) / len(scores)
                    sentiment_history.append({
                        'date': date,
                        'fear_greed_score': round(fear_greed_score, 1),
                        'vix': round(vix_val, 2) if vix_val else None,
                        'hy_spread': round(hy_val, 0) if hy_val else None
                    })

            return {
                'sentiment_history': sentiment_history,
                'vix_history': vix_history,
                'period': period
            }

        except Exception as e:
            log.error(f"Error fetching sentiment history: {e}")
            raise


# Global instance
macro_service = MacroService()

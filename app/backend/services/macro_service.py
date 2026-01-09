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


# Global instance
macro_service = MacroService()

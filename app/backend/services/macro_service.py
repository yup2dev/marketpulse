"""
Macro Economic Service
Provides comprehensive macroeconomic data and analysis
"""
import asyncio
import sys
import logging
from pathlib import Path
from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta

sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from app.backend.core.cache import cached
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
from data_fetcher.fetchers.bond.bond_prices import FMPBondPricesFetcher
from data_fetcher.query_executor import QueryExecutor
from data_fetcher.utils.helpers import parse_period_to_dates
from data_fetcher.utils.api_keys import get_api_key
from data_fetcher.utils.api_keys import get_api_key

# Fetcher class → (provider, model) mapping for QueryExecutor
_FETCHER_MAP = {
    FREDGDPFetcher:                  ('fred', 'gdp'),
    FREDUnemploymentFetcher:         ('fred', 'unemployment'),
    FREDCPIFetcher:                  ('fred', 'cpi'),
    FREDInterestRateFetcher:         ('fred', 'interest_rate'),
    FREDRetailSalesFetcher:          ('fred', 'retail_sales'),
    FREDConsumerSentimentFetcher:    ('fred', 'consumer_sentiment'),
    FREDNonfarmPayrollFetcher:       ('fred', 'nonfarm_payroll'),
    FREDEmploymentFetcher:           ('fred', 'employment'),
    FREDHousingStartsFetcher:        ('fred', 'housing_starts'),
    FREDIndustrialProductionFetcher: ('fred', 'industrial_production'),
    FMPBondPricesFetcher:            ('fmp', 'bond_prices'),
}
from app.backend.constants.fred_series import (
    STICKY_CORE_CPI,
    FLEXIBLE_CORE_CPI,
    BREAKEVEN_5Y,
    BREAKEVEN_10Y,
    CORE_CPI,
    CPI_SECTOR_SERIES
)

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

    async def _qe(self, fetcher_cls, params=None) -> List[Dict]:
        """_fetch 대체: _FETCHER_MAP → QueryExecutor.fetch → List[Dict]"""
        from data_fetcher.fetchers.base import AnnotatedResult
        provider, model = _FETCHER_MAP[fetcher_cls]
        raw = await QueryExecutor.fetch(provider, model, params or {})
        if isinstance(raw, AnnotatedResult):
            raw = raw.result
        return [m.model_dump(mode='json') if hasattr(m, 'model_dump') else m for m in (raw or [])]

    async def _qe_series(self, series_id: str, *, limit: int = 10000, sort_order: str = 'asc',
                         start_date=None, end_date=None) -> List[Dict]:
        """_fetch_series 대체: FREDGenericSeriesFetcher via QueryExecutor"""
        params: Dict = {'series_id': series_id, 'limit': limit, 'sort_order': sort_order}
        if start_date: params['start_date'] = start_date
        if end_date:   params['end_date']   = end_date
        raw = await QueryExecutor.fetch('fred', 'series', params)
        return [m.model_dump(mode='json') if hasattr(m, 'model_dump') else m for m in (raw or [])]

    
    @cached(ttl=3600)
    async def get_economic_indicators_overview(self) -> Dict[str, Any]:
        """Get overview of all major economic indicators (latest values) - Parallel fetching for speed"""
        import asyncio

        async def fetch_one(key, fetcher_cls, unit, params, use_last):
            data = await self._qe(fetcher_cls, params)
            if not data:
                return None
            latest = data[-1] if use_last else data[0]
            prev   = data[-2] if use_last else (data[1] if len(data) > 1 else None)
            change = self._calculate_change([latest, prev]) if prev else None
            return (key, {**latest, 'unit': unit, 'change': change})

        results = await asyncio.gather(*[fetch_one(*spec) for spec in self._OVERVIEW_SPECS])
        return [{'indicator': k, **v} for k, v in (r for r in results if r)]

    @cached(ttl=3600)
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

        params = {**indicator_info['params'], 'start_date': start_date, 'end_date': end_date}
        raw = await self._qe(indicator_info['fetcher'], params)

        chart_data = [
            {'date': d['date'], 'value': round(d['value'], 2) if d.get('value') is not None else None}
            for d in raw
            if d.get('date') and d.get('value') is not None
        ]

        return chart_data

    @cached(ttl=3600)
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

            # Fetch historical data in ascending order for charts
            observations = await self._qe_series(
                series_info['id'],
                start_date=start_date,
                end_date=end_date,
                sort_order='asc',
            )

            data = [
                {
                    'date': obs['date'],
                    'value': obs['value']
                }
                for obs in observations
                if obs['value'] != '.'
            ]

            return data

        except Exception as e:
            log.error(f"Error fetching FRED series {series_key}: {e}")
            raise

    @cached(ttl=3600)
    async def get_all_fred_series_overview(self) -> List[Dict[str, Any]]:
        """Get latest values for all additional FRED series"""
        results = []

        for key, info in self.FRED_SERIES.items():
            try:

                # Fetch with sort_order='desc' to get most recent data first
                observations = await self._qe_series(
                    info['id'],
                    limit=2,
                    sort_order='desc',
                )

                if observations:
                    # With sort_order='desc', index 0 is most recent
                    latest = observations[0]
                    prev = observations[1] if len(observations) > 1 else None

                    value = latest['value']
                    prev_value = prev['value'] if prev else None

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

    @cached(ttl=300)
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
                models = await QueryExecutor.fetch("alphavantage", "forex", {
                    'from_currency': pair['from'],
                    'to_currency': pair['to'],
                    'interval': 'daily'
                })

                if models:
                    items = [m.model_dump(mode='json') if hasattr(m, 'model_dump') else m for m in models]
                    latest = items[0]
                    prev = items[1] if len(items) > 1 else None
                    change = ((latest['close'] - prev['close']) / prev['close'] * 100) if prev and prev.get('close') else None
                    rates.append({
                        'pair': f"{pair['from']}/{pair['to']}",
                        'name': pair['name'],
                        'rate': latest['close'],
                        'date': latest['date'],
                        'change': change,
                        'high': latest['high'],
                        'low': latest['low']
                    })

            except Exception as e:
                log.warning(f"Error fetching {pair['from']}/{pair['to']}: {e}")
                continue

        return rates

    @cached(ttl=900)
    async def get_forex_history(
        self,
        from_currency: str,
        to_currency: str,
        period: str = "1y"
    ) -> Dict[str, Any]:
        """Get historical forex data"""
        try:
            data = await QueryExecutor.fetch("alphavantage", "forex", {
                'from_currency': from_currency,
                'to_currency': to_currency,
                'interval': 'daily'
            })

            start_date, _ = parse_period_to_dates(period)

            rows = [m.model_dump(mode='json') if hasattr(m, 'model_dump') else m for m in data]
            filtered_data = [
                {'date': d['date'], 'open': d['open'], 'high': d['high'], 'low': d['low'], 'close': d['close']}
                for d in rows
                if d.get('date') and d['date'] >= str(start_date)
            ]

            return filtered_data

        except Exception as e:
            log.error(f"Error fetching forex history: {e}")
            raise

    @cached(ttl=300)
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

    @cached(ttl=900)
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

        return []

    def _calculate_ratio_series(
        self,
        numerator_obs: List,
        denominator_obs: List,
        numerator_scale: float = 1.0
    ) -> List[Dict[str, Any]]:
        """Calculate ratio time series from two observation series"""
        # Create date map for denominator
        denom_map = {
            obs['date']: obs['value']
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
        """Calculate percentage change between two data points (supports dicts and Pydantic models)"""
        if len(data) < 2 or data[1] is None:
            return None

        def _val(x):
            return x.get('value') if isinstance(x, dict) else getattr(x, 'value', None)

        current, previous = _val(data[0]), _val(data[1])
        if current is None or previous is None or previous == 0:
            return None

        return ((current - previous) / previous) * 100

    @cached(ttl=1800)
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
            gdp_data = await self._qe(FREDGDPFetcher, {})
            components['gdp_growth'] = gdp_data[0]['value'] if gdp_data else 0

            # 2. Industrial Production YoY
            try:
                indpro = await self._qe(FREDIndustrialProductionFetcher, {})
                indpro_sorted = sorted(indpro, key=lambda x: x['date'], reverse=True)
                if len(indpro_sorted) >= 13:
                    current_ip, year_ago_ip = indpro_sorted[0]['value'], indpro_sorted[12]['value']
                    components['industrial_production_yoy'] = ((current_ip - year_ago_ip) / year_ago_ip * 100) if year_ago_ip else 0
                else:
                    components['industrial_production_yoy'] = 0
            except Exception as e:
                log.warning(f"Could not fetch industrial production: {e}")
                components['industrial_production_yoy'] = 0

            # 3. Employment YoY (using Nonfarm Payroll)
            try:
                emp = await self._qe(FREDNonfarmPayrollFetcher, {})
                emp_sorted = sorted(emp, key=lambda x: x['date'], reverse=True)
                if len(emp_sorted) >= 13:
                    current_emp, year_ago_emp = emp_sorted[0]['value'], emp_sorted[12]['value']
                    components['employment_yoy'] = ((current_emp - year_ago_emp) / year_ago_emp * 100) if year_ago_emp else 0
                else:
                    components['employment_yoy'] = 0
            except Exception as e:
                log.warning(f"Could not fetch employment: {e}")
                components['employment_yoy'] = 0

            # Fetch Inflation components
            # 4. CPI YoY
            cpi_data = await self._qe(FREDCPIFetcher, {})
            cpi_sorted = sorted(cpi_data, key=lambda x: x['date'], reverse=True)
            if len(cpi_sorted) >= 13:
                current_cpi, year_ago_cpi = cpi_sorted[0]['value'], cpi_sorted[12]['value']
                components['cpi_yoy'] = ((current_cpi - year_ago_cpi) / year_ago_cpi * 100) if year_ago_cpi else 0
            else:
                components['cpi_yoy'] = 0

            # Calculate composite scores
            # Growth Score: weighted average, normalized to -100 to +100
            growth_score = (
                (components['gdp_growth'] / 5.0) * 100 * 0.5 +
                (components['industrial_production_yoy'] / 10.0) * 100 * 0.25 +
                (components['employment_yoy'] / 3.0) * 100 * 0.25
            )
            growth_score = max(-100, min(100, growth_score))

            # Inflation Score: normalized (CPI YoY: -2% to +10%, centered at 2% target)
            inflation_score = (components['cpi_yoy'] - 2.0) / 6.0 * 100
            inflation_score = max(-100, min(100, inflation_score))

            # Calculate momentum
            growth_momentum = 0.0
            inflation_momentum = 0.0

            if len(gdp_data) >= 2:
                growth_momentum = gdp_data[0]['value'] - gdp_data[1]['value']

            if len(cpi_sorted) >= 4:
                current_cpi_yoy = components['cpi_yoy']
                if len(cpi_sorted) >= 16:
                    three_mo_ago = cpi_sorted[3]['value']
                    fifteen_mo_ago = cpi_sorted[15]['value']
                    three_mo_cpi_yoy = ((three_mo_ago - fifteen_mo_ago) / fifteen_mo_ago * 100) if fifteen_mo_ago else current_cpi_yoy
                    inflation_momentum = current_cpi_yoy - three_mo_cpi_yoy
                else:
                    inflation_momentum = 0

            # Determine regime
            regime = self._classify_regime(growth_score, inflation_score, components['cpi_yoy'])

            return [{
                'regime': regime,
                'growth_score': round(growth_score, 2),
                'inflation_score': round(inflation_score, 2),
                'growth_momentum': round(growth_momentum, 2),
                'inflation_momentum': round(inflation_momentum, 2),
                'timestamp': datetime.now().isoformat(),
                **{f'cmp_{k}': round(v, 2) for k, v in components.items()}
            }]

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

    @cached(ttl=3600)
    async def get_regime_history(self, period: str = '5y') -> List:
        """경제 레짐 시계열 — FREDRegimeHistoryFetcher 위임."""
        start_date, end_date = parse_period_to_dates(period)
        return await QueryExecutor.fetch('fred', 'regime_history', {
            'start_date': start_date, 'end_date': end_date,
        })
    @cached(ttl=1800)
    async def get_fed_policy_stance(self) -> Dict[str, Any]:
        """
        Calculate Federal Reserve policy stance

        Returns analysis of Fed's hawkish/dovish position based on:
        - Fed Funds Rate level and trajectory
        - Rate change velocity
        - Historical context
        """
        try:
            rates = await self._qe(FREDInterestRateFetcher, {'rate_type': 'federal_funds'})

            if len(rates) < 2:
                raise ValueError("Insufficient Fed Funds Rate data")

            rates_sorted = sorted(rates, key=lambda x: x['date'], reverse=True)
            current_rate = rates_sorted[0]['rate']
            current_date = rates_sorted[0]['date']

            # Rate changes over 12 months
            twelve_months_ago = str(datetime.now().date() - timedelta(days=365))
            recent_rates = [r for r in rates_sorted if r.get('date') and r['date'] >= twelve_months_ago]
            rate_changes_12m = sum(
                1 for i in range(len(recent_rates) - 1)
                if abs(recent_rates[i]['rate'] - recent_rates[i+1]['rate']) > 0.01
            )

            peak_rate = max(r['rate'] for r in rates_sorted)
            trough_rate = min(r['rate'] for r in rates_sorted)

            rate_level_score = ((current_rate - 2.0) / 3.0) * 50

            three_months_ago = str(datetime.now().date() - timedelta(days=90))
            three_month_rates = [r for r in rates_sorted if r.get('date') and r['date'] >= three_months_ago]
            rate_momentum = (three_month_rates[0]['rate'] - three_month_rates[-1]['rate']) * 10 if len(three_month_rates) >= 2 else 0

            stance_score = max(-100, min(100, rate_level_score + rate_momentum))

            if stance_score > 30:
                stance = 'hawkish'
            elif stance_score < -30:
                stance = 'dovish'
            else:
                stance = 'neutral'

            if stance == 'hawkish' and current_rate < peak_rate - 0.5:
                probs = {'hike': 65, 'hold': 30, 'cut': 5}
            elif stance == 'dovish' and current_rate > trough_rate + 0.5:
                probs = {'hike': 5, 'hold': 30, 'cut': 65}
            else:
                probs = {'hike': 20, 'hold': 60, 'cut': 20}

            percentile = round((current_rate - trough_rate) / (peak_rate - trough_rate) * 100, 1) if peak_rate != trough_rate else 50
            return [
                {'metric': 'Stance',           'value': stance,                        'unit': ''},
                {'metric': 'Stance Score',     'value': round(stance_score, 2),         'unit': '/100'},
                {'metric': 'Fed Funds Rate',   'value': round(current_rate, 2),         'unit': '%'},
                {'metric': 'Target Lower',     'value': round(current_rate - 0.25, 2),  'unit': '%'},
                {'metric': 'Target Upper',     'value': round(current_rate, 2),         'unit': '%'},
                {'metric': 'Rate Changes 12M', 'value': rate_changes_12m,               'unit': 'times'},
                {'metric': 'Peak Rate',        'value': round(peak_rate, 2),            'unit': '%'},
                {'metric': 'Trough Rate',      'value': round(trough_rate, 2),          'unit': '%'},
                {'metric': 'Rate Percentile',  'value': percentile,                     'unit': '%'},
                {'metric': 'Hike Prob',        'value': probs['hike'],                  'unit': '%'},
                {'metric': 'Hold Prob',        'value': probs['hold'],                  'unit': '%'},
                {'metric': 'Cut Prob',         'value': probs['cut'],                   'unit': '%'},
                {'metric': 'Last Updated',     'value': current_date,                   'unit': ''},
            ]

        except Exception as e:
            log.error(f"Error calculating Fed policy stance: {e}")
            raise

    @cached(ttl=3600)
    async def get_yield_curve(self) -> List:
        """미국채 수익률 곡선 스냅샷 — FREDYieldCurveFetcher 위임."""
        return await QueryExecutor.fetch('fred', 'yield_curve', {})

    @cached(ttl=3600)
    async def get_yield_curve_history(self, period: str = '5y') -> List:
        """수익률 곡선 시계열 — FREDYieldCurveHistoryFetcher 위임."""
        start_date, end_date = parse_period_to_dates(period)
        return await QueryExecutor.fetch('fred', 'yield_curve_history', {
            'start_date': start_date, 'end_date': end_date,
        })

    @cached(ttl=1800)
    async def get_inflation_decomposition(self) -> Dict[str, Any]:
        """
        Get detailed inflation breakdown and analysis

        Returns inflation components, sticky vs flexible prices, and expectations
        """
        try:

            # Fetch CPI data
            cpi_data = await self._qe(FREDCPIFetcher, {})
            cpi_sorted = sorted(cpi_data, key=lambda x: x['date'], reverse=True)

            # Calculate headline CPI metrics
            headline_cpi = {}
            if len(cpi_sorted) >= 13:
                current_cpi = cpi_sorted[0]['value']
                month_ago_cpi = cpi_sorted[1]['value'] if len(cpi_sorted) > 1 else current_cpi
                year_ago_cpi = cpi_sorted[12]['value']

                headline_cpi = {
                    'current': round(current_cpi, 2),
                    'yoy': round(((current_cpi - year_ago_cpi) / year_ago_cpi * 100), 2),
                    'mom': round(((current_cpi - month_ago_cpi) / month_ago_cpi * 100), 2),
                    'date': cpi_sorted[0]['date']
                }

            # Fetch Core CPI (CPI Less Food and Energy)
            core_cpi = {}
            try:
                core_obs = await self._qe_series(
                    CORE_CPI,
                    limit=13,
                    sort_order='desc',
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
                # Sticky CPI
                sticky_obs = await self._qe_series(
                    STICKY_CORE_CPI,
                    limit=1,
                    sort_order='desc',
                )
                # Flexible CPI
                flexible_obs = await self._qe_series(
                    FLEXIBLE_CORE_CPI,
                    limit=1,
                    sort_order='desc',
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
                # 5-Year Breakeven
                five_yr_obs = await self._qe_series(
                    BREAKEVEN_5Y,
                    limit=1,
                    sort_order='desc',
                )
                # 10-Year Breakeven
                ten_yr_obs = await self._qe_series(
                    BREAKEVEN_10Y,
                    limit=1,
                    sort_order='desc',
                )

                if five_yr_obs and five_yr_obs[0]['value'] != '.':
                    expectations['5y_breakeven'] = round(float(five_yr_obs[0]['value']), 2)
                if ten_yr_obs and ten_yr_obs[0]['value'] != '.':
                    expectations['10y_breakeven'] = round(float(ten_yr_obs[0]['value']), 2)
            except Exception as e:
                log.warning(f"Could not fetch breakeven rates: {e}")

            return components

        except Exception as e:
            log.error(f"Error fetching inflation decomposition: {e}")
            raise

    @cached(ttl=1800)
    async def get_labor_dashboard(self) -> List:
        """노동시장 스냅샷 — FREDLaborDashboardFetcher 위임."""
        return await QueryExecutor.fetch('fred', 'labor_dashboard', {})
    @cached(ttl=3600)
    async def get_labor_history(self, period: str = '5y') -> List:
        """필립스 곡선 시계열 — FREDPhillipsCurveFetcher 위임."""
        start_date, end_date = parse_period_to_dates(period)
        return await QueryExecutor.fetch('fred', 'phillips_curve', {
            'start_date': start_date, 'end_date': end_date,
        })
    @cached(ttl=1800)
    async def get_financial_conditions(self) -> List:
        """금융 여건 스냅샷 — FREDFinancialConditionsFetcher 위임."""
        return await QueryExecutor.fetch('fred', 'financial_conditions', {})
    @cached(ttl=3600)
    async def get_financial_conditions_history(self, period: str = '5y') -> List:
        """NFCI 시계열 — FREDFinancialConditionsHistoryFetcher 위임."""
        start_date, end_date = parse_period_to_dates(period)
        return await QueryExecutor.fetch('fred', 'financial_conditions_history', {
            'start_date': start_date, 'end_date': end_date,
        })

    @cached(ttl=1800)
    async def get_sentiment_composite(self) -> List:
        """시장 심리 스냅샷 — FREDSentimentCompositeFetcher 위임."""
        return await QueryExecutor.fetch('fred', 'sentiment_composite', {})
    @cached(ttl=3600)
    async def get_sentiment_history(self, period: str = '5y') -> List:
        """VIX + HY 스프레드 심리 시계열 — FREDSentimentHistoryFetcher 위임."""
        start_date, end_date = parse_period_to_dates(period)
        return await QueryExecutor.fetch('fred', 'sentiment_history', {
            'start_date': start_date, 'end_date': end_date,
        })


    @cached(ttl=3600)
    async def get_gdp_forecast_data(self, period: str = "1y") -> List:
        """실질 GDP 성장률 시계열 — 기존 FREDGDPFetcher 재사용."""
        start_date, end_date = parse_period_to_dates(period)
        return await QueryExecutor.fetch('fred', 'gdp', {
            'frequency': 'quarterly',
            'start_date': start_date,
            'end_date': end_date,
        })

    @cached(ttl=3600)
    async def get_inflation_momentum_data(self, period: str = "3y") -> List:
        """CPI 모멘텀 시계열 — FREDInflationMomentumFetcher 위임."""
        start_date, end_date = parse_period_to_dates(period)
        return await QueryExecutor.fetch('fred', 'inflation_momentum', {
            'start_date': start_date,
            'end_date': end_date,
        })

    @cached(ttl=3600)
    async def get_initial_claims_data(self, period: str = "2y") -> List:
        """신규 실업급여 청구 시계열 — FREDInitialClaimsFetcher 위임."""
        start_date, end_date = parse_period_to_dates(period)
        return await QueryExecutor.fetch('fred', 'initial_claims', {
            'start_date': start_date, 'end_date': end_date,
        })
    @cached(ttl=3600)
    async def get_jobs_breakdown_data(self, period: str = "5y") -> List:
        """민간·정부 고용 변화 시계열 — FREDJobsBreakdownFetcher 위임."""
        start_date, end_date = parse_period_to_dates(period)
        return await QueryExecutor.fetch('fred', 'jobs_breakdown', {
            'start_date': start_date, 'end_date': end_date,
        })

    @cached(ttl=3600)
    async def get_inflation_sector_history(self, period: str = "5y") -> List:
        """섹터별 CPI YoY 시계열 — FREDInflationSectorFetcher 위임."""
        start_date, end_date = parse_period_to_dates(period)
        return await QueryExecutor.fetch('fred', 'inflation_sector', {
            'start_date': start_date, 'end_date': end_date,
        })

    # ------------------------------------------------------------------
    # Business Cycle: CFNAI + OECD CLI + Sahm Rule
    # ------------------------------------------------------------------
    @cached(ttl=3600)
    async def get_pmi_data(self, period: str = '5y') -> List:
        """경기순환 지표 시계열 — FREDPMIFetcher 위임."""
        start_date, end_date = parse_period_to_dates(period)
        return await QueryExecutor.fetch('fred', 'pmi', {
            'start_date': start_date,
            'end_date': end_date,
        })

    # ------------------------------------------------------------------
    # Fed Balance Sheet / QT Monitor
    # ------------------------------------------------------------------
    @cached(ttl=3600)
    async def get_fed_balance_sheet(self, period: str = '10y') -> List:
        """연준 총자산 시계열 — FREDFedBalanceSheetFetcher 위임."""
        start_date, end_date = parse_period_to_dates(period)
        return await QueryExecutor.fetch(
            'fred', 'fed_balance_sheet',
            {'start_date': start_date, 'end_date': end_date},
        )

    # ------------------------------------------------------------------
    # Real Rates: TIPS Yields + Breakeven Inflation
    # ------------------------------------------------------------------
    @cached(ttl=3600)
    async def get_real_rates(self, period: str = '5y') -> List:
        """실질금리 시계열 — FREDRealRatesFetcher 위임."""
        start_date, end_date = parse_period_to_dates(period)
        return await QueryExecutor.fetch('fred', 'real_rates', {
            'start_date': start_date,
            'end_date': end_date,
        })


    async def get_bond_prices(
        self,
        country: Optional[str] = None,
        issuer_name: Optional[str] = None,
        isin: Optional[str | List[str]] = None,
        lei: Optional[str] = None,
        currency: Optional[str | List[str]] = None,
        coupon_min: Optional[float] = None,
        coupon_max: Optional[float] = None,
        issued_amount_min: Optional[int] = None,
        issued_amount_max: Optional[int] = None,
        maturity_date_min: Optional[str] = None,
        maturity_date_max: Optional[str] = None,
        ytm_min: Optional[float] = None,
        ytm_max: Optional[float] = None,
        limit: int = 100,
    ) -> List[Dict[str, Any]]:
        """
        채권 가격 조회

        Args:
            country:           국가 (부분 매칭)
            issuer_name:       발행기관 이름 (부분 매칭, 대소문자 무관)
            isin:              ISIN (단일 문자열 또는 리스트)
            lei:               발행기관 LEI
            currency:          통화 코드 (USD, EUR 등)
            coupon_min/max:    쿠폰금리 범위 (%)
            issued_amount_min/max: 발행금액 범위
            maturity_date_min/max: 만기일 범위 (YYYY-MM-DD)
            ytm_min/max:       만기수익률 범위 (%)
            limit:             최대 반환 건수

        Returns:
            채권 데이터 리스트 (dict)
        """
        from datetime import date as date_t

        def _to_date(s):
            return date_t.fromisoformat(s) if s else None

        params = {
            k: v for k, v in {
                'country':           country,
                'issuer_name':       issuer_name,
                'isin':              isin,
                'lei':               lei,
                'currency':          currency,
                'coupon_min':        coupon_min,
                'coupon_max':        coupon_max,
                'issued_amount_min': issued_amount_min,
                'issued_amount_max': issued_amount_max,
                'maturity_date_min': _to_date(maturity_date_min),
                'maturity_date_max': _to_date(maturity_date_max),
                'ytm_min':           ytm_min,
                'ytm_max':           ytm_max,
                'limit':             limit,
            }.items() if v is not None
        }

        return await self._qe(FMPBondPricesFetcher, params)


# Global instance
macro_service = MacroService()

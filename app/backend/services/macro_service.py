"""
Macro Economic Service
Provides comprehensive macroeconomic data and analysis
"""
import asyncio
import sys
import logging
from pathlib import Path
from typing import Dict, Any, List, Optional

sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from app.backend.core.cache import cached
from data_fetcher.providers.fred.models.gdp import FREDGDPFetcher
from data_fetcher.providers.fred.models.unemployment import FREDUnemploymentFetcher
from data_fetcher.providers.fred.models.cpi import FREDCPIFetcher
from data_fetcher.providers.fred.models.interest_rate import FREDInterestRateFetcher
from data_fetcher.providers.fred.models.retail_sales import FREDRetailSalesFetcher
from data_fetcher.providers.fred.models.consumer_sentiment import FREDConsumerSentimentFetcher
from data_fetcher.providers.fred.models.nonfarm_payroll import FREDNonfarmPayrollFetcher
from data_fetcher.providers.fred.models.employment import FREDEmploymentFetcher
from data_fetcher.providers.fred.models.housing_starts import FREDHousingStartsFetcher
from data_fetcher.providers.fred.models.industrial_production import FREDIndustrialProductionFetcher
from data_fetcher.providers.bond.models.bond_prices import FMPBondPricesFetcher
from data_fetcher.query_executor import QueryExecutor
from data_fetcher.utils.helpers import parse_period_to_dates

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

    # (key, fetcher_cls, unit, params, use_last)
    # use_last=True  → data[-1]이 최신  (asc 정렬 fetcher)
    # use_last=False → data[0]이 최신   (desc 정렬 fetcher)
    _OVERVIEW_SPECS = [
        ('gdp',                FREDGDPFetcher,               'Billions of Chained 2012 Dollars', {},                               True),
        ('unemployment',       FREDUnemploymentFetcher,      'Percent',                          {},                               True),
        ('cpi',                FREDCPIFetcher,               'Index',                            {},                               True),
        ('fed_funds_rate',     FREDInterestRateFetcher,      'Percent',                          {'rate_type': 'federal_funds'},   False),
        ('retail_sales',       FREDRetailSalesFetcher,       'Millions of Dollars',              {},                               True),
        ('consumer_sentiment', FREDConsumerSentimentFetcher, 'Index',                            {},                               True),
    ]

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
        from data_fetcher.abstract_provider.abstract.fetcher import AnnotatedResult
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
    async def get_current_regime(self) -> List:
        """현재 경제 레짐 스냅샷 — FREDRegimeCurrentFetcher 위임."""
        return await QueryExecutor.fetch('fred', 'regime_current', {})

    @cached(ttl=3600)
    async def get_regime_history(self, period: str = '5y') -> List:
        """경제 레짐 시계열 — FREDRegimeHistoryFetcher 위임."""
        start_date, end_date = parse_period_to_dates(period)
        return await QueryExecutor.fetch('fred', 'regime_history', {
            'start_date': start_date, 'end_date': end_date,
        })
    @cached(ttl=1800)
    async def get_fed_policy_stance(self) -> List:
        """연준 정책 기조 스냅샷 — FREDFedPolicyStanceFetcher 위임."""
        return await QueryExecutor.fetch('fred', 'fed_policy_stance', {})

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
    async def get_inflation_decomposition(self) -> List:
        """CPI 구성요소별 YoY·기여도 — FREDInflationDecompositionFetcher 위임."""
        return await QueryExecutor.fetch('fred', 'inflation_decomposition', {})

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

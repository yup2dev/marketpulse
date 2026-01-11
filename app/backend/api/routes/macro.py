"""
Macro Economic API Routes
Endpoints for macroeconomic data and analysis
"""
import logging
from typing import Optional
from fastapi import APIRouter, HTTPException

from app.backend.services.macro_service import macro_service

log = logging.getLogger(__name__)
router = APIRouter()


@router.get("/indicators/overview")
async def get_indicators_overview():
    """
    Get overview of major economic indicators (latest values)

    Returns current values for GDP, Unemployment, CPI, Fed Funds Rate, etc.
    """
    try:
        data = await macro_service.get_economic_indicators_overview()
        return {"indicators": data}
    except Exception as e:
        log.error(f"Error fetching indicators overview: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/fred/series")
async def list_fred_series():
    """
    List all available FRED series with latest values

    Includes banking, credit, money supply, treasury rates, trade, real estate data
    """
    try:
        series = await macro_service.get_all_fred_series_overview()
        return {"series": series}
    except Exception as e:
        log.error(f"Error fetching FRED series list: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/fred/series/{series_key}")
async def get_fred_series_data(series_key: str, period: str = "5y"):
    """
    Get historical data for a specific FRED series

    Args:
        series_key: Series identifier (bank_loans, foreign_bank_assets, money_supply_m1, etc.)
        period: Time period (1y, 3y, 5y, 10y, max)

    Available series:
    - bank_loans: Total Loans and Leases at Commercial Banks
    - foreign_bank_assets: Assets and Liabilities of U.S. Branches and Agencies of Foreign Banks
    - consumer_credit: Consumer Credit Outstanding
    - money_supply_m1: M1 Money Supply
    - money_supply_m2: M2 Money Supply
    - treasury_10y: 10-Year Treasury Rate
    - treasury_2y: 2-Year Treasury Rate
    - trade_balance: Trade Balance
    - case_shiller: Home Price Index
    """
    try:
        data = await macro_service.get_fred_series_data(series_key, period)
        return data
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        log.error(f"Error fetching FRED series {series_key}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/forex/rates")
async def get_forex_rates():
    """
    Get latest forex exchange rates for major currency pairs

    Returns current rates for EUR/USD, USD/JPY, GBP/USD, USD/CNY, AUD/USD
    """
    try:
        rates = await macro_service.get_forex_rates()
        return {"forex_rates": rates}
    except Exception as e:
        log.error(f"Error fetching forex rates: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/forex/history")
async def get_forex_history(
    from_currency: str,
    to_currency: str,
    period: str = "1y"
):
    """
    Get historical forex data for a currency pair

    Args:
        from_currency: Base currency code (e.g., EUR, USD, GBP)
        to_currency: Quote currency code (e.g., USD, JPY, CNY)
        period: Time period (1mo, 3mo, 6mo, 1y, 3y, 5y)
    """
    try:
        data = await macro_service.get_forex_history(
            from_currency.upper(),
            to_currency.upper(),
            period
        )
        return data
    except Exception as e:
        log.error(f"Error fetching forex history: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/commodities/ratios")
async def get_commodity_ratios():
    """
    Get current commodity ratios (Gold/Silver, Gold/Oil, Copper/Gold)

    These ratios are important economic indicators:
    - Gold/Silver: Traditional store of value ratio
    - Gold/Oil: Purchasing power indicator
    - Copper/Gold: Economic health indicator (higher = growth)
    """
    try:
        ratios = await macro_service.get_commodity_ratios()
        return {"ratios": ratios}
    except Exception as e:
        log.error(f"Error fetching commodity ratios: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/commodities/ratios/{ratio_type}")
async def get_ratio_history(ratio_type: str, period: str = "5y"):
    """
    Get historical data for a commodity ratio

    Args:
        ratio_type: Type of ratio (gold_silver, gold_oil, copper_gold)
        period: Time period (1y, 3y, 5y, 10y, max)
    """
    try:
        data = await macro_service.get_ratio_history(ratio_type, period)
        return data
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        log.error(f"Error fetching ratio history for {ratio_type}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/categories")
async def get_macro_categories():
    """
    Get all macro data categories with available indicators
    """
    return {
        "categories": [
            {
                "id": "economic_indicators",
                "name": "Economic Indicators",
                "description": "Core macroeconomic indicators",
                "indicators": [
                    "GDP", "Unemployment", "CPI", "Fed Funds Rate",
                    "Retail Sales", "Consumer Sentiment"
                ]
            },
            {
                "id": "banking_credit",
                "name": "Banking & Credit",
                "description": "Banking sector and credit data",
                "indicators": [
                    "Total Bank Loans", "Foreign Bank Assets", "Consumer Credit"
                ]
            },
            {
                "id": "money_supply",
                "name": "Money Supply",
                "description": "Monetary aggregates",
                "indicators": ["M1", "M2"]
            },
            {
                "id": "interest_rates",
                "name": "Interest Rates",
                "description": "Treasury and market rates",
                "indicators": ["10-Year Treasury", "2-Year Treasury", "Fed Funds Rate"]
            },
            {
                "id": "trade",
                "name": "International Trade",
                "description": "Trade balance and forex",
                "indicators": ["Trade Balance", "Major Forex Pairs"]
            },
            {
                "id": "real_estate",
                "name": "Real Estate",
                "description": "Housing market data",
                "indicators": ["Case-Shiller Index", "Housing Starts"]
            },
            {
                "id": "commodities",
                "name": "Commodities",
                "description": "Commodity prices and ratios",
                "indicators": [
                    "Gold", "Silver", "Platinum", "Palladium",
                    "Crude Oil (WTI)", "Natural Gas", "Copper",
                    "Gold/Silver Ratio", "Gold/Oil Ratio", "Copper/Gold Ratio"
                ]
            }
        ]
    }


@router.get("/regime/current")
async def get_current_regime():
    """
    Get current economic regime analysis

    Returns:
        Current regime classification based on Growth and Inflation:
        - goldilocks: Positive growth + moderate inflation (ideal)
        - reflation: Growth recovering + inflation rising (recovery)
        - stagflation: Weak growth + high inflation (worst case)
        - deflation: Weak growth + low inflation (recession)

    Also includes:
        - growth_score: -100 to +100 (composite of GDP, Industrial Production, Employment)
        - inflation_score: -100 to +100 (based on CPI relative to 2% target)
        - momentum indicators (3-month trends)
        - component breakdown (GDP YoY, CPI YoY, etc.)
    """
    try:
        regime_data = await macro_service.get_current_regime()
        return regime_data
    except Exception as e:
        log.error(f"Error fetching current regime: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/regime/history")
async def get_regime_history(period: str = "5y"):
    """
    Get historical economic regime data

    Args:
        period: Time period (1y, 3y, 5y, 10y, max)

    Returns:
        Historical regime classifications and transitions over time.
        Useful for visualizing regime changes and economic cycles.
    """
    try:
        history_data = await macro_service.get_regime_history(period)
        return history_data
    except Exception as e:
        log.error(f"Error fetching regime history: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/fed-policy/stance")
async def get_fed_policy_stance():
    """
    Get current Federal Reserve policy stance analysis

    Returns:
        {
            'stance': str,  # 'hawkish', 'neutral', 'dovish'
            'stance_score': float,  # -100 (dovish) to +100 (hawkish)
            'fed_funds_rate': float,
            'fed_funds_target_range': {'lower': float, 'upper': float},
            'next_meeting': {
                'date': str,
                'probabilities': {
                    'hike': float,  # % probability
                    'hold': float,
                    'cut': float
                }
            },
            'historical_context': {
                'rate_changes_12m': int,
                'peak_rate': float,
                'trough_rate': float
            }
        }
    """
    try:
        stance_data = await macro_service.get_fed_policy_stance()
        return stance_data
    except Exception as e:
        log.error(f"Error fetching Fed policy stance: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/yield-curve")
async def get_yield_curve():
    """
    Get current US Treasury yield curve data

    Returns:
        {
            'curve': [
                {'maturity': str, 'years': float, 'yield': float},
                ...
            ],
            'spreads': {
                '2y10y': float,  # 2-year to 10-year spread
                '3m10y': float,  # 3-month to 10-year spread
                '5y30y': float   # 5-year to 30-year spread
            },
            'curve_shape': str,  # 'normal', 'flat', 'inverted', 'humped'
            'inversion_signal': bool,
            'historical_percentile': {
                '2y10y': float  # Where current spread sits historically (0-100)
            }
        }
    """
    try:
        yield_curve_data = await macro_service.get_yield_curve()
        return yield_curve_data
    except Exception as e:
        log.error(f"Error fetching yield curve: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/yield-curve/history")
async def get_yield_curve_history(period: str = "5y"):
    """
    Get historical yield curve data

    Args:
        period: Time period (1y, 3y, 5y, 10y, max)

    Returns:
        Historical spreads and inversions over time
    """
    try:
        history_data = await macro_service.get_yield_curve_history(period)
        return history_data
    except Exception as e:
        log.error(f"Error fetching yield curve history: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/inflation/decomposition")
async def get_inflation_decomposition():
    """
    Get detailed inflation breakdown and analysis

    Returns:
        {
            'headline_cpi': {
                'current': float,
                'yoy': float,
                'mom': float
            },
            'core_cpi': {
                'current': float,
                'yoy': float,
                'mom': float
            },
            'components': [
                {
                    'category': str,  # Energy, Food, Shelter, Services, Goods
                    'weight': float,  # % of CPI basket
                    'yoy_change': float,
                    'contribution': float  # Contribution to overall inflation
                },
                ...
            ],
            'sticky_vs_flexible': {
                'sticky_cpi_yoy': float,
                'flexible_cpi_yoy': float
            },
            'expectations': {
                '5y_breakeven': float,
                '10y_breakeven': float
            }
        }
    """
    try:
        data = await macro_service.get_inflation_decomposition()
        return data
    except Exception as e:
        log.error(f"Error fetching inflation decomposition: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/labor/dashboard")
async def get_labor_dashboard():
    """
    Get comprehensive labor market metrics

    Returns:
        {
            'unemployment': {
                'u3': float,  # Official unemployment rate
                'u6': float,  # Broader unemployment (underemployed + discouraged)
                'participation_rate': float,
                'trend': str  # 'improving', 'stable', 'deteriorating'
            },
            'job_market': {
                'nonfarm_payrolls': int,
                'payroll_change_mom': int,
                'jolts_openings': int,
                'quits_rate': float,
                'initial_claims': int,
                'continuing_claims': int
            },
            'wages': {
                'hourly_earnings': float,
                'hourly_earnings_yoy': float,
                'unit_labor_cost': float,
                'productivity_growth': float
            },
            'heat_index': float,  # 0-100 composite score
            'phillips_curve': {
                'current_point': {
                    'unemployment': float,
                    'inflation': float
                },
                'historical_average': {
                    'unemployment': float,
                    'inflation': float
                }
            }
        }
    """
    try:
        data = await macro_service.get_labor_dashboard()
        return data
    except Exception as e:
        log.error(f"Error fetching labor dashboard: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/labor/history")
async def get_labor_history(period: str = "5y"):
    """
    Get historical labor market data for Phillips Curve analysis

    Args:
        period: Time period (1y, 3y, 5y, 10y, max)

    Returns:
        Historical unemployment and inflation data points
    """
    try:
        data = await macro_service.get_labor_history(period)
        return data
    except Exception as e:
        log.error(f"Error fetching labor history: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/financial-conditions")
async def get_financial_conditions():
    """
    Get comprehensive financial conditions analysis

    Returns:
        {
            'fci_composite': {
                'value': float,  # -100 (loose) to +100 (tight)
                'status': str,  # 'loose', 'neutral', 'tight', 'very_tight'
                'sources': {
                    'chicago_fed': float,
                    'bloomberg': float,  # If available
                    'goldman_sachs': float  # If available
                }
            },
            'credit_spreads': {
                'investment_grade': {
                    'spread': float,  # basis points
                    'percentile': float  # Historical percentile
                },
                'high_yield': {
                    'spread': float,
                    'percentile': float
                },
                'bbb_treasury': {
                    'spread': float,
                    'description': str
                },
                'distressed_ratio': float  # % of bonds trading > 1000bp
            },
            'liquidity': {
                'ted_spread': float,  # Bank credit risk
                'libor_ois_spread': float,  # Interbank lending stress
                'commercial_paper_outstanding': float  # Billions
            },
            'consumer_health': {
                'consumer_credit_growth': float,  # YoY %
                'credit_card_delinquency': float,  # %
                'auto_loan_delinquency': float,  # %
                'mortgage_delinquency': float  # %
            },
            'corporate_health': {
                'corporate_debt_to_gdp': float,  # %
                'interest_coverage_ratio': float,
                'debt_growth_yoy': float  # %
            }
        }
    """
    try:
        data = await macro_service.get_financial_conditions()
        return data
    except Exception as e:
        log.error(f"Error fetching financial conditions: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/financial-conditions/history")
async def get_financial_conditions_history(period: str = "5y"):
    """
    Get historical financial conditions index data

    Args:
        period: Time period (1y, 3y, 5y, 10y, max)

    Returns:
        Historical FCI values and credit spread data
    """
    try:
        data = await macro_service.get_financial_conditions_history(period)
        return data
    except Exception as e:
        log.error(f"Error fetching financial conditions history: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/sentiment/composite")
async def get_sentiment_composite():
    """
    Get comprehensive market sentiment analysis

    Returns:
        {
            'fear_greed_index': {
                'value': float,  # 0 (extreme fear) to 100 (extreme greed)
                'status': str,  # 'extreme_fear', 'fear', 'neutral', 'greed', 'extreme_greed'
                'components': {
                    'vix': {'value': float, 'score': float},
                    'skew': {'value': float, 'score': float},
                    'put_call_ratio': {'value': float, 'score': float},
                    'high_yield_spread': {'value': float, 'score': float},
                    'safe_haven_demand': {'score': float}
                }
            },
            'volatility': {
                'vix': float,
                'vix_percentile': float,
                'vix_status': str,  # 'low', 'normal', 'elevated', 'high'
                'skew': float
            },
            'positioning': {
                'aaii_sentiment': {
                    'bullish': float,  # %
                    'bearish': float,  # %
                    'neutral': float,  # %
                    'bull_bear_spread': float
                },
                'fund_flows': {
                    'equity_flows': float,  # Weekly in billions
                    'bond_flows': float,
                    'money_market_flows': float
                }
            },
            'cross_asset_signals': {
                'stock_bond_correlation': float,
                'risk_on_off': str,  # 'risk_on', 'risk_off', 'mixed'
                'safe_haven_strength': float  # 0-100
            }
        }
    """
    try:
        data = await macro_service.get_sentiment_composite()
        return data
    except Exception as e:
        log.error(f"Error fetching sentiment composite: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/sentiment/history")
async def get_sentiment_history(period: str = "5y"):
    """
    Get historical sentiment data

    Args:
        period: Time period (1y, 3y, 5y, 10y, max)

    Returns:
        Historical VIX, sentiment scores, and fear/greed index
    """
    try:
        data = await macro_service.get_sentiment_history(period)
        return data
    except Exception as e:
        log.error(f"Error fetching sentiment history: {e}")
        raise HTTPException(status_code=500, detail=str(e))

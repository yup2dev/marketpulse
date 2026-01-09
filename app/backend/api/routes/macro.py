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

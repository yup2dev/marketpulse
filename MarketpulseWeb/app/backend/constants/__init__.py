"""
Constants package for MarketPulse backend
Contains centralized constant definitions to prevent typos and improve maintainability
"""

from .fred_series import (
    STICKY_CORE_CPI,
    FLEXIBLE_CORE_CPI,
    BREAKEVEN_5Y,
    BREAKEVEN_10Y,
    CORE_CPI,
    GDP,
    UNEMPLOYMENT_RATE,
    FED_FUNDS_RATE,
    TREASURY_10Y,
    TREASURY_2Y,
)

__all__ = [
    'STICKY_CORE_CPI',
    'FLEXIBLE_CORE_CPI',
    'BREAKEVEN_5Y',
    'BREAKEVEN_10Y',
    'CORE_CPI',
    'GDP',
    'UNEMPLOYMENT_RATE',
    'FED_FUNDS_RATE',
    'TREASURY_10Y',
    'TREASURY_2Y',
]

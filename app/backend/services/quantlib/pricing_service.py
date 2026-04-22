"""QuantLib Pricing Service — 옵션 가격/Greeks 로컬 계산"""
from typing import Any, Dict, Optional

from data_fetcher.query_executor import QueryExecutor
from data_fetcher.fetchers.base import AnnotatedResult
from data_fetcher.models.quantlib.pricing import OptionPricingData


def _unwrap(raw):
    return raw.result if isinstance(raw, AnnotatedResult) else raw


def _first(raw):
    result = _unwrap(raw)
    return result[0] if result else None


async def price_option(params: Dict[str, Any]) -> Optional[OptionPricingData]:
    """
    옵션 가격 및 Greeks 계산

    Args:
        params: OptionPricingQueryParams 필드
            - option_type: "call" | "put"
            - exercise_style: "european" | "american" (default: european)
            - engine: "analytic" | "binomial" | "mc" (default: analytic)
            - spot, strike, expiry(date), volatility, risk_free_rate, dividend_yield
            - mc_samples, binomial_steps (optional)

    Returns:
        OptionPricingData (NPV, delta/gamma/theta/vega/rho, intrinsic/time value)
    """
    raw = await QueryExecutor.fetch("quantlib", "pricing", params)
    return _first(raw)

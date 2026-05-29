"""Macro Economic API Routes — OBBject pattern"""
import logging
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Query as FQuery

from data_fetcher.core.obbject import OBBject
from app.backend.services.macro_service import macro_service
from app.backend.api.deps import route_handler

log = logging.getLogger(__name__)
router = APIRouter()


def _wrap(data: Any, provider: str = "fred") -> OBBject:
    items = data if isinstance(data, list) else ([data] if data is not None else [])
    results = [
        item.model_dump(mode="json") if hasattr(item, "model_dump") else item
        for item in items
    ]
    return OBBject(results=results, provider=provider)




# ── Economic Indicators ───────────────────────────────────────────────────────

@router.get("/indicators/overview")
@route_handler
async def get_indicators_overview(provider: str = "fred") -> OBBject:
    data = await macro_service.get_economic_indicators_overview()
    return _wrap(data, provider)


@router.get("/indicators/{indicator_key}/history")
@route_handler
async def get_indicator_history(
    indicator_key: str,
    period: str = "5y",
    provider: str = "fred",
) -> OBBject:
    data = await macro_service.get_indicator_history(indicator_key, period)
    return _wrap(data, provider)


# ── FRED Series ───────────────────────────────────────────────────────────────

@router.get("/fred/series")
@route_handler
async def list_fred_series(provider: str = "fred") -> OBBject:
    data = await macro_service.get_all_fred_series_overview()
    return _wrap(data, provider)


@router.get("/fred/series/{series_key}")
@route_handler
async def get_fred_series_data(
    series_key: str,
    period: str = "5y",
    provider: str = "fred",
) -> OBBject:
    data = await macro_service.get_fred_series_data(series_key, period)
    return _wrap(data, provider)


# ── Forex ─────────────────────────────────────────────────────────────────────

@router.get("/forex/rates")
@route_handler
async def get_forex_rates(provider: str = "yahoo") -> OBBject:
    data = await macro_service.get_forex_rates()
    return _wrap(data, provider)


@router.get("/forex/history")
@route_handler
async def get_forex_history(
    from_currency: str,
    to_currency: str,
    period: str = "1y",
    provider: str = "yahoo",
) -> OBBject:
    data = await macro_service.get_forex_history(
        from_currency.upper(), to_currency.upper(), period
    )
    return _wrap(data, provider)


# ── Commodities ───────────────────────────────────────────────────────────────

@router.get("/commodities/ratios")
@route_handler
async def get_commodity_ratios(provider: str = "yahoo") -> OBBject:
    data = await macro_service.get_commodity_ratios()
    return _wrap(data, provider)


@router.get("/commodities/ratios/{ratio_type}")
@route_handler
async def get_ratio_history(
    ratio_type: str,
    period: str = "5y",
    provider: str = "yahoo",
) -> OBBject:
    data = await macro_service.get_ratio_history(ratio_type, period)
    return _wrap(data, provider)


# ── Categories (static) ───────────────────────────────────────────────────────

@router.get("/categories")
async def get_macro_categories() -> OBBject:
    categories = [
        {"id": "economic_indicators", "name": "Economic Indicators",
         "description": "Core macroeconomic indicators",
         "indicators": ["GDP", "Unemployment", "CPI", "Fed Funds Rate", "Retail Sales", "Consumer Sentiment"]},
        {"id": "banking_credit", "name": "Banking & Credit",
         "description": "Banking sector and credit data",
         "indicators": ["Total Bank Loans", "Foreign Bank Assets", "Consumer Credit"]},
        {"id": "money_supply", "name": "Money Supply",
         "description": "Monetary aggregates",
         "indicators": ["M1", "M2"]},
        {"id": "interest_rates", "name": "Interest Rates",
         "description": "Treasury and market rates",
         "indicators": ["10-Year Treasury", "2-Year Treasury", "Fed Funds Rate"]},
        {"id": "trade", "name": "International Trade",
         "description": "Trade balance and forex",
         "indicators": ["Trade Balance", "Major Forex Pairs"]},
        {"id": "real_estate", "name": "Real Estate",
         "description": "Housing market data",
         "indicators": ["Case-Shiller Index", "Housing Starts"]},
        {"id": "commodities", "name": "Commodities",
         "description": "Commodity prices and ratios",
         "indicators": ["Gold", "Silver", "Crude Oil (WTI)", "Gold/Silver Ratio", "Copper/Gold Ratio"]},
    ]
    return OBBject(results=categories, provider="static")


# ── Economic Regime ───────────────────────────────────────────────────────────

@router.get("/regime/current")
@route_handler
async def get_current_regime(provider: str = "fred") -> OBBject:
    data = await macro_service.get_current_regime()
    return _wrap(data, provider)


@router.get("/regime/history")
@route_handler
async def get_regime_history(period: str = "5y", provider: str = "fred") -> OBBject:
    data = await macro_service.get_regime_history(period)
    return _wrap(data, provider)


# ── Fed Policy ────────────────────────────────────────────────────────────────

@router.get("/fed-policy/stance")
@route_handler
async def get_fed_policy_stance(provider: str = "fred") -> OBBject:
    data = await macro_service.get_fed_policy_stance()
    return _wrap(data, provider)


# ── Yield Curve ───────────────────────────────────────────────────────────────

@router.get("/yield-curve")
@route_handler
async def get_yield_curve(provider: str = "fred") -> OBBject:
    data = await macro_service.get_yield_curve()
    return _wrap(data, provider)


@router.get("/yield-curve/history")
@route_handler
async def get_yield_curve_history(period: str = "5y", provider: str = "fred") -> OBBject:
    data = await macro_service.get_yield_curve_history(period)
    return _wrap(data, provider)


# ── Inflation ─────────────────────────────────────────────────────────────────

@router.get("/inflation/decomposition")
@route_handler
async def get_inflation_decomposition(provider: str = "fred") -> OBBject:
    data = await macro_service.get_inflation_decomposition()
    return _wrap(data, provider)


@router.get("/inflation/sector-history")
@route_handler
async def get_inflation_sector_history(period: str = "5y", provider: str = "fred") -> OBBject:
    data = await macro_service.get_inflation_sector_history(period)
    return _wrap(data, provider)


# ── Labor Market ──────────────────────────────────────────────────────────────

@router.get("/labor/dashboard")
@route_handler
async def get_labor_dashboard(provider: str = "fred") -> OBBject:
    data = await macro_service.get_labor_dashboard()
    return _wrap(data, provider)


@router.get("/labor/history")
@route_handler
async def get_labor_history(period: str = "5y", provider: str = "fred") -> OBBject:
    data = await macro_service.get_labor_history(period)
    return _wrap(data, provider)


# ── Financial Conditions ──────────────────────────────────────────────────────

@router.get("/financial-conditions")
@route_handler
async def get_financial_conditions(provider: str = "fred") -> OBBject:
    data = await macro_service.get_financial_conditions()
    return _wrap(data, provider)


@router.get("/financial-conditions/history")
@route_handler
async def get_financial_conditions_history(period: str = "5y", provider: str = "fred") -> OBBject:
    data = await macro_service.get_financial_conditions_history(period)
    return _wrap(data, provider)


# ── Sentiment ─────────────────────────────────────────────────────────────────

@router.get("/sentiment/composite")
@route_handler
async def get_sentiment_composite(provider: str = "fred") -> OBBject:
    data = await macro_service.get_sentiment_composite()
    return _wrap(data, provider)


@router.get("/sentiment/history")
@route_handler
async def get_sentiment_history(period: str = "5y", provider: str = "fred") -> OBBject:
    data = await macro_service.get_sentiment_history(period)
    return _wrap(data, provider)


# ── Overview ──────────────────────────────────────────────────────────────────

@router.get("/overview/gdp-forecast")
@route_handler
async def get_gdp_forecast(period: str = "1y", provider: str = "fred") -> OBBject:
    data = await macro_service.get_gdp_forecast_data(period)
    return _wrap(data, provider)


@router.get("/overview/inflation-momentum")
@route_handler
async def get_inflation_momentum(period: str = "3y", provider: str = "fred") -> OBBject:
    data = await macro_service.get_inflation_momentum_data(period)
    return _wrap(data, provider)


@router.get("/overview/initial-claims")
@route_handler
async def get_initial_claims(period: str = "2y", provider: str = "fred") -> OBBject:
    data = await macro_service.get_initial_claims_data(period)
    return _wrap(data, provider)


@router.get("/overview/jobs-breakdown")
@route_handler
async def get_jobs_breakdown(period: str = "5y", provider: str = "fred") -> OBBject:
    data = await macro_service.get_jobs_breakdown_data(period)
    return _wrap(data, provider)


# ── Business Cycle ────────────────────────────────────────────────────────────

@router.get("/business-cycle/pmi")
@route_handler
async def get_pmi_data(period: str = "5y", provider: str = "fred") -> OBBject:
    data = await macro_service.get_pmi_data(period)
    return _wrap(data, provider)


@router.get("/fed-balance-sheet")
@route_handler
async def get_fed_balance_sheet(period: str = "10y", provider: str = "fred") -> OBBject:
    data = await macro_service.get_fed_balance_sheet(period)
    return _wrap(data, provider)


@router.get("/real-rates")
@route_handler
async def get_real_rates(period: str = "5y", provider: str = "fred") -> OBBject:
    data = await macro_service.get_real_rates(period)
    return _wrap(data, provider)


# ── Economic Calendar (static) ────────────────────────────────────────────────

@router.get("/economic-calendar")
@route_handler
async def get_economic_calendar(provider: str = "static") -> OBBject:
    from datetime import datetime, timedelta

    today = datetime.now().date()
    monday = today - timedelta(days=today.weekday())
    friday = monday + timedelta(days=4)

    indicators = [
        {"name": "GDP (Advanced)", "frequency": "Quarterly", "source": "BEA", "impact": "high", "category": "Growth"},
        {"name": "Nonfarm Payrolls", "frequency": "Monthly", "source": "BLS", "impact": "high", "category": "Employment"},
        {"name": "CPI", "frequency": "Monthly", "source": "BLS", "impact": "high", "category": "Inflation"},
        {"name": "PPI", "frequency": "Monthly", "source": "BLS", "impact": "medium", "category": "Inflation"},
        {"name": "Retail Sales", "frequency": "Monthly", "source": "Census Bureau", "impact": "high", "category": "Consumer"},
        {"name": "Initial Jobless Claims", "frequency": "Weekly", "source": "DOL", "impact": "medium", "category": "Employment"},
        {"name": "Consumer Sentiment (UMich)", "frequency": "Monthly", "source": "UMich", "impact": "medium", "category": "Sentiment"},
        {"name": "ISM Manufacturing PMI", "frequency": "Monthly", "source": "ISM", "impact": "high", "category": "Manufacturing"},
        {"name": "ISM Services PMI", "frequency": "Monthly", "source": "ISM", "impact": "high", "category": "Services"},
        {"name": "FOMC Minutes / Rate Decision", "frequency": "8x/year", "source": "Fed", "impact": "high", "category": "Monetary Policy"},
        {"name": "Housing Starts", "frequency": "Monthly", "source": "Census Bureau", "impact": "medium", "category": "Housing"},
        {"name": "Industrial Production", "frequency": "Monthly", "source": "Fed", "impact": "medium", "category": "Manufacturing"},
        {"name": "Durable Goods Orders", "frequency": "Monthly", "source": "Census Bureau", "impact": "medium", "category": "Manufacturing"},
        {"name": "PCE Price Index", "frequency": "Monthly", "source": "BEA", "impact": "high", "category": "Inflation"},
        {"name": "Trade Balance", "frequency": "Monthly", "source": "Census Bureau", "impact": "medium", "category": "Trade"},
        {"name": "Continuing Claims", "frequency": "Weekly", "source": "DOL", "impact": "low", "category": "Employment"},
        {"name": "Consumer Confidence (CB)", "frequency": "Monthly", "source": "Conference Board", "impact": "medium", "category": "Sentiment"},
        {"name": "Existing Home Sales", "frequency": "Monthly", "source": "NAR", "impact": "medium", "category": "Housing"},
        {"name": "New Home Sales", "frequency": "Monthly", "source": "Census Bureau", "impact": "medium", "category": "Housing"},
        {"name": "EIA Crude Oil Inventories", "frequency": "Weekly", "source": "EIA", "impact": "medium", "category": "Energy"},
    ]
    return OBBject(
        results=indicators,
        provider=provider,
        metadata={"week_start": monday.isoformat(), "week_end": friday.isoformat()},
    )


# ── Bonds ─────────────────────────────────────────────────────────────────────

@router.get("/bonds")
@route_handler
async def get_bond_prices(
    country: Optional[str] = FQuery(default=None),
    issuer_name: Optional[str] = FQuery(default=None),
    isin: Optional[List[str]] = FQuery(default=None),
    lei: Optional[str] = FQuery(default=None),
    currency: Optional[List[str]] = FQuery(default=None),
    coupon_min: Optional[float] = FQuery(default=None),
    coupon_max: Optional[float] = FQuery(default=None),
    issued_amount_min: Optional[int] = FQuery(default=None),
    issued_amount_max: Optional[int] = FQuery(default=None),
    maturity_date_min: Optional[str] = FQuery(default=None),
    maturity_date_max: Optional[str] = FQuery(default=None),
    ytm_min: Optional[float] = FQuery(default=None),
    ytm_max: Optional[float] = FQuery(default=None),
    limit: int = FQuery(default=100, ge=1, le=1000),
    provider: str = "fmp",
) -> OBBject:
    data = await macro_service.get_bond_prices(
        country=country, issuer_name=issuer_name, isin=isin, lei=lei,
        currency=currency, coupon_min=coupon_min, coupon_max=coupon_max,
        issued_amount_min=issued_amount_min, issued_amount_max=issued_amount_max,
        maturity_date_min=maturity_date_min, maturity_date_max=maturity_date_max,
        ytm_min=ytm_min, ytm_max=ytm_max, limit=limit,
    )
    return _wrap(data, provider)

"""
Macro Economic API Routes
Endpoints for macroeconomic data and analysis
"""
import logging
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Query

from app.backend.services.macro_service import macro_service
from app.backend.api.deps import route_handler

log = logging.getLogger(__name__)
router = APIRouter()


@router.get("/indicators/overview")
@route_handler
async def get_indicators_overview():
    """Get overview of major economic indicators (latest values)"""
    data = await macro_service.get_economic_indicators_overview()
    return {"indicators": data}


@router.get("/indicators/{indicator_key}/history")
@route_handler
async def get_indicator_history(indicator_key: str, period: str = "5y"):
    """
    Get historical data for a specific economic indicator

    Args:
        indicator_key: Indicator identifier (gdp, unemployment, cpi, fed_funds_rate, retail_sales, consumer_sentiment)
        period: Time period (1y, 3y, 5y, 10y, max)
    """
    return await macro_service.get_indicator_history(indicator_key, period)


@router.get("/fred/series")
@route_handler
async def list_fred_series():
    """List all available FRED series with latest values"""
    series = await macro_service.get_all_fred_series_overview()
    return {"series": series}


@router.get("/fred/series/{series_key}")
@route_handler
async def get_fred_series_data(series_key: str, period: str = "5y"):
    """
    Get historical data for a specific FRED series

    Args:
        series_key: Series identifier (bank_loans, foreign_bank_assets, money_supply_m1, etc.)
        period: Time period (1y, 3y, 5y, 10y, max)
    """
    return await macro_service.get_fred_series_data(series_key, period)


@router.get("/forex/rates")
@route_handler
async def get_forex_rates():
    """Get latest forex exchange rates for major currency pairs"""
    rates = await macro_service.get_forex_rates()
    return {"forex_rates": rates}


@router.get("/forex/history")
@route_handler
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
    return await macro_service.get_forex_history(
        from_currency.upper(),
        to_currency.upper(),
        period
    )


@router.get("/commodities/ratios")
@route_handler
async def get_commodity_ratios():
    """Get current commodity ratios (Gold/Silver, Gold/Oil, Copper/Gold)"""
    ratios = await macro_service.get_commodity_ratios()
    return {"ratios": ratios}


@router.get("/commodities/ratios/{ratio_type}")
@route_handler
async def get_ratio_history(ratio_type: str, period: str = "5y"):
    """
    Get historical data for a commodity ratio

    Args:
        ratio_type: Type of ratio (gold_silver, gold_oil, copper_gold)
        period: Time period (1y, 3y, 5y, 10y, max)
    """
    return await macro_service.get_ratio_history(ratio_type, period)


@router.get("/categories")
async def get_macro_categories():
    """Get all macro data categories with available indicators"""
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
@route_handler
async def get_current_regime():
    """Get current economic regime analysis (goldilocks / reflation / stagflation / deflation)"""
    return await macro_service.get_current_regime()


@router.get("/regime/history")
@route_handler
async def get_regime_history(period: str = "5y"):
    """Get historical economic regime data"""
    return await macro_service.get_regime_history(period)


@router.get("/fed-policy/stance")
@route_handler
async def get_fed_policy_stance():
    """Get current Federal Reserve policy stance analysis"""
    return await macro_service.get_fed_policy_stance()


@router.get("/yield-curve")
@route_handler
async def get_yield_curve():
    """Get current US Treasury yield curve data"""
    return await macro_service.get_yield_curve()


@router.get("/yield-curve/history")
@route_handler
async def get_yield_curve_history(period: str = "5y"):
    """Get historical yield curve data"""
    return await macro_service.get_yield_curve_history(period)


@router.get("/inflation/decomposition")
@route_handler
async def get_inflation_decomposition():
    """Get detailed inflation breakdown and analysis"""
    return await macro_service.get_inflation_decomposition()


@router.get("/inflation/sector-history")
@route_handler
async def get_inflation_sector_history(period: str = "5y"):
    """
    Get historical YoY CPI by sector

    Args:
        period: Time period (1y, 3y, 5y, 10y, max)
    """
    return await macro_service.get_inflation_sector_history(period)


@router.get("/labor/dashboard")
@route_handler
async def get_labor_dashboard():
    """Get comprehensive labor market metrics"""
    return await macro_service.get_labor_dashboard()


@router.get("/labor/history")
@route_handler
async def get_labor_history(period: str = "5y"):
    """Get historical labor market data for Phillips Curve analysis"""
    return await macro_service.get_labor_history(period)


@router.get("/financial-conditions")
@route_handler
async def get_financial_conditions():
    """Get comprehensive financial conditions analysis"""
    return await macro_service.get_financial_conditions()


@router.get("/financial-conditions/history")
@route_handler
async def get_financial_conditions_history(period: str = "5y"):
    """Get historical financial conditions index data"""
    return await macro_service.get_financial_conditions_history(period)


@router.get("/sentiment/composite")
@route_handler
async def get_sentiment_composite():
    """Get comprehensive market sentiment analysis"""
    return await macro_service.get_sentiment_composite()


@router.get("/sentiment/history")
@route_handler
async def get_sentiment_history(period: str = "5y"):
    """Get historical sentiment data"""
    return await macro_service.get_sentiment_history(period)


@router.get("/overview/gdp-forecast")
@route_handler
async def get_gdp_forecast(period: str = "1y"):
    """Get GDP forecast/nowcast data for overview widget"""
    return await macro_service.get_gdp_forecast_data(period)


@router.get("/overview/inflation-momentum")
@route_handler
async def get_inflation_momentum(period: str = "3y"):
    """Get inflation momentum data (12M, 6M, 3M rates)"""
    return await macro_service.get_inflation_momentum_data(period)


@router.get("/overview/initial-claims")
@route_handler
async def get_initial_claims(period: str = "2y"):
    """Get initial unemployment claims data with 4-week MA"""
    return await macro_service.get_initial_claims_data(period)


@router.get("/overview/jobs-breakdown")
@route_handler
async def get_jobs_breakdown(period: str = "5y"):
    """Get employment breakdown (Private vs Government)"""
    return await macro_service.get_jobs_breakdown_data(period)


@router.get("/business-cycle/pmi")
@route_handler
async def get_pmi_data(period: str = "5y"):
    """Get ISM Manufacturing PMI and Conference Board Leading Economic Index (LEI)."""
    return await macro_service.get_pmi_data(period)


@router.get("/fed-balance-sheet")
@route_handler
async def get_fed_balance_sheet(period: str = "10y"):
    """Get Federal Reserve balance sheet (total assets) history."""
    return await macro_service.get_fed_balance_sheet(period)


@router.get("/real-rates")
@route_handler
async def get_real_rates(period: str = "5y"):
    """Get real (TIPS) Treasury yields and breakeven inflation rates."""
    return await macro_service.get_real_rates(period)


@router.get("/economic-calendar")
@route_handler
async def get_economic_calendar():
    """이번 주 주요 경제지표 발표 일정."""
    from datetime import datetime, timedelta

    today = datetime.now().date()
    weekday = today.weekday()
    monday = today - timedelta(days=weekday)
    friday = monday + timedelta(days=4)

    indicators = [
        {"name": "GDP (Advanced)", "frequency": "Quarterly", "source": "BEA",
         "impact": "high", "category": "Growth"},
        {"name": "Nonfarm Payrolls", "frequency": "Monthly", "source": "BLS",
         "impact": "high", "category": "Employment"},
        {"name": "CPI", "frequency": "Monthly", "source": "BLS",
         "impact": "high", "category": "Inflation"},
        {"name": "PPI", "frequency": "Monthly", "source": "BLS",
         "impact": "medium", "category": "Inflation"},
        {"name": "Retail Sales", "frequency": "Monthly", "source": "Census Bureau",
         "impact": "high", "category": "Consumer"},
        {"name": "Initial Jobless Claims", "frequency": "Weekly", "source": "DOL",
         "impact": "medium", "category": "Employment"},
        {"name": "Consumer Sentiment (UMich)", "frequency": "Monthly", "source": "UMich",
         "impact": "medium", "category": "Sentiment"},
        {"name": "ISM Manufacturing PMI", "frequency": "Monthly", "source": "ISM",
         "impact": "high", "category": "Manufacturing"},
        {"name": "ISM Services PMI", "frequency": "Monthly", "source": "ISM",
         "impact": "high", "category": "Services"},
        {"name": "FOMC Minutes / Rate Decision", "frequency": "8x/year", "source": "Fed",
         "impact": "high", "category": "Monetary Policy"},
        {"name": "Housing Starts", "frequency": "Monthly", "source": "Census Bureau",
         "impact": "medium", "category": "Housing"},
        {"name": "Industrial Production", "frequency": "Monthly", "source": "Fed",
         "impact": "medium", "category": "Manufacturing"},
        {"name": "Durable Goods Orders", "frequency": "Monthly", "source": "Census Bureau",
         "impact": "medium", "category": "Manufacturing"},
        {"name": "PCE Price Index", "frequency": "Monthly", "source": "BEA",
         "impact": "high", "category": "Inflation"},
        {"name": "Trade Balance", "frequency": "Monthly", "source": "Census Bureau",
         "impact": "medium", "category": "Trade"},
        {"name": "Continuing Claims", "frequency": "Weekly", "source": "DOL",
         "impact": "low", "category": "Employment"},
        {"name": "Consumer Confidence (CB)", "frequency": "Monthly", "source": "Conference Board",
         "impact": "medium", "category": "Sentiment"},
        {"name": "Existing Home Sales", "frequency": "Monthly", "source": "NAR",
         "impact": "medium", "category": "Housing"},
        {"name": "New Home Sales", "frequency": "Monthly", "source": "Census Bureau",
         "impact": "medium", "category": "Housing"},
        {"name": "EIA Crude Oil Inventories", "frequency": "Weekly", "source": "EIA",
         "impact": "medium", "category": "Energy"},
    ]

    return {
        "week_start": monday.isoformat(),
        "week_end": friday.isoformat(),
        "indicators": indicators,
    }


@router.get("/bonds")
@route_handler
async def get_bond_prices(
    country: Optional[str] = Query(default=None, description="국가 (부분 매칭)"),
    issuer_name: Optional[str] = Query(default=None, description="발행기관 이름"),
    isin: Optional[List[str]] = Query(default=None, description="ISIN (복수 지정 가능)"),
    lei: Optional[str] = Query(default=None, description="LEI"),
    currency: Optional[List[str]] = Query(default=None, description="통화 코드 (USD, EUR ...)"),
    coupon_min: Optional[float] = Query(default=None, description="최소 쿠폰금리 (%)"),
    coupon_max: Optional[float] = Query(default=None, description="최대 쿠폰금리 (%)"),
    issued_amount_min: Optional[int] = Query(default=None, description="최소 발행금액"),
    issued_amount_max: Optional[int] = Query(default=None, description="최대 발행금액"),
    maturity_date_min: Optional[str] = Query(default=None, description="최소 만기일 (YYYY-MM-DD)"),
    maturity_date_max: Optional[str] = Query(default=None, description="최대 만기일 (YYYY-MM-DD)"),
    ytm_min: Optional[float] = Query(default=None, description="최소 YTM (%)"),
    ytm_max: Optional[float] = Query(default=None, description="최대 YTM (%)"),
    limit: int = Query(default=100, ge=1, le=1000, description="최대 반환 건수"),
):
    """채권 가격 조회 (FMP Bond API)"""
    return await macro_service.get_bond_prices(
        country=country,
        issuer_name=issuer_name,
        isin=isin,
        lei=lei,
        currency=currency,
        coupon_min=coupon_min,
        coupon_max=coupon_max,
        issued_amount_min=issued_amount_min,
        issued_amount_max=issued_amount_max,
        maturity_date_min=maturity_date_min,
        maturity_date_max=maturity_date_max,
        ytm_min=ytm_min,
        ytm_max=ytm_max,
        limit=limit,
    )

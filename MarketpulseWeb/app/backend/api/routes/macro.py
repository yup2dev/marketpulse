"""Macro Economic API Routes — OBBject pattern

가공은 fetcher 가 한다 (fred indicator_overview · indicator_history · macro_series_* · regime · … ,
alphavantage forex_rates · forex). 라우트는 기간(period)을 날짜로 바꿔 넘기고 결과를 감싸기만 한다.
캐시는 QueryExecutor 의 모델별 TTL.
"""
import logging
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Query as FQuery

from data_fetcher.core.obbject import OBBject
from data_fetcher.query_executor import QueryExecutor
from data_fetcher.utils.helpers import parse_period_to_dates
from app.backend.api.deps import wrap_result

log = logging.getLogger(__name__)
router = APIRouter()


async def _fetch(provider: str, model: str, params: Optional[Dict[str, Any]] = None,
                 period: Optional[str] = None) -> OBBject:
    p = {k: v for k, v in (params or {}).items() if v is not None}
    if period:
        p["start_date"], p["end_date"] = parse_period_to_dates(period)
    return wrap_result(await QueryExecutor.fetch(provider, model, p), provider)


# ── Economic Indicators ───────────────────────────────────────────────────────

@router.get("/indicators/overview")
async def get_indicators_overview() -> OBBject:
    return await _fetch("fred", "indicator_overview")


@router.get("/indicators/{indicator_key}/history")
async def get_indicator_history(indicator_key: str, period: str = "5y") -> OBBject:
    return await _fetch("fred", "indicator_history", {"indicator": indicator_key}, period)


# ── FRED Series ───────────────────────────────────────────────────────────────

@router.get("/fred/series")
async def list_fred_series(date: Optional[str] = None) -> OBBject:
    # date = 기준일(As of). 비우면 최신 관측값.
    return await _fetch("fred", "macro_series_overview", {"as_of": date})


@router.get("/fred/series/{series_key}")
async def get_fred_series_data(series_key: str, period: str = "5y") -> OBBject:
    return await _fetch("fred", "macro_series_history", {"series": series_key}, period)


# ── Forex ─────────────────────────────────────────────────────────────────────

@router.get("/forex/rates")
async def get_forex_rates() -> OBBject:
    return await _fetch("alphavantage", "forex_rates")


@router.get("/forex/history")
async def get_forex_history(from_currency: str, to_currency: str, period: str = "1y") -> OBBject:
    start, _ = parse_period_to_dates(period)
    return await _fetch("alphavantage", "forex", {
        "from_currency": from_currency.upper(), "to_currency": to_currency.upper(),
        "interval": "daily", "start_date": start.isoformat(),
    })


# ── Commodities ───────────────────────────────────────────────────────────────
# 금 · 은 시리즈가 FRED 에서 내려가 비율을 계산할 수 없다 — 빈 결과 (화면 호환용으로 주소만 남긴다)

@router.get("/commodities/ratios")
async def get_commodity_ratios() -> OBBject:
    return OBBject(results=[], provider="fred")


@router.get("/commodities/ratios/{ratio_type}")
async def get_ratio_history(ratio_type: str, period: str = "5y") -> OBBject:
    return OBBject(results=[], provider="fred")


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


# ── FRED 모델 그대로 (스냅샷 · 시계열) ─────────────────────────────────────────

@router.get("/regime/current")
async def get_current_regime() -> OBBject:
    return await _fetch("fred", "regime_current")


@router.get("/regime/history")
async def get_regime_history(period: str = "5y") -> OBBject:
    return await _fetch("fred", "regime_history", period=period)


@router.get("/fed-policy/stance")
async def get_fed_policy_stance() -> OBBject:
    return await _fetch("fred", "fed_policy_stance")


@router.get("/yield-curve")
async def get_yield_curve() -> OBBject:
    return await _fetch("fred", "yield_curve")


@router.get("/yield-curve/history")
async def get_yield_curve_history(period: str = "5y") -> OBBject:
    return await _fetch("fred", "yield_curve_history", period=period)


@router.get("/inflation/decomposition")
async def get_inflation_decomposition() -> OBBject:
    return await _fetch("fred", "inflation_decomposition")


@router.get("/inflation/sector-history")
async def get_inflation_sector_history(period: str = "5y") -> OBBject:
    return await _fetch("fred", "inflation_sector", period=period)


@router.get("/labor/dashboard")
async def get_labor_dashboard() -> OBBject:
    return await _fetch("fred", "labor_dashboard")


@router.get("/labor/history")
async def get_labor_history(period: str = "5y") -> OBBject:
    return await _fetch("fred", "phillips_curve", period=period)


@router.get("/financial-conditions")
async def get_financial_conditions() -> OBBject:
    return await _fetch("fred", "financial_conditions")


@router.get("/financial-conditions/history")
async def get_financial_conditions_history(period: str = "5y") -> OBBject:
    return await _fetch("fred", "financial_conditions_history", period=period)


@router.get("/sentiment/composite")
async def get_sentiment_composite() -> OBBject:
    return await _fetch("fred", "sentiment_composite")


@router.get("/sentiment/history")
async def get_sentiment_history(period: str = "5y") -> OBBject:
    return await _fetch("fred", "sentiment_history", period=period)


@router.get("/overview/inflation-momentum")
async def get_inflation_momentum(period: str = "3y") -> OBBject:
    return await _fetch("fred", "inflation_momentum", period=period)


@router.get("/overview/initial-claims")
async def get_initial_claims(period: str = "2y") -> OBBject:
    return await _fetch("fred", "initial_claims", period=period)


@router.get("/overview/jobs-breakdown")
async def get_jobs_breakdown(period: str = "5y") -> OBBject:
    return await _fetch("fred", "jobs_breakdown", period=period)


@router.get("/business-cycle/pmi")
async def get_pmi_data(period: str = "5y") -> OBBject:
    return await _fetch("fred", "pmi", period=period)


@router.get("/fed-balance-sheet")
async def get_fed_balance_sheet(period: str = "10y") -> OBBject:
    return await _fetch("fred", "fed_balance_sheet", period=period)


@router.get("/real-rates")
async def get_real_rates(period: str = "5y") -> OBBject:
    return await _fetch("fred", "real_rates", period=period)


@router.get("/overview/gdp-forecast")
async def get_gdp_forecast(period: str = "1y") -> OBBject:
    return await _fetch("fred", "gdp", {"frequency": "quarterly"}, period)


# ── Economic Calendar ─────────────────────────────────────────────────────────

@router.get("/economic-calendar")
async def get_economic_calendar(
    date: Optional[str] = None,
    country: Optional[str] = None,
) -> OBBject:
    """일자별 경제 이벤트 (Nasdaq 공개 캘린더 API — 라이브 데이터).

    구 버전은 정적 지표 목록을 반환했으나 실제 발표 일정/값으로 교체됨.
    /api/data/nasdaq/economic_calendar 와 동일 데이터 (하위호환용 별칭 라우트).
    """
    return await _fetch("nasdaq", "economic_calendar", {"date": date or None, "country": country or None})


# ── Bonds ─────────────────────────────────────────────────────────────────────

@router.get("/bonds")
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
) -> OBBject:
    return await _fetch("fmp", "bond_prices", {
        "country": country, "issuer_name": issuer_name, "isin": isin, "lei": lei,
        "currency": currency, "coupon_min": coupon_min, "coupon_max": coupon_max,
        "issued_amount_min": issued_amount_min, "issued_amount_max": issued_amount_max,
        "maturity_date_min": maturity_date_min, "maturity_date_max": maturity_date_max,
        "ytm_min": ytm_min, "ytm_max": ytm_max, "limit": limit,
    })

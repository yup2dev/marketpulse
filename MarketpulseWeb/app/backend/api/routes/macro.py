"""Macro Economic API Routes — OBBject pattern

단순 조회(지표 · 시리즈 이력, regime · yield_curve 같은 fred 모델)는 QueryExecutor 를 바로 부른다.
최신값 · 변화율처럼 받은 뒤에 계산하는 것은 command(app/backend/commands/)가 한다 — 라우트는 어느 provider ·
model 을 쓸지 Source 로 넘기고 결과를 감싸기만 한다. 캐시는 출처마다 QueryExecutor 의 모델별 TTL.
"""
import logging
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, Query as FQuery

from data_fetcher.core.obbject import OBBject
from data_fetcher.query_executor import QueryExecutor
from data_fetcher.utils.helpers import parse_period_to_dates
from app.backend.api.deps import route_handler, wrap_result
from app.backend.commands import fx as fx_cmd, macro as macro_cmd
from app.backend.commands._base import Source, fetch_rows
from app.backend.constants.macro_catalog import FX_PAIRS, INDICATORS, MACRO_SERIES

log = logging.getLogger(__name__)
router = APIRouter()


async def _fetch(provider: str, model: str, params: Optional[Dict[str, Any]] = None,
                 period: Optional[str] = None) -> OBBject:
    p = {k: v for k, v in (params or {}).items() if v is not None}
    if period:
        p["start_date"], p["end_date"] = parse_period_to_dates(period)
    return wrap_result(await QueryExecutor.fetch(provider, model, p), provider)


def _dated_values(rows: List[Dict[str, Any]], digits: Optional[int] = None) -> List[Dict[str, Any]]:
    """행 → {date, value} (화면이 쓰는 두 칸만)."""
    return [{"date": r["date"], "value": round(r["value"], digits) if digits is not None else r["value"]}
            for r in rows if r.get("date") and (digits is None or r.get("value") is not None)]


# ── Economic Indicators ───────────────────────────────────────────────────────

@router.get("/indicators/overview")
@route_handler
async def get_indicators_overview() -> OBBject:
    # 지표 6개를 병렬로 (fred 는 서버에서 사용자 키로 직접 호출 — Fetcher 위임 아님)
    specs = [macro_cmd.IndicatorSpec(key, Source("fred", model, params), unit)
             for key, (model, _name, unit, params) in INDICATORS.items()]
    return wrap_result(await macro_cmd.indicator_overview(specs), "fred")


@router.get("/indicators/{indicator_key}/history")
@route_handler
async def get_indicator_history(indicator_key: str, period: str = "5y") -> OBBject:
    if indicator_key not in INDICATORS:
        raise HTTPException(status_code=400, detail=f"Invalid indicator. Valid: {', '.join(INDICATORS)}")
    model, _name, _unit, params = INDICATORS[indicator_key]
    start, end = parse_period_to_dates(period)
    rows = await fetch_rows(Source("fred", model, {**params, "start_date": start, "end_date": end}))
    return OBBject(results=_dated_values(rows, digits=2), provider="fred")


# ── FRED Series ───────────────────────────────────────────────────────────────

@router.get("/fred/series")
@route_handler
async def list_fred_series(date: Optional[str] = None) -> OBBject:
    # date = 기준일(As of). 비우면 최신 관측값. 시리즈 전부를 한 요청으로, 시리즈마다 최근 관측 2개.
    catalog = [macro_cmd.SeriesSpec(key, sid, name, category, unit)
               for key, (sid, name, category, unit) in MACRO_SERIES.items()]
    source = Source("fred", "series", {"series_id": ",".join(s.series_id for s in catalog),
                                       "limit": 2, "sort_order": "desc"}).with_params(end_date=date)
    return wrap_result(await macro_cmd.series_overview(source, catalog), "fred")


@router.get("/fred/series/{series_key}")
@route_handler
async def get_fred_series_data(series_key: str, period: str = "5y") -> OBBject:
    if series_key not in MACRO_SERIES:
        raise HTTPException(status_code=400, detail=f"Invalid series. Valid: {', '.join(MACRO_SERIES)}")
    start, end = parse_period_to_dates(period)
    rows = await fetch_rows(Source("fred", "series", {
        "series_id": MACRO_SERIES[series_key][0], "sort_order": "asc", "start_date": start, "end_date": end,
    }))
    return OBBject(results=_dated_values(rows), provider="fred")


# ── Forex ─────────────────────────────────────────────────────────────────────

@router.get("/forex/rates")
@route_handler
async def get_forex_rates() -> OBBject:
    # 쌍 5개를 병렬로 (alphavantage 는 서버에서 사용자 키로 직접 호출). 쌍마다 forex TTL 캐시
    pairs = [fx_cmd.PairSpec(f"{base}/{quote}", name, Source("alphavantage", "forex", {
                 "from_currency": base, "to_currency": quote, "interval": "daily"}))
             for base, quote, name in FX_PAIRS]
    return wrap_result(await fx_cmd.latest_rates(pairs), "alphavantage")


@router.get("/forex/history")
@route_handler
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
@route_handler
async def get_current_regime() -> OBBject:
    return await _fetch("fred", "regime_current")


@router.get("/regime/history")
@route_handler
async def get_regime_history(period: str = "5y") -> OBBject:
    return await _fetch("fred", "regime_history", period=period)


@router.get("/fed-policy/stance")
@route_handler
async def get_fed_policy_stance() -> OBBject:
    return await _fetch("fred", "fed_policy_stance")


@router.get("/yield-curve")
@route_handler
async def get_yield_curve() -> OBBject:
    return await _fetch("fred", "yield_curve")


@router.get("/yield-curve/history")
@route_handler
async def get_yield_curve_history(period: str = "5y") -> OBBject:
    return await _fetch("fred", "yield_curve_history", period=period)


@router.get("/inflation/decomposition")
@route_handler
async def get_inflation_decomposition() -> OBBject:
    return await _fetch("fred", "inflation_decomposition")


@router.get("/inflation/sector-history")
@route_handler
async def get_inflation_sector_history(period: str = "5y") -> OBBject:
    return await _fetch("fred", "inflation_sector", period=period)


@router.get("/labor/dashboard")
@route_handler
async def get_labor_dashboard() -> OBBject:
    return await _fetch("fred", "labor_dashboard")


@router.get("/labor/history")
@route_handler
async def get_labor_history(period: str = "5y") -> OBBject:
    return await _fetch("fred", "phillips_curve", period=period)


@router.get("/financial-conditions")
@route_handler
async def get_financial_conditions() -> OBBject:
    return await _fetch("fred", "financial_conditions")


@router.get("/financial-conditions/history")
@route_handler
async def get_financial_conditions_history(period: str = "5y") -> OBBject:
    return await _fetch("fred", "financial_conditions_history", period=period)


@router.get("/sentiment/composite")
@route_handler
async def get_sentiment_composite() -> OBBject:
    return await _fetch("fred", "sentiment_composite")


@router.get("/sentiment/history")
@route_handler
async def get_sentiment_history(period: str = "5y") -> OBBject:
    return await _fetch("fred", "sentiment_history", period=period)


@router.get("/overview/inflation-momentum")
@route_handler
async def get_inflation_momentum(period: str = "3y") -> OBBject:
    return await _fetch("fred", "inflation_momentum", period=period)


@router.get("/overview/initial-claims")
@route_handler
async def get_initial_claims(period: str = "2y") -> OBBject:
    return await _fetch("fred", "initial_claims", period=period)


@router.get("/overview/jobs-breakdown")
@route_handler
async def get_jobs_breakdown(period: str = "5y") -> OBBject:
    return await _fetch("fred", "jobs_breakdown", period=period)


@router.get("/business-cycle/pmi")
@route_handler
async def get_pmi_data(period: str = "5y") -> OBBject:
    return await _fetch("fred", "pmi", period=period)


@router.get("/fed-balance-sheet")
@route_handler
async def get_fed_balance_sheet(period: str = "10y") -> OBBject:
    return await _fetch("fred", "fed_balance_sheet", period=period)


@router.get("/real-rates")
@route_handler
async def get_real_rates(period: str = "5y") -> OBBject:
    return await _fetch("fred", "real_rates", period=period)


@router.get("/overview/gdp-forecast")
@route_handler
async def get_gdp_forecast(period: str = "1y") -> OBBject:
    return await _fetch("fred", "gdp", {"frequency": "quarterly"}, period)


# ── Economic Calendar ─────────────────────────────────────────────────────────

@router.get("/economic-calendar")
@route_handler
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
) -> OBBject:
    return await _fetch("fmp", "bond_prices", {
        "country": country, "issuer_name": issuer_name, "isin": isin, "lei": lei,
        "currency": currency, "coupon_min": coupon_min, "coupon_max": coupon_max,
        "issued_amount_min": issued_amount_min, "issued_amount_max": issued_amount_max,
        "maturity_date_min": maturity_date_min, "maturity_date_max": maturity_date_max,
        "ytm_min": ytm_min, "ytm_max": ytm_max, "limit": limit,
    })

"""Stock API Routes — OBBject pattern"""
import logging
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, Query as FQuery

from data_fetcher.core.obbject import OBBject
from data_fetcher.abstract_provider.abstract.fetcher import AnnotatedResult
from data_fetcher.query_executor import QueryExecutor
from app.backend.api.deps import route_handler, wrap_result

log = logging.getLogger(__name__)
router = APIRouter()


# ── Helpers ───────────────────────────────────────────────────────────────────

def _unwrap(raw: Any) -> List[Any]:
    return raw.result if isinstance(raw, AnnotatedResult) else (raw or [])


def _serialize(items: List[Any]) -> List[Dict]:
    return [
        item.model_dump(mode="json") if hasattr(item, "model_dump") else item
        for item in items
    ]


_wrap = wrap_result


def _wrap_one(data: Any, provider: str) -> OBBject:
    """단일 객체(스냅샷)를 1행 OBBject로 감싼다."""
    return wrap_result(data, provider)


# ── Direct QueryExecutor → OBBject ────────────────────────────────────────────

@router.get("/info/{symbol}")
@route_handler
async def get_company_info(symbol: str, provider: str = "yahoo") -> OBBject:
    raw = await QueryExecutor.fetch(provider, "company_info", {"symbol": symbol.upper()})
    return _wrap(raw, provider)


@router.get("/metrics/{symbol}")
@route_handler
async def get_key_metrics(symbol: str, provider: str = "yahoo") -> OBBject:
    raw = await QueryExecutor.fetch(provider, "key_metrics", {"symbol": symbol.upper()})
    return _wrap(raw, provider)


@router.get("/financials/{symbol}")
@route_handler
async def get_financials(
    symbol: str,
    provider: str = "yahoo",
    freq: str = "quarterly",
    limit: int = 4,
) -> OBBject:
    raw = await QueryExecutor.fetch(provider, "financials", {"symbol": symbol.upper(), "freq": freq})
    items = _unwrap(raw)[:limit]
    return OBBject(results=_serialize(items), provider=provider)


@router.get("/earnings/{symbol}")
@route_handler
async def get_earnings(symbol: str, provider: str = "polygon", limit: int = 8) -> OBBject:
    raw = await QueryExecutor.fetch(provider, "earnings", {"symbol": symbol.upper(), "limit": limit})
    return _wrap(raw, provider)


@router.get("/insider-trading/{symbol}")
@route_handler
async def get_insider_trading(symbol: str, provider: str = "yahoo", limit: int = 50) -> OBBject:
    raw = await QueryExecutor.fetch(
        provider, "insider_trading_summary", {"symbol": symbol.upper(), "limit": limit}
    )
    return _wrap(raw, provider)


@router.get("/insider-holders/{symbol}")
@route_handler
async def get_insider_holders(symbol: str, provider: str = "yahoo") -> OBBject:
    raw = await QueryExecutor.fetch(provider, "insider_holders", {"symbol": symbol.upper()})
    return _wrap(raw, provider)


@router.get("/analyst/{symbol}")
@route_handler
async def get_analyst_data(symbol: str, provider: str = "fmp") -> OBBject:
    raw = await QueryExecutor.fetch(provider, "analyst_data", {"symbol": symbol.upper()})
    return _wrap(raw, provider)


@router.get("/holders/{symbol}")
@route_handler
async def get_holders(symbol: str, provider: str = "yahoo") -> OBBject:
    raw = await QueryExecutor.fetch(provider, "holders", {"symbol": symbol.upper()})
    return _wrap(raw, provider)


@router.get("/calendar/{symbol}")
@route_handler
async def get_calendar(
    symbol: str,
    provider: str = "yahoo",
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
) -> OBBject:
    params: Dict[str, Any] = {"symbol": symbol.upper()}
    if start_date:
        params["start_date"] = start_date
    if end_date:
        params["end_date"] = end_date
    raw = await QueryExecutor.fetch(provider, "calendar", params)
    return _wrap(raw, provider)


@router.get("/dividends/{symbol}")
@route_handler
async def get_dividends(symbol: str, provider: str = "yahoo", limit: int = 20) -> OBBject:
    raw = await QueryExecutor.fetch(provider, "dividends", {"symbol": symbol.upper()})
    items = _unwrap(raw)[:limit]
    return OBBject(results=_serialize(items), provider=provider)


@router.get("/splits/{symbol}")
@route_handler
async def get_splits(symbol: str, provider: str = "yahoo", limit: int = 20) -> OBBject:
    raw = await QueryExecutor.fetch(provider, "splits", {"symbol": symbol.upper()})
    items = _unwrap(raw)[:limit]
    return OBBject(results=_serialize(items), provider=provider)


@router.get("/filings/{symbol}")
@route_handler
async def get_filings(symbol: str, provider: str = "yahoo", limit: int = 20) -> OBBject:
    raw = await QueryExecutor.fetch(provider, "filings", {"symbol": symbol.upper()})
    items = _unwrap(raw)[:limit]
    return OBBject(results=_serialize(items), provider=provider)


@router.get("/quarterly-pnl/{symbol}")
@route_handler
async def get_quarterly_pnl(symbol: str, provider: str = "yahoo", limit: int = 12) -> OBBject:
    raw = await QueryExecutor.fetch(
        provider, "quarterly_pnl", {"symbol": symbol.upper(), "limit": limit}
    )
    return _wrap(raw, provider)


@router.get("/revenue-segments/{symbol}")
@route_handler
async def get_revenue_segments(symbol: str, provider: str = "fmp", limit: int = 8) -> OBBject:
    raw = await QueryExecutor.fetch(
        provider, "revenue_segments", {"symbol": symbol.upper(), "limit": limit}
    )
    return _wrap(raw, provider)


@router.get("/estimates/{symbol}")
@route_handler
async def get_estimates(symbol: str, provider: str = "yahoo") -> OBBject:
    raw = await QueryExecutor.fetch(provider, "estimates", {"symbol": symbol.upper()})
    return _wrap(raw, provider)


@router.get("/management/{symbol}")
@route_handler
async def get_management(symbol: str, provider: str = "yahoo") -> OBBject:
    raw = await QueryExecutor.fetch(provider, "management", {"symbol": symbol.upper()})
    return _wrap(raw, provider)


@router.get("/moat/{symbol}")
@route_handler
async def get_moat_analysis(symbol: str, provider: str = "yahoo") -> OBBject:
    raw = await QueryExecutor.fetch(provider, "moat", {"symbol": symbol.upper()})
    return _wrap(raw, provider)


@router.get("/swot/{symbol}")
@route_handler
async def get_swot(symbol: str, provider: str = "yahoo") -> OBBject:
    raw = await QueryExecutor.fetch(provider, "swot", {"symbol": symbol.upper()})
    return _wrap(raw, provider)


@router.get("/sentiment/{symbol}")
@route_handler
async def get_stock_sentiment(symbol: str, provider: str = "polygon") -> OBBject:
    raw = await QueryExecutor.fetch(provider, "sentiment", {"ticker": symbol.upper()})
    return _wrap(raw, provider)


@router.get("/reddit/{symbol}")
@route_handler
async def get_social_sentiment(symbol: str, provider: str = "social") -> OBBject:
    raw = await QueryExecutor.fetch(provider, "sentiment", {"symbol": symbol.upper()})
    return _wrap(raw, provider)


@router.get("/scorecard/{symbol}")
@route_handler
async def get_scorecard(symbol: str, provider: str = "yahoo") -> OBBject:
    raw = await QueryExecutor.fetch(provider, "scorecard", {"symbol": symbol.upper()})
    return _wrap(raw, provider)


@router.get("/quote/{symbol}")
@route_handler
async def get_stock_quote(symbol: str, provider: str = "yahoo") -> OBBject:
    raw = await QueryExecutor.fetch(provider, "quote", {"symbol": symbol.upper()})
    items = _unwrap(raw)
    if not items:
        raise HTTPException(status_code=404, detail=f"Stock {symbol} not found")
    return _wrap(raw, provider)


@router.get("/history/{symbol}")
@route_handler
async def get_stock_history(
    symbol: str,
    provider: str = "yahoo",
    period: Optional[str] = None,
    interval: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
) -> OBBject:
    params: Dict[str, Any] = {"symbol": symbol.upper()}
    if start_date and end_date:
        params["start_date"] = start_date
        params["end_date"]   = end_date
        params["interval"]   = interval or "1d"
    else:
        params["period"]   = period or "1mo"
        if interval:
            params["interval"] = interval
    raw = await QueryExecutor.fetch(provider, "stock_price", params)
    if not _unwrap(raw):
        raise HTTPException(status_code=404, detail=f"No history for {symbol}")
    return _wrap(raw, provider)


@router.get("/orderbook/{symbol}")
@route_handler
async def get_stock_orderbook(symbol: str, provider: str = "polygon") -> OBBject:
    from data_fetcher.providers.polygon.orderbook import fetch_stock_orderbook
    data = await fetch_stock_orderbook(symbol.upper())
    return _wrap_one(data, provider)


@router.get("/search")
@route_handler
async def search_stocks(
    query: str = "",
    limit: int = 12,
) -> OBBject:
    """종목 자동완성 — DB 유니버스(KR+US 전체) 기반 인메모리 검색. 외부 API 호출 없음."""
    from app.backend.services.symbol_cache import get_symbol_cache

    cache = get_symbol_cache()
    await cache.ensure_loaded()
    hits = cache.search(query.upper(), limit=limit)
    return OBBject(results=hits, provider="db")


@router.get("/relations/{symbol}")
@route_handler
async def get_company_relations_route(symbol: str, provider: str = "db") -> OBBject:
    from app.backend.services.company_relations import get_company_relations
    data = await get_company_relations(symbol.upper())
    return _wrap_one(data, provider)


@router.get("/sector-performance")
@route_handler
async def get_sector_performance(provider: str = "db") -> OBBject:
    from app.backend.core.db import get_db_sync
    from index_analyzer.models.orm import MBS_IN_STK_PROFILE

    db = get_db_sync()
    try:
        base_q = db.query(MBS_IN_STK_PROFILE).filter(MBS_IN_STK_PROFILE.sector.isnot(None))
        sp500 = base_q.filter(MBS_IN_STK_PROFILE.in_sp500 == True).all()
        profiles = sp500 if len(sp500) >= 50 else base_q.all()

        sector_map: Dict[str, Any] = {}
        for p in profiles:
            s = p.sector or "Other"
            if s not in sector_map:
                sector_map[s] = {"sector": s, "stocks": [], "total_market_cap": 0}
            mcap = float(p.market_cap) if p.market_cap else 0
            sector_map[s]["stocks"].append({
                "symbol": p.stk_cd,
                "name": p.stk_nm,
                "sector": s,
                "industry": p.industry,
                "market_cap": mcap,
                "price": float(p.price) if p.price else None,
            })
            sector_map[s]["total_market_cap"] += mcap

        sectors = sorted(sector_map.values(), key=lambda x: x["total_market_cap"], reverse=True)
        for sec in sectors:
            sec["count"] = len(sec["stocks"])
            sec["stocks"] = sorted(sec["stocks"], key=lambda x: x["market_cap"], reverse=True)[:50]

        return OBBject(results=sectors, provider=provider)
    finally:
        db.close()


@router.get("/compare")
@route_handler
async def compare_stocks(
    symbols: str = FQuery(..., description="Comma-separated symbols (2-4)"),
    provider: str = "yahoo",
) -> OBBject:
    tickers = [s.strip().upper() for s in symbols.split(",") if s.strip()]
    if len(tickers) < 2:
        raise ValueError("At least 2 symbols required")
    if len(tickers) > 4:
        raise ValueError("Maximum 4 symbols allowed")

    results = []
    for sym in tickers:
        try:
            quote_raw   = await QueryExecutor.fetch("yahoo", "quote",       {"symbol": sym})
            metrics_raw = await QueryExecutor.fetch("yahoo", "key_metrics", {"symbol": sym})
            q = _unwrap(quote_raw)
            q = q[0].model_dump(mode="json") if q and hasattr(q[0], "model_dump") else (q[0] if q else {})
            metrics_items = _unwrap(metrics_raw)
            m = metrics_items[0].model_dump(mode="json") if metrics_items and hasattr(metrics_items[0], "model_dump") else (metrics_items[0] if metrics_items else {})
            results.append({
                "symbol": sym,
                "name": m.get("symbol", sym),
                "price": q.get("price"),
                "change": q.get("change"),
                "changesPercentage": q.get("change_percent"),
                "marketCap": m.get("market_cap"),
                "volume": q.get("volume"),
                "pe": m.get("pe_ratio"),
                "eps": m.get("eps_trailing"),
                "beta": m.get("beta"),
                "dividend_yield": m.get("dividend_yield"),
                "roe": m.get("roe"),
                "roa": m.get("roa"),
                "debt_to_equity": m.get("debt_to_equity"),
                "profit_margin": m.get("net_margin"),
                "revenue_growth": m.get("revenue_growth"),
                "52w_high": m.get("week_52_high"),
                "52w_low": m.get("week_52_low"),
            })
        except Exception:
            results.append({"symbol": sym, "error": "Failed to fetch data"})

    return OBBject(results=results, provider=provider)


_INDICATOR_MAP: Dict[str, tuple] = {
    "GDP":                   ("gdp",                  {}),
    "UNEMPLOYMENT":          ("unemployment",          {}),
    "CPI":                   ("cpi",                  {}),
    "FED_FUNDS_RATE":        ("interest_rate",         {"rate_type": "federal_funds"}),
    "INTEREST_RATE":         ("interest_rate",         {"rate_type": "federal_funds"}),
    "RETAIL_SALES":          ("retail_sales",          {}),
    "CONSUMER_SENTIMENT":    ("consumer_sentiment",    {}),
    "NONFARM_PAYROLL":       ("nonfarm_payroll",       {}),
    "HOUSING_STARTS":        ("housing_starts",        {}),
    "INDUSTRIAL_PRODUCTION": ("industrial_production", {}),
}


@router.get("/indicator/{indicator}")
@route_handler
async def get_indicator_history(
    indicator: str,
    period: str = "5y",
    provider: str = "fred",
) -> OBBject:
    from data_fetcher.utils.helpers import parse_period_to_dates

    key = indicator.upper()
    entry = _INDICATOR_MAP.get(key)
    if not entry:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid indicator. Valid: {', '.join(_INDICATOR_MAP)}",
        )
    model, base_params = entry
    start_date, end_date = parse_period_to_dates(period)
    raw = await QueryExecutor.fetch("fred", model, {**base_params, "start_date": start_date, "end_date": end_date})
    if not _unwrap(raw):
        raise HTTPException(status_code=404, detail=f"No data for {indicator}")
    return _wrap(raw, provider)


@router.get("/ranking/live")
async def get_live_stock_ranking(
    market: str = FQuery("all", description="all | domestic | overseas"),
    sort_by: str = FQuery("gainers", description="gainers | losers | volume | trade_value"),
    limit: int = FQuery(50, ge=1, le=200),
    provider: str = "yahoo",
) -> OBBject:
    from app.backend.services.ranking_service import RankingService
    results = await RankingService.get_live_ranking(market=market, sort_by=sort_by, limit=limit)
    return OBBject(results=results, provider=provider)


@router.get("/ranking")
async def get_stock_ranking(
    market: str = FQuery("all", description="all | domestic | overseas"),
    sort_by: str = FQuery("gainers", description="gainers | losers | volume | trade_value"),
    period: str = FQuery("1d", description="realtime | 1d | 1w | 1mo | 3mo | 6mo | 1y"),
    limit: int = FQuery(50, ge=1, le=200),
    provider: str = "yahoo",
) -> OBBject:
    from app.backend.services.ranking_service import RankingService
    results = await RankingService.get_ranking(
        market=market, sort_by=sort_by, period=period, limit=limit
    )
    return OBBject(results=results, provider=provider)

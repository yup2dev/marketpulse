"""Stock API Routes — OBBject pattern"""
import logging
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query as FQuery
from fastapi.responses import JSONResponse

from data_fetcher.core.obbject import OBBject
from data_fetcher.query_executor import QueryExecutor
from app.backend.api.deps import filter_dated_rows, resolve_date_range, route_handler, wrap_result
from app.backend.core.auth.dependencies import get_current_active_user
from app.backend.models.orm import User

log = logging.getLogger(__name__)
router = APIRouter()


# ── Helpers ───────────────────────────────────────────────────────────────────

def _unwrap(raw: Any) -> List[Any]:
    return OBBject.unwrap(raw) or []


_wrap = wrap_result


def _wrap_one(data: Any, provider: str) -> OBBject:
    """단일 객체(스냅샷)를 1행 OBBject로 감싼다."""
    return wrap_result(data, provider)


def _dated_events(
    raw: Any, provider: str, start: Optional[str], end: Optional[str],
    limit: Optional[int], default_limit: int, key: Optional[str] = None,
) -> OBBject:
    """이벤트 목록(배당·분할·공시·내부자 거래) 공통 마무리: 기간 필터 → 최신순 → 건수 제한.

    기간을 주면 기간이 범위를 정하므로 limit 은 명시했을 때만 자른다
    (10Y 배당 40건이 기본 20건에 잘리지 않게). 기간이 없으면 예전처럼 default_limit.
    """
    obb = wrap_result(raw, provider)
    rows = filter_dated_rows(obb.results, start, end, key=key)
    cap = limit if limit is not None else (None if (start or end) else default_limit)
    obb.results = rows[:cap] if cap else rows
    return obb


def _range_params(params: Dict[str, Any], start: Optional[str], end: Optional[str]) -> Dict[str, Any]:
    """fetcher QP 가 start_date/end_date 를 선언한 모델(dividends·insider_trading)에 범위를 넘긴다."""
    if start:
        params["start_date"] = start
    if end:
        params["end_date"] = end
    return params


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
    limit: Optional[int] = None,
    period: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
) -> OBBject:
    # period = 조회 기간(1y·5y…). 보고 주기(annual/quarterly)는 freq — 이름이 겹쳐 헷갈리지 않게 분리.
    start, end = resolve_date_range(period, start_date, end_date)
    raw = await QueryExecutor.fetch(provider, "financials", {"symbol": symbol.upper(), "freq": freq})
    return _dated_events(raw, provider, start, end, limit, 4)


@router.get("/earnings/{symbol}")
@route_handler
async def get_earnings(
    symbol: str,
    provider: str = "polygon",
    limit: Optional[int] = None,
    period: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
) -> OBBject:
    start, end = resolve_date_range(period, start_date, end_date)
    # 기간 조회면 분기 실적을 넉넉히(최대 40분기 = 10년) 받아 기간으로 자른다
    fetch_limit = limit or (40 if (start or end) else 8)
    raw = await QueryExecutor.fetch(provider, "earnings", {"symbol": symbol.upper(), "limit": fetch_limit})
    return _dated_events(raw, provider, start, end, limit, 8)


@router.get("/insider-trading/{symbol}")
@route_handler
async def get_insider_trading(
    symbol: str,
    provider: str = "yahoo",
    limit: Optional[int] = None,
    period: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
) -> OBBject:
    # insider_trading: yahoo·polygon·sec 멀티프로바이더(표준 InsiderTradingData 공유).
    # 과거 yahoo 전용 insider_trading_summary 대신 공용 키로 디스패치해 provider 셀렉터를 지원.
    # 프론트는 셀렉터로 ?provider= 를 주입(기본값은 db>설정키>저부하 규칙). 라우트 기본값은 형제 라우트와 동일하게 yahoo.
    # 기간은 거래일 기준(공시일은 거래 후 며칠 뒤라 기간 경계에서 어긋난다).
    start, end = resolve_date_range(period, start_date, end_date)
    # 기간 조회면 fetcher 쪽 건수를 넉넉히 받아 기간으로 자른다
    fetch_limit = limit or (200 if (start or end) else 50)
    params = _range_params({"symbol": symbol.upper(), "limit": fetch_limit}, start, end)
    raw = await QueryExecutor.fetch(provider, "insider_trading", params)
    return _dated_events(raw, provider, start, end, limit, 50, key="transaction_date")


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
async def get_dividends(
    symbol: str,
    provider: str = "yahoo",
    limit: Optional[int] = None,
    period: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
) -> OBBject:
    start, end = resolve_date_range(period, start_date, end_date)
    raw = await QueryExecutor.fetch(provider, "dividends", _range_params({"symbol": symbol.upper()}, start, end))
    return _dated_events(raw, provider, start, end, limit, 20)


@router.get("/splits/{symbol}")
@route_handler
async def get_splits(
    symbol: str,
    provider: str = "yahoo",
    limit: Optional[int] = None,
    period: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
) -> OBBject:
    start, end = resolve_date_range(period, start_date, end_date)
    raw = await QueryExecutor.fetch(provider, "splits", {"symbol": symbol.upper()})
    return _dated_events(raw, provider, start, end, limit, 20)


@router.get("/filings/{symbol}")
@route_handler
async def get_filings(
    symbol: str,
    provider: str = "yahoo",
    limit: Optional[int] = None,
    period: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
) -> OBBject:
    start, end = resolve_date_range(period, start_date, end_date)
    raw = await QueryExecutor.fetch(provider, "filings", {"symbol": symbol.upper()})
    return _dated_events(raw, provider, start, end, limit, 20)


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
    raw = await QueryExecutor.fetch(provider, "sentiment", {"symbol": symbol.upper()})
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
    raw = await QueryExecutor.fetch(provider, "orderbook", {"symbol": symbol.upper()})
    return _wrap(raw, provider)


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
    """섹터별 묶음 — db provider sector_performance (종목 프로필을 섹터로)."""
    raw = await QueryExecutor.fetch("db", "sector_performance", {})
    return OBBject.from_result(raw, provider)


@router.get("/compare")
@route_handler
async def compare_stocks(
    symbols: str = FQuery(..., description="Comma-separated symbols (2-4)"),
) -> OBBject:
    """종목 2~4개 비교 — yahoo compare (시세 + 주요 지표)."""
    raw = await QueryExecutor.fetch("yahoo", "compare", {"symbols": symbols})
    return _wrap(raw, "yahoo")


# 지표 키 → fred 모델 (+ 고정 파라미터)
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
    # 섹터별 수지: 연방 재정수지 %GDP (연간, 적자는 음수)
    "FISCAL_BALANCE":        ("series",                {"series_id": "FYFSGDA188S"}),
    # 세후 기업이익 %GDP — 재정수지 %GDP 와 같은 축
    "CORP_PROFITS_GDP":      ("corporate_profits_gdp", {}),
}


@router.get("/indicator/{indicator}")
@route_handler
async def get_indicator_history(indicator: str, period: str = "5y") -> OBBject:
    from data_fetcher.utils.helpers import parse_period_to_dates

    entry = _INDICATOR_MAP.get(indicator.upper())
    if not entry:
        raise HTTPException(status_code=400, detail=f"Invalid indicator. Valid: {', '.join(_INDICATOR_MAP)}")
    model, base_params = entry
    start_date, end_date = parse_period_to_dates(period)
    raw = await QueryExecutor.fetch("fred", model, {**base_params, "start_date": start_date, "end_date": end_date})
    if not _unwrap(raw):
        raise HTTPException(status_code=404, detail=f"No data for {indicator}")
    return _wrap(raw, "fred")


@router.get("/ranking/live")
async def get_live_stock_ranking(
    market: str = FQuery("all", description="all | domestic | overseas"),
    sort_by: str = FQuery("gainers", description="gainers | losers | volume | trade_value"),
    limit: int = FQuery(50, ge=1, le=200),
    provider: Optional[str] = FQuery(None, description="yahoo | kis | db — 비우면 자동"),
    user: User = Depends(get_current_active_user),
):
    """실시간 랭킹. provider 를 고르면 그 소스 하나로만 조회한다 (폴백 없음).

    응답 metadata.candidates = 고를 수 있는 소스와 내 사용 가능 여부(키) — 위젯의 데이터 소스 선택지.
    실패 응답에도 candidates 를 실어 위젯이 다른 소스로 바꿀 수 있게 한다.
    """
    from app.backend.services import user_key_service
    from app.backend.services.ranking_service import (
        LIVE_RANKING_PROVIDERS, LiveRankingError, RankingService,
    )

    is_available = user_key_service.availability(str(user.user_id))
    candidates = [{"provider": p, "available": is_available(p)} for p in LIVE_RANKING_PROVIDERS]
    provider = provider or None
    if provider and provider not in LIVE_RANKING_PROVIDERS:
        return JSONResponse(status_code=400, content={
            "detail": f"'{provider}' 는 실시간 랭킹을 제공하지 않습니다", "candidates": candidates,
        })
    if provider and not is_available(provider):
        return JSONResponse(status_code=424, content={
            "detail": f"{provider.upper()} API 키가 필요합니다", "code": "missing_key",
            "provider": provider, "candidates": candidates,
        })
    try:
        # provider = 실제로 답한 소스 — 위젯 출처 표기에 쓰인다
        results, source = await RankingService.get_live_ranking(
            market=market, sort_by=sort_by, limit=limit, provider=provider,
        )
    except LiveRankingError as e:
        return JSONResponse(status_code=502, content={
            "detail": str(e), "provider": e.provider, "candidates": candidates,
        })
    return OBBject(results=results, provider=source, metadata={"candidates": candidates})


@router.get("/ranking")
async def get_stock_ranking(
    market: str = FQuery("all", description="all | domestic | overseas"),
    sort_by: str = FQuery("gainers", description="gainers | losers | volume | trade_value"),
    period: str = FQuery("1d", description="realtime | 1d | 1w | 1mo | 3mo | 6mo | 1y"),
    limit: int = FQuery(50, ge=1, le=200),
) -> OBBject:
    from app.backend.services.ranking_service import RankingService
    results, source = await RankingService.get_ranking(
        market=market, sort_by=sort_by, period=period, limit=limit
    )
    return OBBject(results=results, provider=source)

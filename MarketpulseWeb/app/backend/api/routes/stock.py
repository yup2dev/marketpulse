"""Stock API (/api/stock) — 가공 command + DB · 캐시 · 실시간 라우트.

단순 조회(시세 · 이력 · 배당 · 재무제표 · 공시 …)는 여기 두지 않는다 — 게이트웨이 /api/data/{provider}/{model} 로.
  - commands : @router.command(inputs=...) — inputs 를 CommandRunner 가 조회하고 commands/ 순수 함수가 가공
  - extra    : provider 조회가 아닌 것 (심볼 검색 캐시 · 기업 관계 서비스 · 랭킹 WS/Redis)
"""
import logging
from typing import Dict, Optional

from fastapi import APIRouter, Depends, HTTPException, Query as FQuery
from fastapi.responses import JSONResponse

from data_fetcher.core import Fetch, OBBject, Router
from data_fetcher.utils.helpers import parse_period_to_dates
from app.backend.api.deps import route_handler
from app.backend.commands import (
    fundamentals, macro, news_sentiment, sentiment, stock as stock_cmd,
)
from app.backend.core.auth.dependencies import get_current_active_user
from app.backend.models.orm import User

log = logging.getLogger(__name__)
router = Router(prefix="", tags=["stock"], description="Stock analysis commands.")
extra = APIRouter()


# ══ 가공 command ═══════════════════════════════════════════════════════════════

# ── 재무 분석 — 해자 · 분기 손익 · 스코어카드 · SWOT · 세그먼트 ─────────────────────

@router.command(path="/moat/{symbol}", inputs=lambda symbol, provider="yahoo": {
    "rows": Fetch(provider, "financials", {"symbol": symbol.upper(), "period": "annual"}, required=True)})
def moat(data, symbol: str):
    """경제적 해자 — 연간 재무제표로 연도별 수익성 · ROE 15% 이상인 해 수로 판정."""
    return [fundamentals.moat_from_rows(symbol.upper(), data["rows"])]


@router.command(path="/quarterly-pnl/{symbol}", inputs=lambda symbol, provider="yahoo": {
    "rows": Fetch(provider, "financials", {"symbol": symbol.upper(), "period": "quarterly"}, required=True)})
def quarterly_pnl(data, symbol: str, limit: int = 12):
    """분기 손익 + 이익률 · 전년 동기 대비 매출."""
    return [fundamentals.quarterly_pnl_from_rows(symbol.upper(), data["rows"], limit)]


def _metrics(symbol: str, provider: str = "yahoo"):
    return {"m": Fetch(provider, "key_metrics", {"symbol": symbol.upper()}, required=True)}


@router.command(path="/scorecard/{symbol}", inputs=_metrics)
def scorecard(data, symbol: str):
    """투자 스코어카드 — 주요 지표로 범주별 점수 · 등급."""
    return [fundamentals.scorecard_from_metrics(symbol.upper(), (data["m"] or [{}])[0])]


@router.command(path="/swot/{symbol}", inputs=_metrics)
def swot(data, symbol: str):
    """SWOT — 주요 지표를 문턱값으로 강점 · 약점 · 기회 · 위협에."""
    return [fundamentals.swot_from_metrics(symbol.upper(), (data["m"] or [{}])[0])]


@router.command(path="/revenue-segments/{symbol}", inputs=lambda symbol, provider="fmp", limit=8: {
    "rows": Fetch(provider, "revenue_segments", {"symbol": symbol.upper(), "limit": limit}, required=True)})
def revenue_segments(data):
    """제품 · 지역별 매출 + 세그먼트별 전년 대비."""
    return [fundamentals.add_segment_yoy(r) for r in data["rows"]]


# ── 감성 ──────────────────────────────────────────────────────────────────────

@router.command(path="/sentiment/{symbol}", inputs=lambda symbol, provider="polygon": {
    "news": Fetch(provider, "news", {"symbol": symbol.upper(), "limit": news_sentiment.MAX_ARTICLES}, required=True)})
def news_sentiment_cmd(data, symbol: str):
    """종목 뉴스 제목 키워드 감성 + 날짜별 추이."""
    return [news_sentiment.news_sentiment_from(symbol.upper(), data["news"])]


@router.command(path="/reddit/{symbol}", inputs=lambda symbol, provider="social": {
    "rows": Fetch(provider, "sentiment", {"symbol": symbol.upper()}, required=True)})
def social_sentiment(data):
    """StockTwits · Reddit — 글 분류 · 강세/약세 비율."""
    return [sentiment.score_social(r) for r in data["rows"]]


# ── 비교 ──────────────────────────────────────────────────────────────────────

def _compare_inputs(symbols: str = FQuery(..., description="Comma-separated symbols (2-4)")):
    out = {}
    for s in stock_cmd.parse_symbols(symbols):
        out[f"{s}:quote"] = Fetch("yahoo", "quote", {"symbol": s})
        out[f"{s}:metrics"] = Fetch("yahoo", "key_metrics", {"symbol": s})
    return out


@router.command(path="/compare", inputs=_compare_inputs)
def compare(data, symbols: str):
    """종목 2~4개 — 시세 + 주요 지표를 한 행으로 (yahoo 는 사용자 PC Fetcher 로 위임, 캐시는 다른 위젯과 공유)."""
    return stock_cmd.compare_from(stock_cmd.parse_symbols(symbols), data)


# ── 거시 지표 (종목 차트 비교용) ──────────────────────────────────────────────

# 지표 키 → fred 모델 (+ 고정 파라미터)
INDICATOR_MAP: Dict[str, tuple] = {
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
    "FISCAL_BALANCE":        ("series",                {"series_id": "FYFSGDA188S"}),   # 연방 재정수지 %GDP
}
# 두 시리즈의 비율(%) — 지표 키 → (분자, 분모 series id)
RATIO_MAP: Dict[str, tuple] = {
    "CORP_PROFITS_GDP": ("CPATAX", "GDP"),     # 세후 기업이익 %GDP
}


def _indicator_inputs(indicator: str, period: str = "5y"):
    key = indicator.upper()
    if key not in INDICATOR_MAP and key not in RATIO_MAP:
        raise HTTPException(status_code=400, detail=f"Invalid indicator. Valid: {', '.join([*INDICATOR_MAP, *RATIO_MAP])}")
    start, end = parse_period_to_dates(period)
    rng = {"start_date": start, "end_date": end}
    if key in RATIO_MAP:
        num, den = RATIO_MAP[key]
        return {"rows": Fetch("fred", "series", {"series_id": f"{num},{den}", **rng}, required=True)}
    model, params = INDICATOR_MAP[key]
    return {"rows": Fetch("fred", model, {**params, **rng}, required=True)}


@router.command(path="/indicator/{indicator}", inputs=_indicator_inputs)
def indicator_history(data, indicator: str):
    key = indicator.upper()
    rows = macro.ratio_pct_from(data["rows"], *RATIO_MAP[key]) if key in RATIO_MAP else data["rows"]
    if not rows:
        raise HTTPException(status_code=404, detail=f"No data for {indicator}")
    return rows


# ══ provider 조회가 아닌 것 ════════════════════════════════════════════════════

@extra.get("/search")
@route_handler
async def search_stocks(query: str = "", limit: int = 12) -> OBBject:
    """종목 자동완성 — DB 유니버스(KR+US 전체) 기반 인메모리 검색. 외부 API 호출 없음."""
    from app.backend.services.symbol_cache import get_symbol_cache

    cache = get_symbol_cache()
    await cache.ensure_loaded()
    return OBBject(results=cache.search(query.upper(), limit=limit), provider="db")


@extra.get("/relations/{symbol}")
@route_handler
async def get_company_relations_route(symbol: str, provider: str = "db") -> OBBject:
    from app.backend.services.company_relations import get_company_relations
    return OBBject.from_result(await get_company_relations(symbol.upper()), provider)


@extra.get("/ranking/live")
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


@extra.get("/ranking")
async def get_stock_ranking(
    market: str = FQuery("all", description="all | domestic | overseas"),
    sort_by: str = FQuery("gainers", description="gainers | losers | volume | trade_value"),
    period: str = FQuery("1d", description="realtime | 1d | 1w | 1mo | 3mo | 6mo | 1y"),
    limit: int = FQuery(50, ge=1, le=200),
) -> OBBject:
    from app.backend.services.ranking_service import RankingService
    results, source = await RankingService.get_ranking(market=market, sort_by=sort_by, period=period, limit=limit)
    return OBBject(results=results, provider=source)

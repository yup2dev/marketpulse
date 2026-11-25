"""News API Routes — OBBject pattern"""
from typing import Optional

from fastapi import APIRouter, Query as FQuery

from data_fetcher.core.obbject import OBBject
from data_fetcher.query_executor import QueryExecutor
from app.backend.api.deps import filter_dated_rows, resolve_date_range, route_handler

router = APIRouter()


@router.get("/")
@route_handler
async def get_news(
    symbol: Optional[str] = None,
    provider: str = "polygon",
    limit: int = FQuery(10, ge=1, le=50),
    period: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
) -> OBBject:
    params = {"limit": limit}
    if symbol:
        params["ticker"] = symbol.upper()
    start, end = resolve_date_range(period, start_date, end_date)
    if start:
        params["start_date"] = start
    if end:
        params["end_date"] = end
    raw = await QueryExecutor.fetch(provider, "news", params)
    serialized = OBBject.from_result(raw, provider).results
    if start or end:
        serialized = filter_dated_rows(serialized, start, end, key="published_utc")
    return OBBject(results=serialized[:limit], provider=provider)


@router.get("/events")
@route_handler
async def get_news_events(
    symbol: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    limit: int = FQuery(100, ge=1, le=500),
) -> OBBject:
    """크롤링 파이프라인이 종목에 매핑한 뉴스 이벤트 — db provider news_events.

    index_analyzer worker(크롤 → PROC 분석)가 쌓은 mbs_proc_article 을 원문(mbs_in_article)과 붙인다.
    주가 차트에 이벤트를 오버레이하는 용도.
    - symbol: 종목코드 필터 (매핑된 이벤트만; 미지정 시 전체 — stk_cd 없는 매크로 뉴스 포함)
    - start_date/end_date: base_ymd 범위 (YYYY-MM-DD)
    """
    params = {"symbol": symbol, "start_date": start_date, "end_date": end_date, "limit": limit}
    raw = await QueryExecutor.fetch("db", "news_events", {k: v for k, v in params.items() if v is not None})
    return OBBject.from_result(raw, "index_analyzer")

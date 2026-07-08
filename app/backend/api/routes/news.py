"""News API Routes — OBBject pattern"""
from typing import Optional

from fastapi import APIRouter, Depends, Query as FQuery
from sqlalchemy.orm import Session

from data_fetcher.core.obbject import OBBject
from data_fetcher.abstract_provider.abstract.fetcher import AnnotatedResult
from data_fetcher.query_executor import QueryExecutor
from app.backend.api.deps import route_handler
from app.backend.core.db import get_db

router = APIRouter()


@router.get("/")
@route_handler
async def get_news(
    symbol: Optional[str] = None,
    provider: str = "polygon",
    limit: int = FQuery(10, ge=1, le=50),
) -> OBBject:
    params = {"limit": limit}
    if symbol:
        params["ticker"] = symbol.upper()
    raw = await QueryExecutor.fetch(provider, "news", params)
    items = raw.result if isinstance(raw, AnnotatedResult) else (raw or [])
    serialized = [
        item.model_dump(mode="json") if hasattr(item, "model_dump") else item
        for item in items[:limit]
    ]
    return OBBject(results=serialized, provider=provider)


@router.get("/events")
@route_handler
async def get_news_events(
    symbol: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    limit: int = FQuery(100, ge=1, le=500),
    db: Session = Depends(get_db),
) -> OBBject:
    """크롤링 파이프라인이 종목에 매핑한 뉴스 이벤트.

    index_analyzer worker(크롤 → PROC 분석)가 쌓은 mbs_proc_article을
    원문(mbs_in_article)과 조인해 반환. 주가 차트에 이벤트를 오버레이하는 용도.
    - symbol: 종목코드 필터 (매핑된 이벤트만; 미지정 시 전체 — stk_cd 없는 매크로 뉴스 포함)
    - start_date/end_date: base_ymd 범위 (YYYY-MM-DD)
    """
    from index_analyzer.models.orm.process import MBS_PROC_ARTICLE
    from index_analyzer.models.orm.ingest import MBS_IN_ARTICLE

    q = (
        db.query(MBS_PROC_ARTICLE, MBS_IN_ARTICLE)
        .join(MBS_IN_ARTICLE, MBS_PROC_ARTICLE.news_id == MBS_IN_ARTICLE.news_id)
    )
    if symbol:
        q = q.filter(MBS_PROC_ARTICLE.stk_cd == symbol.upper())
    if start_date:
        q = q.filter(MBS_PROC_ARTICLE.base_ymd >= start_date)
    if end_date:
        q = q.filter(MBS_PROC_ARTICLE.base_ymd <= end_date)
    rows = q.order_by(MBS_PROC_ARTICLE.base_ymd.desc()).limit(limit).all()

    results = [
        {
            "date": proc.base_ymd.isoformat() if proc.base_ymd else None,
            "symbol": proc.stk_cd,
            "title": art.title,
            "summary": proc.summary_text,
            "sentiment_score": float(proc.sentiment_score) if proc.sentiment_score is not None else None,
            "price_impact": float(proc.price_impact) if proc.price_impact is not None else None,
            "match_score": float(proc.match_score) if proc.match_score is not None else None,
            "price": float(proc.price) if proc.price is not None else None,
            "source": art.source_cd,
            "url": art.url,
            "publish_dt": art.publish_dt.isoformat() if art.publish_dt else None,
        }
        for proc, art in rows
    ]
    return OBBject(results=results, provider="index_analyzer")

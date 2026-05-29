"""News API Routes — OBBject pattern"""
from typing import Optional

from fastapi import APIRouter, Query as FQuery

from data_fetcher.core.obbject import OBBject
from data_fetcher.fetchers.base import AnnotatedResult
from data_fetcher.query_executor import QueryExecutor
from app.backend.api.deps import route_handler

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

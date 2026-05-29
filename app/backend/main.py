"""
MarketPulse Web Application
FastAPI-based dashboard for financial data visualization
"""
import sys
from pathlib import Path
from contextlib import asynccontextmanager

from fastapi import FastAPI, Response

# Add project root to path (must be before app imports)
project_root = str(Path(__file__).parent.parent.parent)
sys.path.insert(0, project_root)

from fastapi.middleware.cors import CORSMiddleware

from app.backend.core.config import settings
from app.backend.core.db import init_db
from app.backend.api.routes import (
    stock, news, portfolio, macro,
    auth, user_portfolio, screener, alerts, export, watchlist, menu,
    quantlib, quantitative, notes,
)
from app.backend.api.routes.workspace import router as workspace_router
from app.backend.api.routes.fundamental import router as fundamental_router
from app.backend.api.routes.providers import router as providers_router
from app.backend.api.routes.ws import router as ws_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    import data_fetcher.providers_init  # noqa: F401 — registers all providers/fetchers
    init_db()

    from app.backend.services.symbol_cache import get_symbol_cache
    await get_symbol_cache().ensure_loaded()

    from app.backend.core.cache import cache
    from data_fetcher.query_executor import QueryExecutor
    await cache.init(redis_url=settings.REDIS_URL if settings.QUEUE_ENABLED else None)
    QueryExecutor.configure(cache=cache)

    import asyncio
    from app.backend.services.ranking_service import warmup_ranking_loop
    warmup_task = asyncio.create_task(warmup_ranking_loop())

    from app.backend.services.stock_list_service import refresh_cache, stock_list_warmup_loop
    await refresh_cache()
    stock_list_task = asyncio.create_task(stock_list_warmup_loop())

    yield

    warmup_task.cancel()
    stock_list_task.cancel()
    await cache.close()


app = FastAPI(
    title="MarketPulse Dashboard",
    description="Financial data visualization dashboard",
    version=settings.APP_VERSION,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Stock / Market ────────────────────────────────────────────────────────────
app.include_router(stock.router,     prefix="/api/stock",    tags=["stock"])
app.include_router(news.router,      prefix="/api/news",     tags=["news"])
app.include_router(screener.router,  prefix="/api",          tags=["screener"])

# ── Macro / Economic ─────────────────────────────────────────────────────────
app.include_router(macro.router,     prefix="/api/macro",    tags=["macro"])

# ── Portfolio ─────────────────────────────────────────────────────────────────
app.include_router(portfolio.router,      prefix="/api/portfolio", tags=["portfolio"])
app.include_router(user_portfolio.router, prefix="/api",           tags=["user-portfolio"])

# ── User / Auth ───────────────────────────────────────────────────────────────
app.include_router(auth.router,      prefix="/api", tags=["auth"])
app.include_router(alerts.router,    prefix="/api", tags=["alerts"])
app.include_router(watchlist.router, prefix="/api", tags=["watchlist"])
app.include_router(notes.router,     prefix="/api", tags=["notes"])
app.include_router(workspace_router, prefix="/api", tags=["workspace"])

# ── Analysis ──────────────────────────────────────────────────────────────────
app.include_router(fundamental_router.router, prefix="/api/v1",           tags=["equity-fundamental"])
app.include_router(quantlib.router,           prefix="/api/quantlib",     tags=["quantlib"])
app.include_router(quantitative.router,       prefix="/api/quantitative", tags=["quantitative"])

# ── System ────────────────────────────────────────────────────────────────────
app.include_router(export.router,     prefix="/api", tags=["export"])
app.include_router(menu.router,       prefix="/api", tags=["menu"])
app.include_router(providers_router,  prefix="/api", tags=["providers"])
app.include_router(ws_router,                        tags=["websocket"])


@app.get("/")
async def root():
    return {
        "app": "MarketPulse API",
        "version": settings.APP_VERSION,
    }


@app.get("/health")
async def health_check():
    return {"status": "healthy", "version": settings.APP_VERSION}


@app.get("/cache/stats")
async def cache_stats():
    from app.backend.core.cache import cache
    return cache.stats()


@app.delete("/cache/{prefix}")
async def cache_invalidate(prefix: str):
    from app.backend.core.cache import cache
    count = await cache.invalidate_prefix(prefix)
    return {"invalidated": count, "prefix": prefix}


@app.post("/cache/refresh")
async def cache_refresh_stocks():
    from app.backend.services.stock_list_service import refresh_cache
    count = await refresh_cache()
    return {"status": "ok", "count": count}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
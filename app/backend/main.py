"""
MarketPulse Web Application
FastAPI-based dashboard for financial data visualization
"""
import sys
import logging
from pathlib import Path
from contextlib import asynccontextmanager

log = logging.getLogger(__name__)

from fastapi import FastAPI, Request, Response
from fastapi.responses import JSONResponse

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
from app.backend.api.routes.data import router as data_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    import data_fetcher.providers_init  # noqa: F401 — registers all providers/fetchers
    init_db()

    from app.backend.services.symbol_cache import get_symbol_cache
    await get_symbol_cache().ensure_loaded()

    from app.backend.core.cache import cache
    from data_fetcher.query_executor import QueryExecutor
    await cache.init(redis_url=settings.REDIS_URL if settings.QUEUE_ENABLED else None)
    # FETCHER_REMOTE_ENABLED=True 면 모든 데이터 조회를 로컬 Fetcher(exe) REST로 위임한다.
    # (배포 WebServer는 provider 키를 갖지 않음 — 키와 외부 호출은 Fetcher에 집중)
    # False(기본)에서는 기존처럼 백엔드가 provider를 직접 호출한다.
    fetcher_client = None
    if settings.FETCHER_REMOTE_ENABLED:
        from app.backend.core.fetcher_client import FetcherClient
        fetcher_client = FetcherClient(
            base_url=settings.FETCHER_URL,
            timeout=settings.FETCHER_TIMEOUT,
            token=settings.FETCHER_TOKEN or None,
        )
        log.info("[startup] Fetcher 위임 활성화 → %s", settings.FETCHER_URL)
    QueryExecutor.configure(cache=cache, remote=fetcher_client)

    # ── Redis Pub/Sub (멀티워커 WS fan-out) ──────────────────────────────────
    from app.backend.core.pubsub import init_pubsub, close_pubsub
    from app.backend.api.routes.ws import register_pubsub_handlers, quote_publisher_loop
    await init_pubsub(redis_url=settings.REDIS_URL if settings.QUEUE_ENABLED else None)
    register_pubsub_handlers()

    import asyncio
    quote_pub_task = asyncio.create_task(quote_publisher_loop())

    from app.backend.services.ranking_service import warmup_ranking_loop
    warmup_task = asyncio.create_task(warmup_ranking_loop())

    from app.backend.services.stock_list_service import refresh_cache, stock_list_warmup_loop
    await refresh_cache()
    stock_list_task = asyncio.create_task(stock_list_warmup_loop())

    yield

    quote_pub_task.cancel()
    warmup_task.cancel()
    stock_list_task.cancel()
    if fetcher_client is not None:
        await fetcher_client.aclose()
    await cache.close()
    await close_pubsub()

    from data_fetcher.utils.async_http_client import aclose_client
    await aclose_client()


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

# ── Auth Gate Middleware ───────────────────────────────────────────────────────
# /api/* 요청 중 공개 경로 이외에는 유효한 Bearer 토큰을 요구합니다.
# 401 응답 → 프론트엔드 apiClient가 refresh 시도 → 실패 시 forceLogout() → /login 이동
_PUBLIC_PREFIXES = (
    "/api/auth/login",
    "/api/auth/register",
    "/api/auth/refresh",
)


@app.middleware("http")
async def auth_gate(request: Request, call_next):
    path = request.url.path

    # WebSocket, 비-API 경로, 공개 Auth 경로, CORS preflight는 통과
    if (
        request.method == "OPTIONS"
        or not path.startswith("/api/")
        or path.startswith("/ws/")
        or any(path.startswith(p) for p in _PUBLIC_PREFIXES)
    ):
        return await call_next(request)

    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        return JSONResponse(
            status_code=401,
            content={"detail": "Not authenticated"},
            headers={"WWW-Authenticate": "Bearer"},
        )

    from app.backend.core.auth.security import decode_token
    token = auth_header.split(" ", 1)[1]
    payload = decode_token(token)
    if payload is None or payload.get("type") == "refresh":
        return JSONResponse(
            status_code=401,
            content={"detail": "Invalid or expired token"},
            headers={"WWW-Authenticate": "Bearer"},
        )

    return await call_next(request)

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

# ── Universal Data Gateway ───────────────────────────────────────────────────
app.include_router(data_router,       prefix="/api/data", tags=["data"])

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
    from app.backend.core.cache import cache, CACHE_VERSION
    return {"version": CACHE_VERSION, **cache.stats()}


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


@app.get("/circuit-breakers")
async def circuit_breaker_stats():
    """모든 provider 서킷브레이커 상태 조회."""
    from data_fetcher.utils.circuit_breaker import all_stats
    return all_stats()


@app.post("/circuit-breakers/{provider}/reset")
async def circuit_breaker_reset(provider: str):
    """특정 provider 서킷브레이커 수동 리셋 (OPEN → CLOSED)."""
    from data_fetcher.utils.circuit_breaker import reset
    reset(provider)
    return {"status": "reset", "provider": provider}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
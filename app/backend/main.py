"""
MarketPulse Web Application
FastAPI-based dashboard for financial data visualization
"""
import sys
import json
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
from app.backend.api.routes.keys import router as keys_router


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
        if settings.FETCHER_WORKER_MODE:
            # 사용자 PC의 Fetcher가 /ws/fetcher 로 outbound 접속(push) → 워커 풀에 위임
            from app.backend.core.fetcher_ws_transport import WSFetcherTransport
            fetcher_client = WSFetcherTransport(timeout=settings.FETCHER_TIMEOUT)
            log.info("[startup] Fetcher 위임 활성화 (WS 워커 풀, /ws/fetcher)")
        else:
            from app.backend.core.fetcher_client import FetcherClient
            fetcher_client = FetcherClient(
                base_url=settings.FETCHER_URL,
                timeout=settings.FETCHER_TIMEOUT,
                token=settings.FETCHER_TOKEN or None,
            )
            log.info("[startup] Fetcher 위임 활성화 → %s", settings.FETCHER_URL)

    # key-only provider(Class B)를 서버에서 '요청 사용자의 키'로 호출하기 위한 해석기.
    # current_user_id별로 DB에 저장된 사용자 키를 복호화해 반환한다.
    def _credential_resolver(provider: str, user_id: str):
        from app.backend.services.user_key_service import get_credentials
        return get_credentials(user_id, provider)

    QueryExecutor.configure(
        cache=cache, remote=fetcher_client, credential_resolver=_credential_resolver,
    )

    # ── Redis Pub/Sub (멀티워커 WS fan-out) ──────────────────────────────────
    from app.backend.core.pubsub import init_pubsub, close_pubsub
    from app.backend.api.routes.ws import register_pubsub_handlers, quote_publisher_loop
    await init_pubsub(redis_url=settings.REDIS_URL if settings.QUEUE_ENABLED else None)
    register_pubsub_handlers()

    import asyncio
    quote_pub_task = asyncio.create_task(quote_publisher_loop())

    # KIS(한국투자증권) 실시간 체결 스트림 — KIS_APPKEY/SECRET 없으면 즉시 종료(폴링 백업)
    import os
    from app.backend.api.routes.ws import kis_stream_loop
    kis_task = asyncio.create_task(kis_stream_loop(env=os.getenv("KIS_ENV", "real")))

    from app.backend.services.ranking_service import warmup_ranking_loop
    warmup_task = asyncio.create_task(warmup_ranking_loop())

    from app.backend.services.stock_list_service import refresh_cache, stock_list_warmup_loop
    await refresh_cache()
    stock_list_task = asyncio.create_task(stock_list_warmup_loop())

    yield

    quote_pub_task.cancel()
    kis_task.cancel()
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

# ── Auth Gate Middleware ───────────────────────────────────────────────────────
# /api/* 요청 중 공개 경로 이외에는 유효한 Bearer 토큰을 요구합니다.
# 401 응답 → 프론트엔드 apiClient가 refresh 시도 → 실패 시 forceLogout() → /login 이동
_PUBLIC_PREFIXES = (
    "/api/auth/login",
    "/api/auth/register",
    "/api/auth/refresh",
)


async def _send_json(send, status: int, detail: str, extra_headers=None) -> None:
    body = json.dumps({"detail": detail}).encode()
    headers = [(b"content-type", b"application/json"),
               (b"content-length", str(len(body)).encode())]
    headers += (extra_headers or [])
    await send({"type": "http.response.start", "status": status, "headers": headers})
    await send({"type": "http.response.body", "body": body})


class AuthGateMiddleware:
    """순수 ASGI 인증 게이트.

    @app.middleware("http")(=BaseHTTPMiddleware)는 downstream을 별도 task로 실행해
    여기서 set한 current_user_id contextvar가 실 uvicorn 런타임에서 엔드포인트까지
    전파되지 않는다(요청이 user_id=None으로 보여 Fetcher 위임 실패). 순수 ASGI
    미들웨어는 같은 컨텍스트에서 downstream을 호출하므로 contextvar가 정상 전파된다.

    CORS가 최외곽이 되도록 이 미들웨어를 CORSMiddleware보다 먼저 add 한다.
    """

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        path = scope.get("path", "")
        method = scope.get("method", "")
        # WebSocket, 비-API 경로, 공개 Auth 경로, CORS preflight는 통과
        if (
            method == "OPTIONS"
            or not path.startswith("/api/")
            or path.startswith("/ws/")
            or any(path.startswith(p) for p in _PUBLIC_PREFIXES)
        ):
            await self.app(scope, receive, send)
            return

        headers = dict(scope.get("headers") or [])
        auth_header = headers.get(b"authorization", b"").decode("latin-1")
        bearer = (b"www-authenticate", b"Bearer")
        if not auth_header.startswith("Bearer "):
            await _send_json(send, 401, "Not authenticated", [bearer])
            return

        from app.backend.core.auth.security import decode_token
        token = auth_header.split(" ", 1)[1]
        payload = decode_token(token)
        if payload is None or payload.get("type") == "refresh":
            await _send_json(send, 401, "Invalid or expired token", [bearer])
            return

        # 요청 범위 사용자 컨텍스트 — 데이터 조회가 '이 사용자의 Fetcher 워커'로 위임되도록.
        from data_fetcher.query_executor import current_user_id
        sub = payload.get("sub")
        ctx_token = current_user_id.set(str(sub) if sub is not None else None)
        try:
            await self.app(scope, receive, send)
        finally:
            current_user_id.reset(ctx_token)


app.add_middleware(AuthGateMiddleware)


# ── CORS ───────────────────────────────────────────────────────────────────────
# 반드시 auth_gate 뒤에 등록한다. Starlette은 나중에 add한 미들웨어가 더 바깥(outermost)
# 이므로, CORS가 최외곽이 되어 auth_gate가 단락(401)으로 반환하는 응답에도 CORS 헤더가
# 붙는다. 그렇지 않으면 브라우저가 401 응답을 막아 프론트가 status를 못 보고(네트워크 오류로
# 처리) refresh/forceLogout/로그인 리다이렉트가 동작하지 않는다.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        *settings.CORS_ORIGINS,
        "tauri://localhost",          # Tauri 데스크탑 앱 (macOS/Linux)
        "http://tauri.localhost",     # Tauri 데스크탑 앱 (Windows WebView2/Edge)
        "https://tauri.localhost",    # Tauri 데스크탑 앱 (Windows WebView2/Edge, HTTPS)
        "https://frontend-yup2devs-projects.vercel.app",  # Vercel 프론트엔드
        "http://localhost",
        "http://127.0.0.1",
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:5175",
    ],
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

# ── Universal Data Gateway ───────────────────────────────────────────────────
app.include_router(data_router,       prefix="/api/data", tags=["data"])

# ── System ────────────────────────────────────────────────────────────────────
app.include_router(export.router,     prefix="/api", tags=["export"])
app.include_router(menu.router,       prefix="/api", tags=["menu"])
app.include_router(providers_router,  prefix="/api", tags=["providers"])
app.include_router(keys_router,       prefix="/api", tags=["keys"])
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


@app.get("/fetcher-workers")
async def fetcher_workers():
    """/ws/fetcher 로 접속 중인 사용자 PC Fetcher 워커 풀 상태."""
    from app.backend.core.fetcher_pool import fetcher_pool
    return {"connected": fetcher_pool.count(), "workers": fetcher_pool.status()}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        reload_dirs=[str(Path(__file__).parent)],
    )
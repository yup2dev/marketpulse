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

from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware

from app.backend.core.config import settings
# Import new models so Base.metadata.create_all() picks them up
import index_analyzer.models.orm  # noqa: F401 — ensures UserWorkspace is picked up by create_all
from app.backend.api.routes import (
    stock, economic, news, dashboard, portfolio, macro,
    auth, user_portfolio, screener, alerts, export, watchlist, menu,
    quantlib, quantitative, notes,
)
from app.backend.api.routes.workspace import router as workspace_router
from app.backend.api.routes.fundamental import router as fundamental_router
from app.backend.api.routes.providers import router as providers_router
from app.backend.api.routes.ws import router as ws_router


def _init_db():
    """Initialize database tables on startup"""
    try:
        from index_analyzer.utils.db import get_sqlite_db
        from index_analyzer.models.orm import Base

        db_path = Path(__file__).parent.parent.parent / "data" / "marketpulse.db"
        db_instance = get_sqlite_db(str(db_path))
        Base.metadata.create_all(bind=db_instance.engine)
        print("[OK] Database tables initialized successfully")

        try:
            from scripts.init_menu_data import init_menu_data
            init_menu_data()
            print("[OK] Menu data initialized successfully")
        except Exception as e:
            print(f"[SKIP] Menu data initialization skipped: {e}")

    except Exception as e:
        print(f"[FAIL] Startup initialization failed: {e}")

@asynccontextmanager
async def lifespan(app: FastAPI):
    import data_fetcher.providers_init  # noqa: F401 — registers all providers/fetchers
    _init_db()

    from app.backend.services.symbol_cache import get_symbol_cache
    await get_symbol_cache().ensure_loaded()

    from app.backend.core.cache import cache
    await cache.init(redis_url=settings.REDIS_URL if settings.QUEUE_ENABLED else None)

    # 실시간 랭킹 캐시 백그라운드 프리워밍 (콜드 로드를 사용자가 기다리지 않도록)
    import asyncio
    from app.backend.services.ranking_service import warmup_ranking_loop
    warmup_task = asyncio.create_task(warmup_ranking_loop())

    # 종목 리스트 초기 캐싱 + 5분 주기 백그라운드 갱신
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

# Static files
BASE_DIR = Path(__file__).parent
app.mount("/static", StaticFiles(directory=str(BASE_DIR / "static")), name="static")

# Include routers
app.include_router(auth.router, prefix="/api", tags=["auth"])
app.include_router(user_portfolio.router, prefix="/api", tags=["user-portfolio"])
app.include_router(screener.router, prefix="/api", tags=["screener"])
app.include_router(alerts.router, prefix="/api", tags=["alerts"])
app.include_router(export.router, prefix="/api", tags=["export"])
app.include_router(watchlist.router, prefix="/api", tags=["watchlist"])
app.include_router(menu.router, prefix="/api", tags=["menu"])
app.include_router(stock.router, prefix="/api/stock", tags=["stock"])
app.include_router(economic.router, prefix="/api/economic", tags=["economic"])
app.include_router(news.router, prefix="/api/news", tags=["news"])
app.include_router(dashboard.router, prefix="/api", tags=["dashboard"])
app.include_router(portfolio.router, prefix="/api/portfolio", tags=["portfolio"])
app.include_router(macro.router, prefix="/api/macro", tags=["macro"])
app.include_router(workspace_router, prefix="/api", tags=["workspace"])
app.include_router(fundamental_router.router, prefix="/api/v1", tags=["equity-fundamental"])
app.include_router(quantlib.router, prefix="/api/quantlib", tags=["quantlib"])
app.include_router(quantitative.router, prefix="/api/quantitative", tags=["quantitative"])
app.include_router(notes.router, prefix="/api", tags=["notes"])
app.include_router(providers_router, prefix="/api", tags=["providers"])
app.include_router(ws_router, tags=["websocket"])


@app.get("/")
async def root():
    """API root endpoint"""
    return {
        "app": "MarketPulse API",
        "version": settings.APP_VERSION,
        "endpoints": {
            "health": "/health",
            "docs": "/docs",
            "stock": "/api/stock",
            "economic": "/api/economic",
            "news": "/api/news",
            "dashboard": "/api/dashboard",
            "portfolio": "/api/portfolio",
            "macro": "/api/macro",
        },
    }


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "app": "MarketPulse Dashboard",
        "version": settings.APP_VERSION,
    }


@app.get("/cache/stats")
async def cache_stats():
    """캐시 통계 (백엔드 타입, 히트율 등)"""
    from app.backend.core.cache import cache
    return cache.stats()


@app.delete("/cache/{prefix}")
async def cache_invalidate(prefix: str):
    """특정 prefix 캐시 무효화 (관리용)"""
    from app.backend.core.cache import cache
    count = await cache.invalidate_prefix(prefix)
    return {"invalidated": count, "prefix": prefix}


@app.post("/cache/refresh")
async def cache_refresh_stocks():
    """종목 리스트 캐시 수동 갱신 (종목 추가/삭제 후 호출)"""
    from app.backend.services.stock_list_service import refresh_cache
    count = await refresh_cache()
    return {"status": "ok", "count": count, "cache_key": "stocks:all"}

@app.get("/header")
async def get_header(response : Response):
    """Health check endpoint"""
    return {
        "status": "healthy",
        "app": "MarketPulse Dashboard",
        "version": settings.APP_VERSION,
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)

"""
MarketPulse Web Application
FastAPI-based dashboard for financial data visualization
"""
import sys
from pathlib import Path
from contextlib import asynccontextmanager

# Add project root to path (must be before app imports)
project_root = str(Path(__file__).parent.parent.parent)
sys.path.insert(0, project_root)

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware

from app.backend.core.config import settings
from app.backend.api.routes import (
    stock, economic, news, dashboard, backtest, portfolio, macro,
    auth, user_portfolio, screener, alerts, export, watchlist, menu
)


def _init_db():
    """Initialize database tables on startup"""
    try:
        from index_analyzer.models.database import Base, get_sqlite_db

        db_path = Path(__file__).parent.parent.parent / "data" / "marketpulse.db"
        db_instance = get_sqlite_db(str(db_path))
        Base.metadata.create_all(bind=db_instance.engine)
        print("✓ Database tables initialized successfully")

        try:
            from scripts.init_menu_data import init_menu_data
            init_menu_data()
            print("✓ Menu data initialized successfully")
        except Exception as e:
            print(f"⚠ Menu data initialization skipped: {e}")

    except Exception as e:
        print(f"✗ Startup initialization failed: {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    _init_db()
    yield


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
app.include_router(backtest.router, prefix="/api/backtest", tags=["backtest"])
app.include_router(portfolio.router, prefix="/api/portfolio", tags=["portfolio"])
app.include_router(macro.router, prefix="/api/macro", tags=["macro"])


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
            "backtest": "/api/backtest",
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


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)

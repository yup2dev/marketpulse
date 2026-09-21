"""라우터 등록 — 앱이 서빙하는 모든 라우터를 한 곳에서 붙인다.

main.py 에서 분리했다. 새 라우트 파일을 만들고 등록을 빠뜨리면 그 엔드포인트는
조용히 404 가 되므로(보통 프론트에서야 발견된다), 등록 지점을 한 파일로 모아
tests/test_app_boot.py 의 '모든 라우트 모듈이 등록됐는가' 검사와 짝을 이루게 한다.
"""
from fastapi import FastAPI

from app.backend.api.routes import (
    stock, news, portfolio, macro,
    auth, user_portfolio, screener, alerts, export, watchlist, menu,
    quantlib, quantitative, notes, reports, copilot, backtest,
)
from app.backend.api.routes.admin import router as admin_router
from app.backend.api.routes.workspace import router as workspace_router
# fundamental 의 router 는 CommandRouter — APIRouter 를 `.router` 로 감싸고 있다.
from app.backend.api.routes.fundamental import router as fundamental_command_router
from app.backend.api.routes.providers import router as providers_router
from app.backend.api.routes.ws import router as ws_router
from app.backend.api.routes.data import router as data_router
from app.backend.api.routes.keys import router as keys_router
from app.backend.api.routes.ingest import router as ingest_router


def register_routers(app: FastAPI) -> None:
    # ── Stock / Market ────────────────────────────────────────────────────────
    app.include_router(stock.router,     prefix="/api/stock",    tags=["stock"])
    app.include_router(news.router,      prefix="/api/news",     tags=["news"])
    app.include_router(reports.router,   prefix="/api",          tags=["reports"])
    app.include_router(screener.router,  prefix="/api",          tags=["screener"])

    # ── Macro / Economic ─────────────────────────────────────────────────────
    app.include_router(macro.router,     prefix="/api/macro",    tags=["macro"])

    # ── Portfolio ─────────────────────────────────────────────────────────────
    app.include_router(portfolio.router,      prefix="/api/portfolio", tags=["portfolio"])
    app.include_router(user_portfolio.router, prefix="/api",           tags=["user-portfolio"])

    # ── User / Auth ───────────────────────────────────────────────────────────
    app.include_router(auth.router,      prefix="/api", tags=["auth"])
    app.include_router(alerts.router,    prefix="/api", tags=["alerts"])
    app.include_router(watchlist.router, prefix="/api", tags=["watchlist"])
    app.include_router(notes.router,     prefix="/api", tags=["notes"])
    app.include_router(backtest.router,  prefix="/api", tags=["backtest"])
    app.include_router(workspace_router, prefix="/api", tags=["workspace"])

    # ── Analysis ──────────────────────────────────────────────────────────────
    app.include_router(fundamental_command_router.router, prefix="/api/v1",           tags=["equity-fundamental"])
    app.include_router(quantlib.router,                   prefix="/api/quantlib",     tags=["quantlib"])
    app.include_router(quantitative.router,               prefix="/api/quantitative", tags=["quantitative"])

    # ── Universal Data Gateway ───────────────────────────────────────────────
    app.include_router(data_router,       prefix="/api/data", tags=["data"])

    # ── AI Copilot ────────────────────────────────────────────────────────────
    app.include_router(copilot.router,    prefix="/api", tags=["copilot"])

    # ── System ────────────────────────────────────────────────────────────────
    app.include_router(export.router,     prefix="/api", tags=["export"])
    app.include_router(menu.router,       prefix="/api", tags=["menu"])
    app.include_router(providers_router,  prefix="/api", tags=["providers"])
    app.include_router(keys_router,       prefix="/api", tags=["keys"])
    app.include_router(ingest_router,     prefix="/api", tags=["ingest"])
    app.include_router(admin_router,      prefix="/api", tags=["admin"])
    app.include_router(ws_router,                        tags=["websocket"])

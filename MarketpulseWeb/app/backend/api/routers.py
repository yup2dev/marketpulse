"""라우터 등록 — 앱이 서빙하는 모든 라우터를 한 곳에서 붙인다.

main.py 에서 분리했다. 새 라우트 파일을 만들고 등록을 빠뜨리면 그 엔드포인트는
조용히 404 가 되므로(보통 프론트에서야 발견된다), 등록 지점을 한 파일로 모아
tests/test_app_boot.py 의 '모든 라우트 모듈이 등록됐는가' 검사와 짝을 이루게 한다.
"""
from fastapi import FastAPI

from app.backend.api.command_map import add_command_map

# 데이터 도메인 — commands/<도메인>/router.py (@router.command 선언) + 로직 모듈
from app.backend.commands.concepts import router as concepts
from app.backend.commands.industry import router as industry
from app.backend.commands.macro import router as macro
from app.backend.commands.portfolio import router as portfolio
from app.backend.commands.quant import router as quant
from app.backend.commands.quant_portfolios import router as quant_portfolios
from app.backend.commands.quantitative import router as quantitative
from app.backend.commands.screener import router as screener
from app.backend.commands.stock import router as stock
from app.backend.commands.strategies import router as strategies

# 앱 기능 — 사용자 · 인증 · 설정 · 시스템 (api/routes)
from app.backend.api.routes import auth, user_portfolio, alerts, export, watchlist, menu, notes, reports, copilot, backtest
from app.backend.api.routes.admin import router as admin_router
from app.backend.api.routes.workspace import router as workspace_router
from app.backend.api.routes.providers import router as providers_router
from app.backend.api.routes.ws import router as ws_router
from app.backend.api.routes.data import router as data_router
from app.backend.api.routes.keys import router as keys_router
from app.backend.api.routes.ingest import router as ingest_router
from app.backend.api.routes.user_widgets import router as user_widgets_router


def register_routers(app: FastAPI) -> None:
    # ── 데이터 — 단순 조회는 게이트웨이, 가공은 command (오류 응답은 command_map 래퍼가 한 곳에서) ──
    app.include_router(data_router, prefix="/api/data", tags=["data"])
    add_command_map(app, [
        (macro.router, "/api/macro"),
        (stock.router, "/api/stock"),
        (quantitative.router, "/api/quantitative"),
        (portfolio.router, "/api/portfolio"),
        (quant.router, "/api"),
        (strategies.router, "/api"),
        (quant_portfolios.router, "/api"),
        (industry.router, "/api"),
        (concepts.router, "/api"),
        (screener.router, "/api"),
    ])

    # ── 사용자 · 인증 ─────────────────────────────────────────────────────────
    app.include_router(auth.router,      prefix="/api", tags=["auth"])
    app.include_router(alerts.router,    prefix="/api", tags=["alerts"])
    app.include_router(watchlist.router, prefix="/api", tags=["watchlist"])
    app.include_router(notes.router,     prefix="/api", tags=["notes"])
    app.include_router(backtest.router,  prefix="/api", tags=["backtest"])
    app.include_router(workspace_router, prefix="/api", tags=["workspace"])
    app.include_router(user_widgets_router, prefix="/api", tags=["user-widgets"])
    app.include_router(user_portfolio.router, prefix="/api", tags=["user-portfolio"])
    app.include_router(reports.router,   prefix="/api", tags=["reports"])

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

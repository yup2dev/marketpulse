"""
MarketPulse Web Application
FastAPI-based dashboard for financial data visualization

이 파일은 앱을 '조립'만 한다. 내용은 아래로 나뉘어 있다:
  core/lifespan.py               기동/종료 (캐시·Pub/Sub·WS 스트림·워밍업 태스크)
  core/middleware/auth_gate.py   인증 게이트(deny-by-default) + 공개 경로 목록
  api/routers.py                 라우터 등록
"""
import sys
from pathlib import Path

# Add project root to path (must be before app imports)
project_root = str(Path(__file__).parent.parent.parent)
sys.path.insert(0, project_root)

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.backend.core.config import settings
from app.backend.core.lifespan import lifespan
from app.backend.core.middleware.auth_gate import AuthGateMiddleware
from app.backend.api.routers import register_routers

app = FastAPI(
    title="MarketPulse Dashboard",
    description="Financial data visualization dashboard",
    version=settings.APP_VERSION,
    lifespan=lifespan,
)

# ── Middleware ────────────────────────────────────────────────────────────────
# 등록 순서가 중요하다. Starlette은 나중에 add한 미들웨어가 더 바깥(outermost)이므로
# auth_gate 를 먼저 add 해야 CORS가 최외곽이 되고, auth_gate가 단락(401)으로 반환하는
# 응답에도 CORS 헤더가 붙는다. 그렇지 않으면 브라우저가 401 응답을 막아 프론트가
# status를 못 보고(네트워크 오류로 처리) refresh/forceLogout/로그인 리다이렉트가
# 동작하지 않는다.
app.add_middleware(AuthGateMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_allow_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────────────────────────
register_routers(app)


@app.get("/")
async def root():
    return {
        "app": "MarketPulse API",
        "version": settings.APP_VERSION,
    }


@app.get("/health")
async def health_check():
    return {"status": "healthy", "version": settings.APP_VERSION}


# 운영 엔드포인트(캐시·서킷브레이커·Fetcher 워커)는 routes/admin.py 의
# `/api/admin/*` (require_admin) 으로 이동했다.


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        reload_dirs=[str(Path(__file__).parent)],
    )

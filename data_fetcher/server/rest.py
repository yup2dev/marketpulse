"""
Fetcher 로컬 REST 서버 — FastAPI 앱 팩토리.

브라우저(같은 PC)가 localhost로 직접 호출한다. API 키를 보유하고 외부
provider를 조회해 raw 데이터를 반환한다. 브라우저는 그 raw를 외부 WebServer
/api/calc 로 전달해 계산/가공을 맡긴다.

CORS:
    브라우저 페이지는 배포된 WebServer origin(예: https://app.example.com)에서
    로드되므로, fetch 대상인 이 로컬 서버가 해당 origin을 허용해야 한다.
    FETCHER_ALLOWED_ORIGINS(쉼표구분)로 지정. localhost는 신뢰 컨텍스트라
    mixed-content 차단은 없지만 CORS 헤더는 반드시 필요하다.
"""
from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

from data_fetcher.query_executor import QueryExecutor, QueryExecutorError
from data_fetcher.server.cache import MemoryCache
from data_fetcher.server.keystore import KeyStore
from data_fetcher.server.serialize import serialize_result

log = logging.getLogger(__name__)


class FetchRequest(BaseModel):
    provider: str
    model: str
    params: Dict[str, Any] = {}
    ttl: Optional[int] = None  # None → 모델별 기본 TTL, 0 → 캐시 안 함


class KeyRequest(BaseModel):
    provider: str
    api_key: str


def create_app(
    allowed_origins: Optional[List[str]] = None,
    enable_cache: bool = True,
) -> FastAPI:
    app = FastAPI(title="MarketPulse Fetcher", version="0.1.0")

    # ── CORS ──────────────────────────────────────────────────────────────────
    from fastapi.middleware.cors import CORSMiddleware
    origins = allowed_origins or ["*"]
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=False,  # 키 보호: 쿠키/자격증명 동반 요청 비허용
        allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
        allow_headers=["*"],
    )
    log.info("[fetcher] CORS allowed origins: %s", origins)

    # ── 상태 객체 ─────────────────────────────────────────────────────────────
    keystore = KeyStore()
    if enable_cache:
        QueryExecutor.configure(cache=MemoryCache())

    # ── 헬스 / 메타 ───────────────────────────────────────────────────────────
    @app.get("/health")
    async def health() -> Dict[str, Any]:
        return {"status": "ok", "version": app.version}

    @app.get("/providers")
    async def providers() -> Dict[str, List[str]]:
        """등록된 provider별 조회 가능한 model 목록."""
        from data_fetcher.abstract_provider.abstract.provider import ProviderRegistry
        return {
            name: provider.list_categories()
            for name, provider in ProviderRegistry.get_all().items()
        }

    # ── 데이터 조회 ───────────────────────────────────────────────────────────
    @app.post("/fetch")
    async def fetch(req: FetchRequest) -> Dict[str, Any]:
        """provider/model/params로 raw 데이터를 조회해 반환."""
        try:
            raw = await QueryExecutor.fetch(
                provider=req.provider,
                model=req.model,
                params=req.params,
                ttl=req.ttl,
            )
        except QueryExecutorError as exc:
            # provider/model 미존재, 자격증명 누락, 서킷 OPEN 등
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        except Exception as exc:  # 업스트림 네트워크/파싱 오류
            log.warning("[fetcher] fetch failed %s:%s — %s", req.provider, req.model, exc)
            raise HTTPException(status_code=502, detail=f"upstream error: {exc}") from exc
        return serialize_result(raw)

    # ── API 키 관리 ───────────────────────────────────────────────────────────
    @app.get("/keys")
    async def list_keys() -> List[Dict[str, object]]:
        return keystore.status()

    @app.post("/keys")
    async def set_key(req: KeyRequest) -> Dict[str, str]:
        if not req.api_key.strip():
            raise HTTPException(status_code=400, detail="api_key is empty")
        keystore.set(req.provider, req.api_key.strip())
        return {"status": "ok", "provider": req.provider.lower()}

    @app.delete("/keys/{provider}")
    async def delete_key(provider: str) -> Dict[str, str]:
        if not keystore.delete(provider):
            raise HTTPException(status_code=404, detail=f"no key for '{provider}'")
        return {"status": "deleted", "provider": provider.lower()}

    return app

"""
Fetcher 로컬 REST 서버 — FastAPI 앱 팩토리.

브라우저(같은 PC)가 localhost로 직접 호출한다. API 키를 보유하고 외부
provider를 조회해 raw 데이터를 반환한다. 브라우저는 그 raw를 외부 WebServer
/api/calc 로 전달해 계산/가공을 맡긴다.

인증:
    /fetch, /keys* 는 외부 provider API 키를 다루는 민감한 엔드포인트이므로
    Authorization: Bearer <token> 을 요구한다. 토큰은 FETCHER_TOKEN
    환경변수로 지정하거나, 없으면 최초 실행 시 자동 생성되어 로컬에
    저장된다 (data_fetcher.server.auth 참고). 백엔드는 같은 값을
    FETCHER_TOKEN에 설정해 호출한다.

CORS:
    /health 는 배포된 WebServer(브라우저)가 loopback으로 직접 헬스체크하므로
    Access-Control-Allow-Origin: * 를 별도로 내려준다 (민감 정보 없음).
    그 외 엔드포인트는 토큰 인증으로 보호되므로, 추가로 cross-origin 호출을
    허용해야 하는 경우에만 FETCHER_ALLOWED_ORIGINS(쉼표구분)로 지정한다.
"""
from __future__ import annotations

import logging
import secrets
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import Depends, FastAPI, Header, HTTPException, Response
from fastapi.responses import HTMLResponse
from pydantic import BaseModel

from data_fetcher.query_executor import QueryExecutor, QueryExecutorError
from data_fetcher.server.auth import get_or_create_token
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
    api_key: Optional[str] = None              # 단일 키 provider (fmp/polygon/…)
    fields: Optional[Dict[str, str]] = None    # 다중 필드 provider (kis: appkey/appsecret)


def create_app(
    allowed_origins: Optional[List[str]] = None,
    enable_cache: bool = True,
) -> FastAPI:
    app = FastAPI(title="MarketPulse Fetcher", version="0.1.0")

    # ── CORS ──────────────────────────────────────────────────────────────────
    # 민감 엔드포인트는 토큰 인증으로 보호되므로, CORS는 명시적으로 추가
    # origin이 설정된 경우에만 적용한다 (기본은 cross-origin 비허용).
    # /health 만 별도로 "*"를 내려준다 (민감 정보 없음, 브라우저 헬스체크용).
    origins = allowed_origins or []
    if origins:
        from fastapi.middleware.cors import CORSMiddleware
        app.add_middleware(
            CORSMiddleware,
            allow_origins=origins,
            allow_credentials=False,  # 키 보호: 쿠키/자격증명 동반 요청 비허용
            allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
            allow_headers=["*"],
        )
    log.info("[fetcher] CORS allowed origins: %s", origins or "(none — /health is open separately)")

    # ── 인증 토큰 ─────────────────────────────────────────────────────────────
    fetch_token = get_or_create_token()
    log.info(
        "[fetcher] auth token (백엔드 .env의 FETCHER_TOKEN에 동일하게 설정하세요): %s",
        fetch_token,
    )

    async def verify_token(authorization: str = Header(default="")) -> None:
        if not authorization or not secrets.compare_digest(authorization, f"Bearer {fetch_token}"):
            raise HTTPException(status_code=401, detail="missing or invalid Fetcher token")

    # ── 상태 객체 ─────────────────────────────────────────────────────────────
    keystore = KeyStore()
    if enable_cache:
        QueryExecutor.configure(cache=MemoryCache())

    # ── 키 관리 UI (tray "API 키 설정" 클릭 시 열리는 페이지) ────────────────
    def _ui_html() -> str:
        base = getattr(sys, "_MEIPASS", None) or Path(__file__).parent.parent
        p = Path(base) / "assets" / "keys_ui.html"
        if not p.exists():
            p = Path(__file__).parent.parent / "assets" / "keys_ui.html"
        html = p.read_text(encoding="utf-8") if p.exists() else "<h1>UI 파일 없음</h1>"
        return html.replace("__FETCHER_TOKEN__", fetch_token)

    @app.get("/", response_class=HTMLResponse, include_in_schema=False)
    async def keys_ui() -> HTMLResponse:
        return HTMLResponse(_ui_html())

    # ── 헬스 / 메타 ───────────────────────────────────────────────────────────
    @app.get("/health")
    async def health(response: Response) -> Dict[str, Any]:
        response.headers["Access-Control-Allow-Origin"] = "*"
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
    @app.post("/fetch", dependencies=[Depends(verify_token)])
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
    @app.get("/keys", dependencies=[Depends(verify_token)])
    async def list_keys() -> List[Dict[str, object]]:
        return keystore.status()

    @app.post("/keys", dependencies=[Depends(verify_token)])
    async def set_key(req: KeyRequest) -> Dict[str, str]:
        if req.fields:
            cleaned = {k: v.strip() for k, v in req.fields.items() if v and v.strip()}
            if not cleaned:
                raise HTTPException(status_code=400, detail="fields are empty")
            keystore.set_fields(req.provider, cleaned)
        else:
            if not (req.api_key and req.api_key.strip()):
                raise HTTPException(status_code=400, detail="api_key is empty")
            keystore.set(req.provider, req.api_key.strip())
        return {"status": "ok", "provider": req.provider.lower()}

    @app.delete("/keys/{provider}", dependencies=[Depends(verify_token)])
    async def delete_key(provider: str) -> Dict[str, str]:
        if not keystore.delete(provider):
            raise HTTPException(status_code=404, detail=f"no key for '{provider}'")
        return {"status": "deleted", "provider": provider.lower()}

    return app

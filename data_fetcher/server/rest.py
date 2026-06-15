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

import asyncio
import logging
import os
import secrets
import sys
from contextlib import asynccontextmanager
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

# 독립 실행 Fetcher가 Tauri 주입 없이도 합류할 클라우드 백엔드 기본 WS 주소.
# 환경변수 FETCHER_BACKEND_WS_URL로 덮어쓸 수 있다(빈 문자열로 설정하면 합류 비활성).
_DEFAULT_BACKEND_WS_URL = "wss://api.finance.dns-co.kr/ws/fetcher"

# 웹앱이 loopback으로 /health·/user-token을 호출할 수 있도록 기본 허용하는 origin.
# (민감 엔드포인트는 별도 Fetcher 토큰으로 보호되므로 origin 허용만으로 노출되지 않는다.)
_DEFAULT_WEB_ORIGINS = [
    "https://finance.dns-co.kr",
    "https://frontend-yup2devs-projects.vercel.app",  # Vercel 운영 프론트 — /user-token(토큰 전달)이 CORS로 막히지 않게
    "tauri://localhost",
    "http://tauri.localhost",
    "https://tauri.localhost",
    "http://localhost:5173",
    "http://localhost:5174",
    "http://localhost:5175",
]


class FetchRequest(BaseModel):
    provider: str
    model: str
    params: Dict[str, Any] = {}
    ttl: Optional[int] = None  # None → 모델별 기본 TTL, 0 → 캐시 안 함


class KeyRequest(BaseModel):
    provider: str
    api_key: Optional[str] = None              # 단일 키 provider (fmp/polygon/…)
    fields: Optional[Dict[str, str]] = None    # 다중 필드 provider (kis: appkey/appsecret)


class UserTokenRequest(BaseModel):
    token: str


@asynccontextmanager
async def _lifespan(app: FastAPI):
    """백엔드 /ws/fetcher 워커 풀에 합류한다(클라우드 기본값 내장).

    WS 주소: FETCHER_BACKEND_WS_URL 환경변수가 있으면 그 값, 미설정이면 클라우드 기본값
    (_DEFAULT_BACKEND_WS_URL). 빈 문자열로 명시 설정하면 합류를 비활성화한다(로컬 전용).
    → 독립 실행 Fetcher도 Tauri 주입 없이 클라우드 풀에 합류한다.

    인증은 '사용자 로그인 JWT'. 데스크톱 앱이 로그인/갱신 시 토큰 파일
    (~/.marketpulse_fetcher/user_token)을 기록하면, 워커가 매 접속 시 이를 읽어 접속한다.
    토큰이 아직 없으면(로그인 전) 보류하고 주기적으로 재확인한다(재시작 불필요).
    """
    raw = os.getenv("FETCHER_BACKEND_WS_URL")
    ws_url = _DEFAULT_BACKEND_WS_URL if raw is None else raw.strip()
    task: Optional[asyncio.Task] = None
    if ws_url:
        from data_fetcher.server.auth import get_user_token
        from data_fetcher.server.ws_worker import run_ws_worker

        task = asyncio.create_task(run_ws_worker(ws_url, get_user_token))
        log.info("[fetcher] WS 워커 풀 합류 대기 → %s (로그인 토큰 감지 시 접속)", ws_url)
    else:
        log.info("[fetcher] FETCHER_BACKEND_WS_URL='' → 워커 풀 합류 비활성(로컬 전용)")

    yield

    if task:
        task.cancel()


def create_app(
    allowed_origins: Optional[List[str]] = None,
    enable_cache: bool = True,
) -> FastAPI:
    app = FastAPI(title="MarketPulse Fetcher", version="0.1.0", lifespan=_lifespan)

    # ── CORS ──────────────────────────────────────────────────────────────────
    # 민감 엔드포인트(/fetch, /keys)는 Fetcher 토큰으로 보호된다. 웹앱이 /health 와
    # /user-token(로그인 토큰 전달)을 loopback으로 호출할 수 있도록, 웹 origin을 기본
    # 허용한다. FETCHER_ALLOWED_ORIGINS로 추가 가능.
    origins = list(_DEFAULT_WEB_ORIGINS) + (allowed_origins or [])
    from fastapi.middleware.cors import CORSMiddleware
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=False,  # 키 보호: 쿠키/자격증명 동반 요청 비허용
        allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
        allow_headers=["*"],
    )
    log.info("[fetcher] CORS allowed origins: %s", origins)

    # Private Network Access(PNA): HTTPS 공개 페이지(finance.dns-co.kr 등)가 loopback
    # (127.0.0.1)으로 보내는 preflight를 크롬이 차단한다 — 응답에
    # Access-Control-Allow-Private-Network: true 가 있어야 통과한다. CORSMiddleware는
    # 이 헤더를 넣지 않으므로 여기서 보강한다(웹 로그인 시 /user-token 전달이 막히던 원인).
    @app.middleware("http")
    async def _allow_private_network(request, call_next):
        response = await call_next(request)
        if request.headers.get("access-control-request-private-network") == "true":
            response.headers["Access-Control-Allow-Private-Network"] = "true"
        return response

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
    app.state.keystore = keystore  # WS 워커(keys_* 위임 처리)가 같은 인스턴스를 공유
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

    # ── 로그인 토큰 수신 (웹앱이 loopback으로 전달) ─────────────────────────────
    # 웹 로그인 후 브라우저가 이 PC의 Fetcher에 JWT를 전달 → 워커가 클라우드 풀에 합류.
    # Fetcher 토큰 인증은 없다(웹은 그 값을 모름). CORS origin 허용으로 보호한다.
    # 토큰의 유효성은 클라우드 백엔드가 /ws/fetcher 접속 시 검증한다(여기선 저장만).
    @app.post("/user-token")
    async def set_user_token(req: UserTokenRequest) -> Dict[str, str]:
        from data_fetcher.server.auth import write_user_token
        if not (req.token and req.token.strip()):
            raise HTTPException(status_code=400, detail="token is empty")
        write_user_token(req.token)
        return {"status": "ok"}

    @app.delete("/user-token")
    async def delete_user_token() -> Dict[str, str]:
        from data_fetcher.server.auth import clear_user_token
        clear_user_token()
        return {"status": "cleared"}

    # ── 종료 (웹 '종료' 버튼이 loopback으로 호출) ──────────────────────────────
    # 브라우저는 로컬 프로세스를 직접 못 죽이므로, Fetcher가 자기 자신을 종료한다.
    # /user-token과 동일하게 origin 허용으로 보호(민감 데이터 없음).
    @app.post("/shutdown")
    async def shutdown() -> Dict[str, str]:
        import threading
        import time as _time

        def _stop() -> None:
            _time.sleep(0.25)  # HTTP 응답이 나갈 여유를 준 뒤 종료
            os._exit(0)        # 트레이/서버 스레드 포함 프로세스 전체를 확실히 종료

        threading.Thread(target=_stop, daemon=True).start()
        log.info("[fetcher] /shutdown 요청 — 프로세스 종료")
        return {"status": "stopping"}

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

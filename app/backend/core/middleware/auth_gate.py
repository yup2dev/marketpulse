"""인증 게이트 미들웨어 — deny-by-default.

main.py 에서 분리했다. 공개 경로 목록과 게이트 로직이 한 파일에 있어야, "이 경로를
공개해도 되나"를 판단할 때 볼 곳이 한 군데로 모인다.
"""
import json

from app.backend.core.config import settings

# deny-by-default: 아래 공개 목록에 없는 모든 HTTP 경로는 유효한 Bearer 토큰을 요구합니다.
# 401 응답 → 프론트엔드 apiClient가 refresh 시도 → 실패 시 forceLogout() → /login 이동
#
# 예전에는 `/api/` 로 시작하는 경로만 검사(allow-by-default)했다. 그래서 `/api/` 밖에
# 추가된 운영 엔드포인트(`/cache/*`, `/circuit-breakers/*`, `/fetcher-workers`)가 조용히
# 무인증으로 공개됐다 — `DELETE /cache/{prefix}` 로 누구나 운영 캐시를 날릴 수 있었다.
# 그 엔드포인트들은 routes/admin.py(`/api/admin/*`, require_admin)로 옮겼고, 같은 실수가
# 재발하지 않도록 게이트를 뒤집었다. 새 경로는 기본적으로 '막힌 상태'로 태어난다.
PUBLIC_PATHS = frozenset({
    "/",          # 앱 이름·버전 (업타임 체크)
    "/health",    # 헬스체크 (Docker/LB)
})
PUBLIC_PREFIXES = (
    "/api/auth/login",
    "/api/auth/register",
    "/api/auth/refresh",
)
# OpenAPI 문서는 브라우저가 Bearer 없이 여는 페이지라 게이트를 통과시킬 수밖에 없다.
# 운영에서 API 스키마를 공개할 이유가 없으므로 DEBUG=true 일 때만 연다.
# (운영에서 잠깐 봐야 하면 코드 수정 없이 DEBUG 환경변수로 켤 수 있다.)
DOCS_PATHS = frozenset({
    "/docs",
    "/docs/oauth2-redirect",
    "/redoc",
    "/openapi.json",
})


async def _send_json(send, status: int, detail: str, extra_headers=None) -> None:
    body = json.dumps({"detail": detail}).encode()
    headers = [(b"content-type", b"application/json"),
               (b"content-length", str(len(body)).encode())]
    headers += (extra_headers or [])
    await send({"type": "http.response.start", "status": status, "headers": headers})
    await send({"type": "http.response.body", "body": body})


class AuthGateMiddleware:
    """순수 ASGI 인증 게이트 (deny-by-default).

    @app.middleware("http")(=BaseHTTPMiddleware)는 downstream을 별도 task로 실행해
    여기서 set한 current_user_id contextvar가 실 uvicorn 런타임에서 엔드포인트까지
    전파되지 않는다(요청이 user_id=None으로 보여 Fetcher 위임 실패). 순수 ASGI
    미들웨어는 같은 컨텍스트에서 downstream을 호출하므로 contextvar가 정상 전파된다.

    CORS가 최외곽이 되도록 이 미들웨어를 CORSMiddleware보다 먼저 add 한다.
    """

    def __init__(self, app):
        self.app = app

    @staticmethod
    def _is_public(path: str) -> bool:
        if path in PUBLIC_PATHS:
            return True
        if any(path.startswith(p) for p in PUBLIC_PREFIXES):
            return True
        if settings.DEBUG and path in DOCS_PATHS:
            return True
        return False

    async def __call__(self, scope, receive, send):
        # WebSocket(/ws/quotes, /ws/fetcher)은 핸들러가 직접 토큰을 검증한다.
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        path = scope.get("path", "")
        method = scope.get("method", "")
        # CORS preflight와 공개 경로만 통과 — 나머지는 전부 Bearer 검사
        if method == "OPTIONS" or self._is_public(path):
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

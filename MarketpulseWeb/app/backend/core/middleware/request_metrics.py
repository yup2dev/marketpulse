"""요청 계측 미들웨어 — 경로별 횟수 · 지연 · 오류를 services/monitor_service 에 더한다.

순수 ASGI 로 쓴다 (BaseHTTPMiddleware 는 응답을 한 번 더 감싸 스트리밍·WS 에 부담이 된다).
HTTP 만 센다 — WebSocket 은 연결이 오래 살아 있어 '처리 중'을 가린다. /health 는 도커 점검이 30초마다
부르므로 빼서 실제 사용자 요청만 보이게 한다. 모니터링 화면이 스스로 보내는 요청(/api/admin/monitor/*)도
뺀다 — 몇 초마다 폴링하므로 '처리 중'·경로 표를 제 요청으로 채운다.

경로는 라우팅이 고른 템플릿(`/api/stock/history/{symbol}`)으로 묶는다 — 종목마다 줄이 늘지 않게.
템플릿은 scope["route"] 에서 읽되, FastAPI 버전에 따라 바깥 scope 에 남지 않으므로(0.163 은 라우팅을
따로 된 scope 에서 한다) 없으면 앱의 라우트 표에서 직접 찾는다. 찾은 결과는 경로별로 기억해 둔다.
"""
from starlette.routing import Match

from app.backend.services import monitor_service

SKIP_PATHS = frozenset({"/health"})
SKIP_PREFIXES = ("/api/admin/monitor/",)
UNMATCHED = "(경로 없음)"
_TEMPLATE_CACHE: dict = {}
_TEMPLATE_CACHE_MAX = 2000   # 이상한 경로가 쏟아져도 메모리가 늘지 않게 — 넘치면 비우고 다시 쌓는다


def route_template(scope) -> str:
    """요청 경로 → 라우트 템플릿 (`/api/stock/history/AAPL` → `/api/stock/history/{symbol}`)."""
    route = scope.get("route")
    found = getattr(route, "path_format", None) or getattr(route, "path", None)
    if found:
        return found
    key = (scope.get("method", ""), scope.get("path", ""))
    hit = _TEMPLATE_CACHE.get(key)
    if hit is not None:
        return hit
    found = UNMATCHED
    app = scope.get("app")
    partial = None
    for r in getattr(app, "routes", None) or []:
        try:
            match, _ = r.matches(scope)
        except Exception:
            continue
        if match == Match.FULL:
            found = getattr(r, "path_format", None) or getattr(r, "path", UNMATCHED)
            break
        if match == Match.PARTIAL and partial is None:   # 경로는 맞고 메서드만 다름 (405)
            partial = getattr(r, "path_format", None) or getattr(r, "path", None)
    else:
        found = partial or UNMATCHED
    if len(_TEMPLATE_CACHE) >= _TEMPLATE_CACHE_MAX:
        _TEMPLATE_CACHE.clear()
    _TEMPLATE_CACHE[key] = found
    return found


class RequestMetricsMiddleware:
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        path = scope.get("path", "")
        if (scope["type"] != "http" or path in SKIP_PATHS or path.startswith(SKIP_PREFIXES)
                or scope.get("method") == "OPTIONS"):
            await self.app(scope, receive, send)
            return

        token = monitor_service.record_start(scope.get("method", ""), path)
        status = {"code": 500}

        async def send_wrapper(message):
            if message["type"] == "http.response.start":
                status["code"] = message["status"]
            await send(message)

        try:
            await self.app(scope, receive, send_wrapper)
        finally:
            monitor_service.record_end(token, route_template(scope), status["code"])

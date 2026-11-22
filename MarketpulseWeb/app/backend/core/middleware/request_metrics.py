"""요청 계측 미들웨어 — 경로별 횟수 · 지연 · 오류를 services/monitor_service 에 더한다.

순수 ASGI 로 쓴다 (BaseHTTPMiddleware 는 응답을 한 번 더 감싸 스트리밍·WS 에 부담이 된다).
HTTP 만 센다 — WebSocket 은 연결이 오래 살아 있어 '처리 중'을 가린다. /health 는 도커 점검이 30초마다
부르므로 빼서 실제 사용자 요청만 보이게 한다. 모니터링 화면이 스스로 보내는 요청(/api/admin/monitor/*)도
뺀다 — 몇 초마다 폴링하므로 '처리 중'·경로 표를 제 요청으로 채운다.

경로는 라우팅이 고른 템플릿(`/api/stock/history/{symbol}`)으로 묶는다 — 종목마다 줄이 늘지 않게.
FastAPI 0.163(운영·CI)은 라우팅을 따로 된 scope 에서 해 미들웨어의 scope 에 route 가 남지 않는다.
그래서 미들웨어가 scope 에 빈 칸(dict)을 넣어 두고, 앱 전체 의존성 capture_route 가 라우트가 정해진 뒤
그 칸에 템플릿을 적는다 (하위 scope 는 키를 복사하므로 같은 dict 를 가리킨다). 공개 API 만 쓴다.
"""
from starlette.requests import HTTPConnection

from app.backend.services import monitor_service

SKIP_PATHS = frozenset({"/health"})
SKIP_PREFIXES = ("/api/admin/monitor/",)
UNMATCHED = "(경로 없음)"
SCOPE_KEY = "marketpulse.metrics"


def full_template(path: str, path_format: str, path_params: dict) -> str:
    """라우트 템플릿에 include prefix 를 붙인다.

    FastAPI 0.163 의 route.path_format 은 라우터 기준(`/user-widgets/prefs/{widget_type}`)이라 앞의
    include prefix(`/api`)가 없다. 실제 경로에서 템플릿을 채운 꼬리를 뺀 앞부분이 prefix 다.
    (예전 버전은 path_format 이 이미 전체 경로라 prefix 가 빈 문자열이 된다)
    """
    try:
        rendered = path_format.format(**{k: str(v) for k, v in (path_params or {}).items()})
    except (KeyError, IndexError, ValueError):
        return path_format
    if rendered and path.endswith(rendered):
        return path[: len(path) - len(rendered)] + path_format
    return path_format


def capture_route(request: HTTPConnection) -> None:
    """앱 전체 의존성 (main.py) — 라우트가 정해진 요청에서 템플릿을 미들웨어의 칸에 적는다.

    앱 전체 의존성은 웹소켓 라우트에도 붙는다 — `Request` 로 받으면 웹소켓에서는 채울 값이 없어
    연결이 500 으로 거절된다. 둘의 공통 부모 `HTTPConnection` 으로 받는다 (웹소켓은 칸이 없어 아무것도 안 한다).
    """
    slot = request.scope.get(SCOPE_KEY)
    route = request.scope.get("route")
    fmt = getattr(route, "path_format", None) or getattr(route, "path", None)
    if slot is not None and fmt:
        slot["template"] = full_template(request.scope.get("path", ""), fmt, request.scope.get("path_params"))


def route_template(scope) -> str:
    slot = scope.get(SCOPE_KEY) or {}
    if slot.get("template"):
        return slot["template"]
    route = scope.get("route")   # 예전 FastAPI 는 바깥 scope 에 남긴다 · 의존성이 없는 Starlette 라우트
    return getattr(route, "path_format", None) or getattr(route, "path", None) or UNMATCHED


class RequestMetricsMiddleware:
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        path = scope.get("path", "")
        if (scope["type"] != "http" or path in SKIP_PATHS or path.startswith(SKIP_PREFIXES)
                or scope.get("method") == "OPTIONS"):
            await self.app(scope, receive, send)
            return

        scope[SCOPE_KEY] = {}
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

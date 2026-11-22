"""요청 계측 미들웨어 — 경로별 횟수 · 지연 · 오류를 services/monitor_service 에 더한다.

순수 ASGI 로 쓴다 (BaseHTTPMiddleware 는 응답을 한 번 더 감싸 스트리밍·WS 에 부담이 된다).
HTTP 만 센다 — WebSocket 은 연결이 오래 살아 있어 '처리 중'을 가린다. /health 는 도커 점검이 30초마다
부르므로 빼서 실제 사용자 요청만 보이게 한다. 모니터링 화면이 스스로 보내는 요청(/api/admin/monitor/*)도
뺀다 — 몇 초마다 폴링하므로 '처리 중'·경로 표를 제 요청으로 채운다.

경로는 라우팅이 고른 템플릿(`/api/stock/history/{symbol}`)으로 묶는다 — 종목마다 줄이 늘지 않게.
"""
from app.backend.services import monitor_service

SKIP_PATHS = frozenset({"/health"})
SKIP_PREFIXES = ("/api/admin/monitor/",)


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
            route = scope.get("route")
            template = getattr(route, "path", None) or "(경로 없음)"
            monitor_service.record_end(token, template, status["code"])

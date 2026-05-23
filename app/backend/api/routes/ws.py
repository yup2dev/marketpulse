"""WebSocket — 실시간 주가 스트리밍."""
import asyncio
import json
import logging
from typing import Dict, Set

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from app.backend.auth.security import decode_token
from app.backend.services.yahoo.price import get_stock_quote

log = logging.getLogger(__name__)
router = APIRouter()

QUOTE_INTERVAL = 15  # 초


class _Connection:
    """단일 WebSocket 연결 상태."""
    def __init__(self, ws: WebSocket):
        self.ws = ws
        self.symbols: Set[str] = set()


class ConnectionManager:
    def __init__(self):
        self._conns: Dict[int, _Connection] = {}

    def add(self, ws: WebSocket) -> _Connection:
        conn = _Connection(ws)
        self._conns[id(ws)] = conn
        return conn

    def remove(self, ws: WebSocket):
        self._conns.pop(id(ws), None)

    async def broadcast_quotes(self, quotes: dict, targets: list[_Connection]):
        payload = json.dumps({"type": "quote", "data": quotes})
        for conn in targets:
            try:
                await conn.ws.send_text(payload)
            except Exception:
                pass


manager = ConnectionManager()


async def _stream_quotes(conn: _Connection):
    """연결별 quote 스트리밍 루프."""
    while True:
        await asyncio.sleep(QUOTE_INTERVAL)
        if not conn.symbols:
            continue
        quotes: dict = {}
        tasks = {sym: asyncio.create_task(get_stock_quote(sym)) for sym in conn.symbols}
        for sym, task in tasks.items():
            try:
                q = await task
                if q:
                    quotes[sym] = {
                        "price":          q.get("price"),
                        "change":         q.get("change"),
                        "change_percent": q.get("change_percent"),
                        "volume":         q.get("volume"),
                        "high":           q.get("high"),
                        "low":            q.get("low"),
                        "open":           q.get("open"),
                        "timestamp":      str(q.get("timestamp") or ""),
                    }
            except Exception:
                pass
        if quotes:
            try:
                await conn.ws.send_text(json.dumps({"type": "quote", "data": quotes}))
            except Exception:
                break


@router.websocket("/ws/quotes")
async def ws_quotes(
    websocket: WebSocket,
    token: str = Query(default=""),
):
    """
    실시간 주가 WebSocket.

    연결 후 클라이언트 → 서버 메시지 형식:
      {"action": "subscribe",   "symbols": ["AAPL", "TSLA"]}
      {"action": "unsubscribe", "symbols": ["AAPL"]}

    서버 → 클라이언트 push:
      {"type": "quote", "data": {"AAPL": {price, change, change_percent, ...}}}
      {"type": "error", "message": "..."}
    """
    # JWT 검증 (선택적 — 토큰 없으면 인증 없이 허용)
    user_id = None
    if token:
        payload = decode_token(token)
        if payload is None:
            await websocket.close(code=4001, reason="Invalid token")
            return
        user_id = payload.get("sub")

    await websocket.accept()
    conn = manager.add(websocket)
    log.info(f"WS /quotes connected user={user_id}")

    stream_task = asyncio.create_task(_stream_quotes(conn))

    try:
        while True:
            raw = await websocket.receive_text()
            try:
                msg = json.loads(raw)
            except json.JSONDecodeError:
                await websocket.send_text(json.dumps({"type": "error", "message": "Invalid JSON"}))
                continue

            action = msg.get("action")
            symbols = [s.upper() for s in (msg.get("symbols") or []) if isinstance(s, str)]

            if action == "subscribe" and symbols:
                conn.symbols.update(symbols)
                # 즉시 첫 quote 전송
                quotes: dict = {}
                tasks = {sym: asyncio.create_task(get_stock_quote(sym)) for sym in symbols}
                for sym, task in tasks.items():
                    try:
                        q = await task
                        if q:
                            quotes[sym] = {
                                "price":          q.get("price"),
                                "change":         q.get("change"),
                                "change_percent": q.get("change_percent"),
                                "volume":         q.get("volume"),
                                "high":           q.get("high"),
                                "low":            q.get("low"),
                                "open":           q.get("open"),
                                "timestamp":      str(q.get("timestamp") or ""),
                            }
                    except Exception:
                        pass
                if quotes:
                    await websocket.send_text(json.dumps({"type": "quote", "data": quotes}))

            elif action == "unsubscribe" and symbols:
                conn.symbols.difference_update(symbols)

            elif action == "ping":
                await websocket.send_text(json.dumps({"type": "pong"}))

    except WebSocketDisconnect:
        pass
    except Exception as exc:
        log.warning(f"WS /quotes error: {exc}")
    finally:
        stream_task.cancel()
        manager.remove(websocket)
        log.info(f"WS /quotes disconnected user={user_id}")

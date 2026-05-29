"""WebSocket — 실시간 주가 스트리밍."""
import asyncio
import json
import logging
from typing import Dict, Set

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query

from app.backend.core.auth.security import decode_token
from app.backend.services.ranking_service import get_live_quotes_subset

log = logging.getLogger(__name__)
router = APIRouter()

QUOTE_INTERVAL = 10   # 초 — 공유 캐시는 ~60초마다 갱신되므로 과도한 push 방지


# ── 배치 시세 조회 (base 랭킹과 동일한 공유 캐시 사용) ─────────────────────────

async def _batch_live_quotes(symbols_key: str) -> Dict[str, dict]:
    """
    WS용 배치 실시간 시세. base 랭킹과 같은 캐시를 읽어 등락률 기준을 일치시킨다.
    Returns {sym: {price, change, change_percent, volume}}.
    """
    symbols = [s for s in symbols_key.split(',') if s]
    return await get_live_quotes_subset(symbols)


def _symbols_key(symbols: Set[str]) -> str:
    return ','.join(sorted(symbols))


# ── Connection / Manager ──────────────────────────────────────────────────────

class _Connection:
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


manager = ConnectionManager()


async def _stream_quotes(conn: _Connection):
    """연결별 quote 스트리밍 루프 (5초 간격, 배치 조회)."""
    while True:
        await asyncio.sleep(QUOTE_INTERVAL)
        if not conn.symbols:
            continue

        key = _symbols_key(conn.symbols)
        quotes = await _batch_live_quotes(key)
        if not quotes:
            continue
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
    실시간 주가 WebSocket (배치 yf.download 기반, 5초 interval).

    클라이언트 → 서버:
      {"action": "subscribe",   "symbols": ["AAPL", "TSLA"]}
      {"action": "unsubscribe", "symbols": ["AAPL"]}
      {"action": "ping"}

    서버 → 클라이언트:
      {"type": "quote", "data": {"AAPL": {price, change, change_percent, volume}}}
    """
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

    # 연결 즉시 종목 리스트 전송 (캐시 HIT 시 <1s)
    try:
        from app.backend.services.stock_list_service import get_stock_list
        stock_list = await get_stock_list()
        await websocket.send_text(json.dumps({"type": "STOCK_LIST", "data": stock_list}))
    except Exception as exc:
        log.warning(f"WS /quotes: failed to send STOCK_LIST: {exc}")

    stream_task = asyncio.create_task(_stream_quotes(conn))

    try:
        while True:
            raw = await websocket.receive_text()
            try:
                msg = json.loads(raw)
            except json.JSONDecodeError:
                await websocket.send_text(json.dumps({"type": "error", "message": "Invalid JSON"}))
                continue

            action  = msg.get("action")
            symbols = [s.upper() for s in (msg.get("symbols") or []) if isinstance(s, str)]

            if action == "subscribe" and symbols:
                conn.symbols.update(symbols)
                # 구독 즉시 첫 batch quote 전송
                key = _symbols_key(conn.symbols)
                quotes = await _batch_live_quotes(key)
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

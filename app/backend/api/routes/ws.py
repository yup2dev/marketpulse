"""
WebSocket — 실시간 주가 스트리밍 (Redis Pub/Sub fan-out)

흐름:
  1. 클라이언트 연결 → ConnectionManager에 등록
  2. 워커의 quote-갱신 루프가 새 시세를 Redis CH_QUOTES 채널에 publish
  3. 이 워커의 Pub/Sub 핸들러가 메시지를 수신 → 자기 프로세스 연결에 fan-out
  4. 클라이언트가 subscribe/unsubscribe 전송 시 관심 심볼 필터링

멀티워커 격리 문제 해결:
  - 기존: ConnectionManager가 프로세스 로컬 dict → 워커A 클라이언트는 워커B 갱신을 못 받음
  - 이후: 갱신 시 Redis에 publish → 모든 워커가 동시에 수신 → 각 워커가 자기 클라이언트에 전달

단일 워커 / Redis 없는 환경:
  - pubsub.is_redis_available() == False → 기존 인프로세스 폴링 루프 유지 (하위 호환)

클라이언트 → 서버:
  {"action": "subscribe",   "symbols": ["AAPL", "TSLA"]}
  {"action": "unsubscribe", "symbols": ["AAPL"]}
  {"action": "ping"}

서버 → 클라이언트:
  {"type": "quote",      "data": {"AAPL": {price, change, change_percent, volume}}}
  {"type": "STOCK_LIST", "data": [...]}
  {"type": "pong"}
  {"type": "error",      "message": "..."}
"""
import asyncio
import json
import logging
from typing import Dict, Optional, Set

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query

from app.backend.core.auth.security import decode_token
from app.backend.core.fetcher_pool import fetcher_pool
from app.backend.core.pubsub import (
    CH_QUOTES, CH_STOCK_LIST,
    get_broker, is_redis_available,
)
from app.backend.services.ranking_service import get_live_quotes_subset

log = logging.getLogger(__name__)
router = APIRouter()

# 단일 워커 폴백 시 사용하는 폴링 간격
QUOTE_INTERVAL = 10


# ── 연결 관리 ─────────────────────────────────────────────────────────────────

class _Connection:
    def __init__(self, ws: WebSocket):
        self.ws = ws
        self.symbols: Set[str] = set()


class ConnectionManager:
    """
    이 워커 프로세스에 연결된 WS 클라이언트 관리.
    Redis fan-out 핸들러가 여기서 실제 send를 수행.
    """

    def __init__(self):
        self._conns: Dict[int, _Connection] = {}

    def add(self, ws: WebSocket) -> _Connection:
        conn = _Connection(ws)
        self._conns[id(ws)] = conn
        return conn

    def remove(self, ws: WebSocket) -> None:
        self._conns.pop(id(ws), None)

    def count(self) -> int:
        return len(self._conns)

    async def broadcast(self, channel: str, payload: dict) -> None:
        """
        Redis 핸들러가 호출 — 이 워커의 모든 연결 중 관심 심볼을 가진 것에 전송.
        channel == CH_QUOTES  → symbols 필터링
        channel == CH_STOCK_LIST → 전체 브로드캐스트
        """
        if not self._conns:
            return

        msg_type = payload.get("type")
        dead = []

        for conn_id, conn in list(self._conns.items()):
            try:
                if msg_type == "quote":
                    # 클라이언트가 구독하는 심볼만 포함하여 전송
                    if conn.symbols:
                        filtered = {
                            sym: data
                            for sym, data in (payload.get("data") or {}).items()
                            if sym in conn.symbols
                        }
                        if filtered:
                            await conn.ws.send_text(json.dumps({
                                "type": "quote", "data": filtered
                            }))
                else:
                    # STOCK_LIST 등 필터 없이 전체 전달
                    await conn.ws.send_text(json.dumps(payload))
            except Exception:
                dead.append(conn_id)

        for cid in dead:
            self._conns.pop(cid, None)


manager = ConnectionManager()


# ── Pub/Sub 핸들러 등록 (앱 시작 시 1회) ─────────────────────────────────────

def _on_pubsub_message(payload: dict) -> None:
    """Redis에서 메시지 도착 → manager.broadcast 스케줄."""
    asyncio.ensure_future(manager.broadcast(
        payload.get("channel", ""), payload
    ))


def register_pubsub_handlers() -> None:
    """lifespan startup에서 호출 (Redis 사용 시)."""
    if not is_redis_available():
        return
    broker = get_broker()

    async def on_quotes(payload):
        await manager.broadcast(CH_QUOTES, payload)

    async def on_stock_list(payload):
        await manager.broadcast(CH_STOCK_LIST, payload)

    broker.add_handler(CH_QUOTES, on_quotes)
    broker.add_handler(CH_STOCK_LIST, on_stock_list)
    log.info("[ws] Pub/Sub handlers registered")


# ── Quote 갱신 루프 ───────────────────────────────────────────────────────────

def _all_subscribed_symbols() -> Set[str]:
    """이 워커 기준 현재 구독 중인 모든 심볼 합집합."""
    result: Set[str] = set()
    for conn in manager._conns.values():
        result.update(conn.symbols)
    return result


async def quote_publisher_loop() -> None:
    """
    백그라운드 루프:
    - 구독자가 있을 때만 시세 조회
    - Redis 있으면 CH_QUOTES에 publish (전 워커 fan-out)
    - Redis 없으면 직접 manager.broadcast (단일 워커 폴백)
    """
    log.info("[ws] Quote publisher loop started (redis=%s)", is_redis_available())
    while True:
        await asyncio.sleep(QUOTE_INTERVAL)
        symbols = _all_subscribed_symbols()
        if not symbols:
            continue
        try:
            quotes = await get_live_quotes_subset(list(symbols))
            if not quotes:
                continue
            payload = {"type": "quote", "data": quotes}
            if is_redis_available():
                await get_broker().publish(CH_QUOTES, payload)
            else:
                await manager.broadcast(CH_QUOTES, payload)
        except Exception as e:
            log.warning("[ws] quote publisher error: %s", e)


# ── StreamFetcher 기반 실시간 루프 (Polygon WebSocket 사용 시) ──────────────────

async def stream_fetcher_loop(symbols: Optional[Set[str]] = None) -> None:
    """
    StreamFetcher(Polygon WebSocket)에서 직접 시세를 수신해 Redis CH_QUOTES에 publish.

    quote_publisher_loop (yfinance 폴링) 대신 사용하면 진짜 실시간 스트리밍 가능.
    POLYGON_API_KEY가 없으면 조용히 종료 — quote_publisher_loop가 폴링으로 백업.

    Args:
        symbols: 초기 구독 심볼 집합. None이면 연결된 클라이언트의 구독 심볼 사용.
    """
    import os
    api_key = os.getenv("POLYGON_API_KEY", "")
    if not api_key:
        log.info("[ws] POLYGON_API_KEY not set — StreamFetcher disabled, using poll loop")
        return

    try:
        from data_fetcher.providers.polygon.stream import PolygonStreamFetcher
    except ImportError as e:
        log.warning("[ws] StreamFetcher import failed: %s", e)
        return

    async def on_message(msg: dict) -> None:
        sym = msg.get("symbol")
        if not sym:
            return
        payload = {"type": "quote", "data": {sym: {
            "price":          msg.get("price"),
            "change":         msg.get("change"),
            "change_percent": msg.get("change_percent"),
            "volume":         msg.get("volume"),
        }}}
        if is_redis_available():
            await get_broker().publish(CH_QUOTES, payload)
        else:
            await manager.broadcast(CH_QUOTES, payload)

    fetcher = PolygonStreamFetcher(credentials={"api_key": api_key}, mode="delayed")

    # 초기 심볼 결정: 인수 또는 현재 구독자 기준
    init_symbols = list(symbols or _all_subscribed_symbols())
    if not init_symbols:
        init_symbols = ["SPY"]  # 연결 유지용 더미

    log.info("[ws] StreamFetcher starting with %d symbols", len(init_symbols))
    await fetcher.run(init_symbols, on_message=on_message)


# ── KIS(한국투자증권) 실시간 체결 루프 ────────────────────────────────────────

# DB exchange 명 → KIS 해외 거래소 코드
_KIS_EXCH = {"NASDAQ": "NAS", "NYSE": "NYS", "AMEX": "AMS"}


async def _build_kis_exchange_map() -> Dict[str, str]:
    """DB 유니버스(USD 종목)에서 표준심볼 → KIS 거래소코드 맵 구성.
    해외 종목 구독 키(DNASAAPL) 생성에 필요. 국내 종목은 불필요."""
    try:
        from app.backend.services.stock_list_service import get_stock_list
        from app.backend.services._base import to_quote_symbol
        stocks = await get_stock_list()
    except Exception as e:
        log.warning("[ws] KIS exchange_map 구성 실패: %s", e)
        return {}

    out: Dict[str, str] = {}
    for s in stocks:
        exch = _KIS_EXCH.get((s.get("exchange") or "").upper())
        if not exch or (s.get("curr") or "USD") == "KRW":
            continue
        sym = to_quote_symbol(s["ticker_cd"], s.get("exchange"), s.get("curr")).upper()
        out[sym] = exch
    return out


async def _kis_sync_loop(fetcher, interval: float = 5.0) -> None:
    """화면에 보이는 심볼(최대 41)로 KIS 구독을 주기적으로 reconcile.
    랭킹 '순서'는 DB 스냅샷이 담당하고, KIS는 보이는 행만 실시간 구독한다."""
    from data_fetcher.providers.kis.stream import MAX_SUBSCRIPTIONS
    while True:
        await asyncio.sleep(interval)
        if not getattr(fetcher, "is_connected", False):
            continue
        # 국내(.KS/.KQ·6자리) 우선 — KIS가 커버하는 대상
        visible = list(_all_subscribed_symbols())[:MAX_SUBSCRIPTIONS]
        want = set(visible)
        have = fetcher.subscribed_symbols
        add = list(want - have)
        remove = list(have - want)
        if add or remove:
            try:
                await fetcher.update_symbols(add=add, remove=remove)
            except Exception as e:
                log.warning("[ws] KIS sync error: %s", e)


async def kis_stream_loop(env: str = "real") -> None:
    """KIS WebSocket 실시간 체결 → Redis CH_QUOTES publish.

    KIS_APPKEY/KIS_APPSECRET 미설정 시 조용히 종료(yfinance 폴링이 백업).
    동시 구독 한도(41)로 화면 보이는 행만 _kis_sync_loop가 동기화한다.
    """
    import os
    appkey = os.getenv("KIS_APPKEY", "")
    appsecret = os.getenv("KIS_APPSECRET", "")
    if not (appkey and appsecret):
        log.info("[ws] KIS_APPKEY/SECRET not set — KIS stream disabled")
        return

    try:
        from data_fetcher.providers.kis.stream import KISStreamFetcher
    except ImportError as e:
        log.warning("[ws] KIS stream import failed: %s", e)
        return

    exchange_map = await _build_kis_exchange_map()
    log.info("[ws] KIS exchange_map: %d overseas symbols", len(exchange_map))

    async def on_message(msg: dict) -> None:
        sym = msg.get("symbol")
        if not sym:
            return
        payload = {"type": "quote", "data": {sym: {
            "price":          msg.get("price"),
            "change":         msg.get("change"),
            "change_percent": msg.get("change_percent"),
            "volume":         msg.get("volume"),
        }}}
        if is_redis_available():
            await get_broker().publish(CH_QUOTES, payload)
        else:
            await manager.broadcast(CH_QUOTES, payload)

    fetcher = KISStreamFetcher(
        credentials={"appkey": appkey, "appsecret": appsecret},
        env=env,
        exchange_map=exchange_map,
    )

    init_symbols = list(_all_subscribed_symbols())[:41]
    sync_task = asyncio.create_task(_kis_sync_loop(fetcher))
    try:
        log.info("[ws] KIS stream starting (env=%s, %d init symbols)", env, len(init_symbols))
        await fetcher.run(init_symbols, on_message=on_message)
    finally:
        sync_task.cancel()


# ── 단일 워커 폴백 루프 (Redis 없을 때) ──────────────────────────────────────

async def _stream_quotes_fallback(conn: _Connection) -> None:
    """기존 per-connection 루프 (Redis 없을 때 사용)."""
    while True:
        await asyncio.sleep(QUOTE_INTERVAL)
        if not conn.symbols:
            continue
        try:
            quotes = await get_live_quotes_subset(list(conn.symbols))
            if quotes:
                await conn.ws.send_text(json.dumps({"type": "quote", "data": quotes}))
        except Exception:
            break


# ── WebSocket 엔드포인트 ──────────────────────────────────────────────────────

@router.websocket("/ws/quotes")
async def ws_quotes(
    websocket: WebSocket,
    token: str = Query(default=""),
):
    # JWT 검증 (선택 — 토큰 없으면 익명 허용)
    user_id = None
    if token:
        payload = decode_token(token)
        if payload is None:
            await websocket.close(code=4001, reason="Invalid token")
            return
        user_id = payload.get("sub")

    await websocket.accept()
    conn = manager.add(websocket)
    log.info("[ws] connected user=%s total=%d", user_id, manager.count())

    # 연결 즉시 종목 리스트 전송
    try:
        from app.backend.services.stock_list_service import get_stock_list
        stock_list = await get_stock_list()
        payload = {"type": "STOCK_LIST", "data": stock_list}
        await websocket.send_text(json.dumps(payload))
        # Redis 있으면 다른 워커도 동일 리스트를 갱신받을 수 있도록 publish
        if is_redis_available():
            await get_broker().publish(CH_STOCK_LIST, payload)
    except Exception as exc:
        log.warning("[ws] STOCK_LIST send failed: %s", exc)

    # Redis 없는 환경에서는 per-connection 폴링 루프 유지
    fallback_task = None
    if not is_redis_available():
        fallback_task = asyncio.create_task(_stream_quotes_fallback(conn))

    # 하트비트 (30초) — 죽은 연결 조기 감지
    async def _heartbeat():
        while True:
            await asyncio.sleep(30)
            try:
                await websocket.send_text(json.dumps({"type": "ping"}))
            except Exception:
                break

    heartbeat_task = asyncio.create_task(_heartbeat())

    try:
        while True:
            raw = await websocket.receive_text()
            try:
                msg = json.loads(raw)
            except json.JSONDecodeError:
                await websocket.send_text(json.dumps({
                    "type": "error", "message": "Invalid JSON"
                }))
                continue

            action = msg.get("action")
            symbols = [
                s.upper() for s in (msg.get("symbols") or [])
                if isinstance(s, str)
            ]

            if action == "subscribe" and symbols:
                conn.symbols.update(symbols)
                # 구독 즉시 첫 시세 전송
                try:
                    quotes = await get_live_quotes_subset(list(conn.symbols))
                    if quotes:
                        await websocket.send_text(json.dumps({
                            "type": "quote", "data": quotes
                        }))
                except Exception as e:
                    log.warning("[ws] immediate quote fetch failed: %s", e)

            elif action == "unsubscribe" and symbols:
                conn.symbols.difference_update(symbols)

            elif action == "ping":
                await websocket.send_text(json.dumps({"type": "pong"}))

    except WebSocketDisconnect:
        pass
    except Exception as exc:
        log.warning("[ws] connection error: %s", exc)
    finally:
        heartbeat_task.cancel()
        if fallback_task:
            fallback_task.cancel()
        manager.remove(websocket)
        log.info("[ws] disconnected user=%s total=%d", user_id, manager.count())


# ── 사용자 PC Fetcher 워커 (push 위임) ─────────────────────────────────────────

@router.websocket("/ws/fetcher")
async def ws_fetcher(
    websocket: WebSocket,
    token: str = Query(default=""),
):
    """사용자 PC의 Fetcher가 outbound로 접속해 '그 사용자의 워커'로 등록되는 엔드포인트.

    인증: 사용자 로그인 JWT(access token)를 쿼리 파라미터 token=으로 전달한다.
    데스크톱 앱이 로그인 후 발급받은 access token을 Fetcher에 주입한다.
    토큰의 sub(user_id)로 워커를 등록해, 그 사용자의 요청만 이 워커로 위임된다.
    유효하지 않으면 연결을 거부한다.
    """
    payload = decode_token(token) if token else None
    # 워커 전용 'fetcher' 토큰(장수명)을 우선 허용. 'access'는 구버전 Fetcher 호환용.
    # refresh 토큰은 거부한다.
    if payload is None or payload.get("type") not in ("fetcher", "access"):
        await websocket.close(code=4001, reason="Invalid or missing token")
        return
    user_id = str(payload.get("sub") or "")
    if not user_id:
        await websocket.close(code=4001, reason="Token missing subject")
        return

    await websocket.accept()
    worker_id = fetcher_pool.register(websocket, user_id)
    log.info("[fetcher-ws] worker connected user=%s total=%d", user_id, fetcher_pool.count())

    try:
        while True:
            raw = await websocket.receive_text()
            try:
                msg = json.loads(raw)
            except json.JSONDecodeError:
                continue
            await fetcher_pool.handle_message(worker_id, msg)
    except WebSocketDisconnect:
        pass
    except Exception as exc:
        log.warning("[fetcher-ws] connection error: %s", exc)
    finally:
        fetcher_pool.unregister(worker_id)
        log.info("[fetcher-ws] worker disconnected user=%s total=%d", user_id, fetcher_pool.count())

"""
Redis Pub/Sub 브로커 — 멀티워커 WebSocket fan-out

구조:
  ┌──────────┐   publish(channel, msg)    ┌─────────────────────────────┐
  │ 워커 A   │ ─────────────────────────► │  Redis                      │
  │ (quotes  │                            │  Channel: ws:quotes         │
  │  갱신)   │                            │  Channel: ws:stock_list     │
  └──────────┘                            └─────────┬───────────────────┘
                                                    │ subscribe
                                         ┌──────────┴──────────┐
                                         ▼                      ▼
                                      워커 A                  워커 B
                                  (자기 연결로 send)       (자기 연결로 send)

Redis 없이 단일 워커 환경에서는 인메모리 큐로 폴백 → 기존 동작 유지.
"""
import asyncio
import json
import logging
from typing import Any, Callable, Dict, Optional

log = logging.getLogger(__name__)

# ── 채널 이름 상수 ─────────────────────────────────────────────────────────────
CH_QUOTES     = "ws:quotes"       # {"type":"quote","data":{sym:{price,...}}}
CH_STOCK_LIST = "ws:stock_list"   # {"type":"STOCK_LIST","data":[...]}


class _InMemoryFallback:
    """Redis 없을 때: 프로세스 내부 asyncio.Queue fan-out."""

    def __init__(self):
        self._subscribers: Dict[str, list[asyncio.Queue]] = {}

    async def publish(self, channel: str, message: str) -> None:
        for q in self._subscribers.get(channel, []):
            try:
                q.put_nowait(message)
            except asyncio.QueueFull:
                pass

    def subscribe(self, channel: str) -> asyncio.Queue:
        q: asyncio.Queue = asyncio.Queue(maxsize=256)
        self._subscribers.setdefault(channel, []).append(q)
        return q

    def unsubscribe(self, channel: str, q: asyncio.Queue) -> None:
        lst = self._subscribers.get(channel, [])
        try:
            lst.remove(q)
        except ValueError:
            pass

    async def close(self) -> None:
        self._subscribers.clear()


class RedisPubSubBroker:
    """
    Redis Pub/Sub 래퍼.

    - publish(): 어느 워커에서든 채널에 메시지 게시
    - subscribe(): 구독 핸들러 등록 (워커 시작 시 한 번)
    - 연결 실패/끊김 시 자동 재연결 (지수 백오프)
    """

    def __init__(self, redis_url: str):
        self._url = redis_url
        self._pub_client = None          # 게시 전용 클라이언트
        self._sub_client = None          # 구독 전용 클라이언트
        self._pubsub = None
        self._handlers: Dict[str, list[Callable]] = {}
        self._listener_task: Optional[asyncio.Task] = None
        self._ready = asyncio.Event()
        self._closed = False

    # ── 공개 API ──────────────────────────────────────────────────────────────

    async def start(self) -> None:
        """앱 lifespan startup에서 호출."""
        await self._connect()
        self._listener_task = asyncio.create_task(self._listen_loop())

    async def publish(self, channel: str, payload: Any) -> None:
        """dict/list를 JSON 직렬화하여 채널에 게시."""
        if self._pub_client is None:
            return
        msg = json.dumps(payload, default=str)
        try:
            await self._pub_client.publish(channel, msg)
        except Exception as e:
            log.warning("[pubsub] publish error on %s: %s", channel, e)

    def add_handler(self, channel: str, handler: Callable[[Any], None]) -> None:
        """채널 메시지 수신 시 호출할 콜백 등록 (sync or async)."""
        self._handlers.setdefault(channel, []).append(handler)

    def remove_handler(self, channel: str, handler: Callable) -> None:
        lst = self._handlers.get(channel, [])
        try:
            lst.remove(handler)
        except ValueError:
            pass

    async def close(self) -> None:
        self._closed = True
        if self._listener_task:
            self._listener_task.cancel()
        if self._pubsub:
            await self._pubsub.close()
        if self._sub_client:
            await self._sub_client.aclose()
        if self._pub_client:
            await self._pub_client.aclose()
        log.info("[pubsub] closed")

    # ── 내부 구현 ──────────────────────────────────────────────────────────────

    async def _connect(self) -> None:
        import redis.asyncio as aioredis
        self._pub_client = aioredis.from_url(
            self._url, decode_responses=True,
            socket_connect_timeout=3, socket_timeout=3,
        )
        self._sub_client = aioredis.from_url(
            self._url, decode_responses=True,
            socket_connect_timeout=3, socket_timeout=None,  # subscribe는 블로킹
        )
        self._pubsub = self._sub_client.pubsub(ignore_subscribe_messages=True)
        channels = list(self._handlers.keys()) or [CH_QUOTES, CH_STOCK_LIST]
        await self._pubsub.subscribe(*channels)
        self._ready.set()
        log.info("[pubsub] connected to %s, subscribed: %s", self._url, channels)

    async def _listen_loop(self) -> None:
        """Redis에서 메시지 수신 → 등록 핸들러 호출. 재연결 포함."""
        backoff = 1.0
        while not self._closed:
            try:
                await self._ready.wait()
                async for raw in self._pubsub.listen():
                    if self._closed:
                        return
                    channel = raw.get("channel")
                    data_str = raw.get("data")
                    if not channel or not isinstance(data_str, str):
                        continue
                    try:
                        payload = json.loads(data_str)
                    except json.JSONDecodeError:
                        payload = data_str
                    for handler in self._handlers.get(channel, []):
                        try:
                            result = handler(payload)
                            if asyncio.iscoroutine(result):
                                await result
                        except Exception as e:
                            log.warning("[pubsub] handler error: %s", e)
                backoff = 1.0
            except asyncio.CancelledError:
                return
            except Exception as e:
                if self._closed:
                    return
                log.warning("[pubsub] listen error (%s), reconnect in %.1fs", e, backoff)
                self._ready.clear()
                await asyncio.sleep(backoff)
                backoff = min(backoff * 2, 30.0)
                try:
                    await self._connect()
                except Exception as ce:
                    log.warning("[pubsub] reconnect failed: %s", ce)


# ── 싱글톤 ────────────────────────────────────────────────────────────────────

_broker: Optional[RedisPubSubBroker] = None
_fallback: Optional[_InMemoryFallback] = None


def get_broker() -> RedisPubSubBroker:
    """초기화 전 호출하면 RuntimeError."""
    if _broker is None:
        raise RuntimeError("PubSub broker not initialized. Call init_pubsub() first.")
    return _broker


async def init_pubsub(redis_url: Optional[str] = None) -> None:
    """
    lifespan startup에서 호출.
    redis_url이 None이거나 연결 실패 시 인메모리 폴백.
    """
    global _broker, _fallback
    if not redis_url:
        log.info("[pubsub] Redis URL not set — using in-memory fallback")
        _fallback = _InMemoryFallback()
        return
    try:
        broker = RedisPubSubBroker(redis_url)
        await broker.start()
        _broker = broker
        log.info("[pubsub] Redis Pub/Sub ready")
    except Exception as e:
        log.warning("[pubsub] Redis unavailable (%s) — using in-memory fallback", e)
        _fallback = _InMemoryFallback()


async def close_pubsub() -> None:
    """lifespan shutdown에서 호출."""
    global _broker, _fallback
    if _broker:
        await _broker.close()
        _broker = None
    if _fallback:
        await _fallback.close()
        _fallback = None


def is_redis_available() -> bool:
    return _broker is not None

"""
Polygon.io WebSocket 실시간 주가 스트림

Polygon WebSocket API:
  - wss://socket.polygon.io/stocks  (유료 실시간)
  - wss://delayed.polygon.io/stocks (무료 15분 지연)

인증 흐름:
  connected → {"action":"auth","params":"API_KEY"} → {"status":"auth_success"}
  → {"action":"subscribe","params":"A.AAPL,A.TSLA"} → 메시지 수신

메시지 타입:
  ev=A  : 집계(Aggregate) — 초당 OHLCV
  ev=T  : Trade           — 개별 체결
  ev=Q  : Quote           — Bid/Ask

이 구현은 ev=A(집계)를 기본으로 사용한다.
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
from datetime import datetime, timezone
from typing import Any, AsyncIterator, Dict, List, Optional

try:
    import websockets
    _HAS_WS = True
except ImportError:
    _HAS_WS = False

from data_fetcher.abstract_provider.abstract.stream import StreamFetcher, StreamFetcherError

log = logging.getLogger(__name__)

# 유료 플랜: socket.polygon.io, 무료(지연): delayed.polygon.io
_WS_URLS = {
    "realtime": "wss://socket.polygon.io/stocks",
    "delayed":  "wss://delayed.polygon.io/stocks",
}

# Polygon 집계 채널 prefix (A=aggregate, T=trade, Q=quote)
_CHANNEL_PREFIX = "A"


class PolygonStreamFetcher(StreamFetcher):
    """
    Polygon.io WebSocket 실시간(또는 지연) 주가 집계 스트림.

    Args:
        credentials: {"api_key": "YOUR_KEY"} 또는 None → 환경변수 POLYGON_API_KEY
        mode:        "realtime" | "delayed" (기본 "delayed")

    Example:
        fetcher = PolygonStreamFetcher()
        await fetcher.run(["AAPL", "NVDA"], on_message=handle_quote)
    """

    provider = "polygon"
    reconnect_delay = 3.0
    max_reconnects = 0  # 무한 재연결

    def __init__(
        self,
        credentials: Optional[Dict[str, str]] = None,
        mode: str = "delayed",
    ):
        super().__init__(credentials)
        if not _HAS_WS:
            raise ImportError("websockets package required: pip install websockets")
        self._mode = mode
        self._ws = None
        self._api_key: str = (
            (credentials or {}).get("api_key")
            or os.getenv("POLYGON_API_KEY", "")
        )
        if not self._api_key:
            raise StreamFetcherError(
                "Polygon API key required. Set POLYGON_API_KEY env var."
            )

    # ── StreamFetcher 구현 ────────────────────────────────────────────────────

    async def connect(self) -> None:
        url = _WS_URLS[self._mode]
        log.info("[polygon-stream] connecting to %s", url)
        self._ws = await websockets.connect(url, ping_interval=20, ping_timeout=10)

        # 첫 메시지: {"ev":"status","status":"connected"}
        raw = await self._ws.recv()
        msgs = json.loads(raw)
        status = msgs[0].get("status") if msgs else ""
        if status != "connected":
            raise StreamFetcherError(f"Unexpected connect response: {msgs}")

        # 인증
        await self._ws.send(json.dumps({"action": "auth", "params": self._api_key}))
        raw = await self._ws.recv()
        msgs = json.loads(raw)
        if not any(m.get("status") == "auth_success" for m in msgs):
            raise StreamFetcherError(f"Auth failed: {msgs}")

        self._connected = True
        log.info("[polygon-stream] authenticated (%s)", self._mode)

    async def subscribe(self, symbols: List[str]) -> None:
        if not symbols or not self._ws:
            return
        channels = ",".join(f"{_CHANNEL_PREFIX}.{sym.upper()}" for sym in symbols)
        await self._ws.send(json.dumps({"action": "subscribe", "params": channels}))
        log.info("[polygon-stream] subscribed: %s", channels)

    async def unsubscribe(self, symbols: List[str]) -> None:
        if not symbols or not self._ws:
            return
        channels = ",".join(f"{_CHANNEL_PREFIX}.{sym.upper()}" for sym in symbols)
        await self._ws.send(json.dumps({"action": "unsubscribe", "params": channels}))
        log.info("[polygon-stream] unsubscribed: %s", channels)

    async def stream(self) -> AsyncIterator[Dict[str, Any]]:
        if not self._ws:
            raise StreamFetcherError("Not connected. Call connect() first.")
        async for raw in self._ws:
            try:
                messages = json.loads(raw)
            except json.JSONDecodeError:
                continue
            for msg in messages:
                normalized = self.normalize(msg)
                if normalized:
                    yield normalized

    async def close(self) -> None:
        self._connected = False
        if self._ws:
            try:
                await self._ws.close()
            except Exception:
                pass
            self._ws = None
        log.info("[polygon-stream] closed")

    def normalize(self, raw: Any) -> Optional[Dict[str, Any]]:
        """
        Polygon 집계 메시지(ev=A) → 표준 quote dict.

        raw 예시:
            {"ev":"A","sym":"AAPL","o":200.1,"h":200.5,"l":199.9,"c":200.3,"v":1234,"s":1718000000000}
        """
        if not isinstance(raw, dict):
            return None
        ev = raw.get("ev")
        if ev != _CHANNEL_PREFIX:
            return None  # status/auth 메시지 등 무시

        sym = raw.get("sym", "")
        close = raw.get("c")
        if not sym or close is None:
            return None

        ts_ms = raw.get("s") or raw.get("e")
        timestamp = None
        if ts_ms:
            try:
                timestamp = datetime.fromtimestamp(ts_ms / 1000, tz=timezone.utc).isoformat()
            except Exception:
                pass

        vwap = raw.get("vw")
        prev_close = raw.get("op")  # official prior close (optional)
        change = round(close - prev_close, 4) if prev_close else None
        change_pct = round((close - prev_close) / prev_close * 100, 4) if prev_close else None

        return {
            "symbol":         sym,
            "price":          round(float(close), 4),
            "open":           raw.get("o"),
            "high":           raw.get("h"),
            "low":            raw.get("l"),
            "volume":         raw.get("v"),
            "vwap":           vwap,
            "change":         change,
            "change_percent": change_pct,
            "timestamp":      timestamp,
        }

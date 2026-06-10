"""
StreamFetcher — 실시간 WebSocket 스트림 전용 추상 클래스

REST 기반 Fetcher(단발 요청/응답)와 달리, StreamFetcher는 장기 유지 WebSocket
연결을 통해 지속적으로 데이터를 수신한다.

사용 흐름:
    fetcher = PolygonStreamFetcher(api_key="...")
    await fetcher.connect()
    await fetcher.subscribe(["AAPL", "TSLA"])

    async for msg in fetcher.stream():
        # msg: {"symbol": "AAPL", "price": 200.5, "change": 1.2, ...}
        await redis_broker.publish(CH_QUOTES, {"type": "quote", "data": {msg["symbol"]: msg}})

    await fetcher.close()
"""
from __future__ import annotations

import asyncio
import logging
from abc import ABC, abstractmethod
from typing import Any, AsyncIterator, Callable, Dict, List, Optional

log = logging.getLogger(__name__)


class StreamFetcherError(Exception):
    """StreamFetcher 전용 오류."""


class StreamFetcher(ABC):
    """
    WebSocket 실시간 스트림 추상 기반 클래스.

    서브클래스가 구현해야 할 메서드:
        connect()       — WebSocket 연결 수립 + 인증
        subscribe()     — 심볼 구독 요청 전송
        unsubscribe()   — 심볼 구독 해제 요청 전송
        stream()        — 정규화된 메시지를 yield하는 AsyncIterator
        close()         — 연결 종료 + 리소스 정리
        normalize()     — provider raw 메시지 → 표준 dict 변환
    """

    provider: str = "unknown"
    reconnect_delay: float = 3.0
    max_reconnects: int = 10

    def __init__(self, credentials: Optional[Dict[str, str]] = None):
        self.credentials = credentials or {}
        self._subscribed: set[str] = set()
        self._connected = False
        self._reconnect_count = 0

    @abstractmethod
    async def connect(self) -> None:
        """WebSocket 연결 수립 및 인증."""

    @abstractmethod
    async def subscribe(self, symbols: List[str]) -> None:
        """심볼 구독 요청."""

    @abstractmethod
    async def unsubscribe(self, symbols: List[str]) -> None:
        """심볼 구독 해제."""

    @abstractmethod
    async def stream(self) -> AsyncIterator[Dict[str, Any]]:
        """정규화된 시세 메시지를 yield.

        Yields:
            {"symbol": str, "price": float, "change": float|None,
             "change_percent": float|None, "volume": int|None, "timestamp": str|None}
        """

    @abstractmethod
    async def close(self) -> None:
        """연결 종료 및 리소스 해제."""

    @abstractmethod
    def normalize(self, raw: Any) -> Optional[Dict[str, Any]]:
        """provider raw 메시지 → 표준 dict. 무시할 메시지면 None 반환."""

    async def run(
        self,
        symbols: List[str],
        on_message: Callable[[Dict[str, Any]], Any],
    ) -> None:
        """백그라운드 태스크용 진입점 — 재연결 루프 포함."""
        self._subscribed = set(symbols)
        attempt = 0

        while True:
            try:
                log.info("[%s] connecting (attempt %d)...", self.provider, attempt + 1)
                await self.connect()
                await self.subscribe(list(self._subscribed))
                self._reconnect_count = 0
                attempt = 0

                async for msg in self.stream():
                    result = on_message(msg)
                    if asyncio.iscoroutine(result):
                        await result

            except asyncio.CancelledError:
                log.info("[%s] stream cancelled", self.provider)
                await self.close()
                return
            except Exception as e:
                log.warning("[%s] stream error: %s", self.provider, e)
            finally:
                self._connected = False
                try:
                    await self.close()
                except Exception:
                    pass

            attempt += 1
            if self.max_reconnects and attempt >= self.max_reconnects:
                log.error("[%s] max reconnects (%d) reached", self.provider, self.max_reconnects)
                return

            delay = min(self.reconnect_delay * (2 ** min(attempt, 5)), 60.0)
            log.info("[%s] reconnecting in %.1fs...", self.provider, delay)
            await asyncio.sleep(delay)

    async def update_symbols(self, add: List[str] = (), remove: List[str] = ()) -> None:
        """런타임 심볼 추가/제거."""
        if add:
            new = [s for s in add if s not in self._subscribed]
            if new:
                await self.subscribe(new)
                self._subscribed.update(new)
        if remove:
            existing = [s for s in remove if s in self._subscribed]
            if existing:
                await self.unsubscribe(existing)
                self._subscribed.difference_update(existing)

    @property
    def subscribed_symbols(self) -> set[str]:
        return set(self._subscribed)

    @property
    def is_connected(self) -> bool:
        return self._connected

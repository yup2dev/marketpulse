"""PC Fetcher(server/runner.py)의 인메모리 TTL 캐시 — 단일 사용자 로컬 Fetcher에 충분."""
from __future__ import annotations

import time
from typing import Any, Dict, Optional, Tuple


class MemoryCache:
    def __init__(self) -> None:
        self._store: Dict[str, Tuple[float, Any]] = {}

    async def get(self, key: str) -> Optional[Any]:
        item = self._store.get(key)
        if item is None:
            return None
        expires_at, value = item
        if expires_at < time.time():
            self._store.pop(key, None)
            return None
        return value

    async def set(self, key: str, value: Any, ttl: int) -> None:
        self._store[key] = (time.time() + ttl, value)

"""QueryExecutor용 인메모리 TTL 캐시 — 단일 사용자 로컬 Fetcher에 충분.

CacheProtocol(get/set) 만 만족하면 QueryExecutor가 캐시·SWR·single-flight를
그대로 적용한다. 동일 심볼을 반복 조회해도 외부 provider를 매번 때리지 않는다.
"""
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

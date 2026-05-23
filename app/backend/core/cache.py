"""캐싱 계층 — Redis 우선, 폴백 인메모리.

사용법:
    from app.backend.core.cache import cached

    @cached(ttl=3600)
    async def get_something(symbol: str) -> dict: ...
"""
import asyncio
import json
import logging
import time
from functools import wraps
from typing import Any, Callable, Optional

log = logging.getLogger(__name__)

# --------------------------------------------------------------------------- #
# JSON 직렬화
# --------------------------------------------------------------------------- #

class _JsonEncoder(json.JSONEncoder):
    def default(self, obj):
        if hasattr(obj, "model_dump"):      # Pydantic v2
            return obj.model_dump()
        if hasattr(obj, "dict"):            # Pydantic v1
            return obj.dict()
        if hasattr(obj, "__dict__"):
            return obj.__dict__
        return super().default(obj)


def _serialize(value: Any) -> Optional[str]:
    try:
        return json.dumps(value, cls=_JsonEncoder, default=str)
    except Exception:
        return None


# --------------------------------------------------------------------------- #
# 백엔드 구현
# --------------------------------------------------------------------------- #

class _InMemoryBackend:
    def __init__(self):
        self._store: dict[str, tuple[Any, float]] = {}
        self._lock = asyncio.Lock()
        self._hits = 0
        self._misses = 0

    async def get(self, key: str) -> Optional[str]:
        async with self._lock:
            item = self._store.get(key)
            if item is None:
                self._misses += 1
                return None
            value, expiry = item
            if expiry and time.monotonic() > expiry:
                del self._store[key]
                self._misses += 1
                return None
            self._hits += 1
            return value

    async def set(self, key: str, value: str, ttl: int) -> None:
        async with self._lock:
            expiry = time.monotonic() + ttl if ttl > 0 else 0.0
            self._store[key] = (value, expiry)

    async def delete(self, key: str) -> None:
        async with self._lock:
            self._store.pop(key, None)

    async def delete_prefix(self, prefix: str) -> int:
        async with self._lock:
            keys = [k for k in self._store if k.startswith(prefix)]
            for k in keys:
                del self._store[k]
            return len(keys)

    async def close(self) -> None:
        pass

    def stats(self) -> dict:
        total = self._hits + self._misses
        return {
            "backend": "memory",
            "keys": len(self._store),
            "hits": self._hits,
            "misses": self._misses,
            "hit_rate": round(self._hits / total, 3) if total else 0.0,
        }


class _RedisBackend:
    def __init__(self, url: str):
        self._url = url
        self._client = None
        self._hits = 0
        self._misses = 0

    async def connect(self) -> bool:
        try:
            import redis.asyncio as aioredis
            client = aioredis.from_url(
                self._url,
                decode_responses=True,
                socket_connect_timeout=2,
                socket_timeout=2,
            )
            await client.ping()
            self._client = client
            log.info(f"[Cache] Redis connected: {self._url}")
            return True
        except Exception as e:
            log.warning(f"[Cache] Redis unavailable ({e}), using in-memory fallback")
            return False

    async def get(self, key: str) -> Optional[str]:
        try:
            val = await self._client.get(key)
            if val is None:
                self._misses += 1
            else:
                self._hits += 1
            return val
        except Exception:
            self._misses += 1
            return None

    async def set(self, key: str, value: str, ttl: int) -> None:
        try:
            await self._client.setex(key, ttl, value)
        except Exception:
            pass

    async def delete(self, key: str) -> None:
        try:
            await self._client.delete(key)
        except Exception:
            pass

    async def delete_prefix(self, prefix: str) -> int:
        try:
            keys = await self._client.keys(f"{prefix}*")
            if keys:
                return await self._client.delete(*keys)
            return 0
        except Exception:
            return 0

    async def close(self) -> None:
        if self._client:
            await self._client.aclose()

    def stats(self) -> dict:
        total = self._hits + self._misses
        return {
            "backend": "redis",
            "url": self._url,
            "hits": self._hits,
            "misses": self._misses,
            "hit_rate": round(self._hits / total, 3) if total else 0.0,
        }


# --------------------------------------------------------------------------- #
# CacheManager
# --------------------------------------------------------------------------- #

class CacheManager:
    def __init__(self):
        self._backend: Optional[_InMemoryBackend | _RedisBackend] = None
        self._initialized = False

    async def init(self, redis_url: Optional[str] = None) -> None:
        if redis_url:
            backend = _RedisBackend(redis_url)
            if await backend.connect():
                self._backend = backend
                self._initialized = True
                return
        self._backend = _InMemoryBackend()
        self._initialized = True
        log.info("[Cache] Using in-memory backend")

    def _ensure_init(self):
        if not self._initialized:
            self._backend = _InMemoryBackend()
            self._initialized = True

    async def get(self, key: str) -> Optional[Any]:
        self._ensure_init()
        raw = await self._backend.get(key)
        if raw is None:
            return None
        try:
            return json.loads(raw)
        except Exception:
            return raw

    async def set(self, key: str, value: Any, ttl: int) -> None:
        self._ensure_init()
        serialized = _serialize(value)
        if serialized is not None:
            await self._backend.set(key, serialized, ttl)

    async def delete(self, key: str) -> None:
        self._ensure_init()
        await self._backend.delete(key)

    async def invalidate_prefix(self, prefix: str) -> int:
        self._ensure_init()
        return await self._backend.delete_prefix(prefix)

    async def close(self) -> None:
        if self._backend:
            await self._backend.close()

    def stats(self) -> dict:
        self._ensure_init()
        return self._backend.stats()

    @property
    def backend_type(self) -> str:
        if isinstance(self._backend, _RedisBackend):
            return "redis"
        return "memory"


# 싱글톤
cache = CacheManager()


# --------------------------------------------------------------------------- #
# @cached 데코레이터
# --------------------------------------------------------------------------- #

_PRIMITIVE_TYPES = (str, int, float, bool, list, dict, tuple, type(None))


def _build_key(func: Callable, args: tuple, kwargs: dict) -> str:
    """캐시 키 생성 (클래스 메서드의 self/cls 제외)."""
    key_args = args
    if args and not isinstance(args[0], _PRIMITIVE_TYPES):
        key_args = args[1:]
    return f"{func.__module__}.{func.__qualname__}:{key_args!r}:{sorted(kwargs.items())!r}"


def cached(ttl: int):
    """비동기 함수 캐시 데코레이터.

    Args:
        ttl: 캐시 유효 시간(초). 0이면 캐싱 안 함.
    """
    def decorator(func: Callable):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            if ttl <= 0:
                return await func(*args, **kwargs)

            key = _build_key(func, args, kwargs)
            hit = await cache.get(key)
            if hit is not None:
                log.debug("[Cache HIT] %s", key[:100])
                return hit

            result = await func(*args, **kwargs)
            if result is not None:
                await cache.set(key, result, ttl)
            return result

        wrapper._cached = True
        wrapper._ttl = ttl
        return wrapper
    return decorator

import json
import hashlib
import pickle
from typing import Any, Optional
from pathlib import Path
import logging

# redis는 선택적 의존성 — 없으면 파일 캐시만 사용
try:
    import redis as _redis_lib
    _HAS_REDIS = True
except ImportError:
    _redis_lib = None
    _HAS_REDIS = False

logger = logging.getLogger(__name__)


class CacheManager:
    def __init__(
        self,
        redis_url: str = "redis://localhost:6379",
        local_cache_dir: str = "./cache",
        default_ttl: int = 3600
    ):
        self.redis_client = None
        self.use_redis = False

        if _HAS_REDIS:
            try:
                self.redis_client = _redis_lib.from_url(redis_url)
                self.redis_client.ping()
                self.use_redis = True
                logger.info("Redis cache connected")
            except Exception:
                self.redis_client = None
                self.use_redis = False
                logger.info("Redis unavailable, using local file cache only")
        else:
            logger.info("redis package not installed, using local file cache only")

        self.local_cache_dir = Path(local_cache_dir)
        self.local_cache_dir.mkdir(exist_ok=True)
        self.default_ttl = default_ttl

    def get_cache_key(
        self,
        provider: str,
        category: str,
        params: dict
    ) -> str:
        params_str = json.dumps(params, sort_keys=True, default=str)
        key = f"{provider}:{category}:{params_str}"
        return hashlib.md5(key.encode()).hexdigest()

    async def get(
        self,
        provider: str,
        category: str,
        params: dict
    ) -> Optional[Any]:
        key = self.get_cache_key(provider, category, params)

        if self.use_redis:
            try:
                cached = self.redis_client.get(key)
                if cached:
                    return pickle.loads(cached)
            except Exception:
                pass

        local_path = self.local_cache_dir / f"{key}.pkl"
        if local_path.exists():
            try:
                with open(local_path, 'rb') as f:
                    return pickle.load(f)
            except Exception:
                pass

        return None

    async def set(
        self,
        provider: str,
        category: str,
        params: dict,
        data: Any,
        ttl: Optional[int] = None
    ) -> None:
        key = self.get_cache_key(provider, category, params)
        ttl = ttl or self.default_ttl

        if self.use_redis:
            try:
                self.redis_client.setex(key, ttl, pickle.dumps(data))
            except Exception:
                pass

        local_path = self.local_cache_dir / f"{key}.pkl"
        try:
            with open(local_path, 'wb') as f:
                pickle.dump(data, f)
        except Exception:
            pass

    async def clear(self, pattern: str = "*") -> None:
        if self.use_redis:
            try:
                keys = self.redis_client.keys(pattern)
                if keys:
                    self.redis_client.delete(*keys)
            except Exception:
                pass

        if pattern == "*":
            for p in self.local_cache_dir.glob("*.pkl"):
                p.unlink(missing_ok=True)

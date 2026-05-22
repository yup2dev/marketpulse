# data_fetcher/utils/cache.py

import json
import hashlib
import pickle
from datetime import datetime, timedelta
from typing import Any, Optional, Callable
from pathlib import Path
import redis

class CacheManager:
    """통합 캐싱 관리 (Redis + Local File)"""
    
    def __init__(
        self,
        redis_url: str = "redis://localhost:6379",
        local_cache_dir: str = "./cache",
        default_ttl: int = 3600
    ):
        """
        Parameters
        ----------
        redis_url : str
            Redis 연결 URL
        local_cache_dir : str
            로컬 캐시 디렉토리
        default_ttl : int
            기본 TTL (초)
        """
        try:
            self.redis_client = redis.from_url(redis_url)
            self.use_redis = True
        except Exception:
            self.redis_client = None
            self.use_redis = False
        
        self.local_cache_dir = Path(local_cache_dir)
        self.local_cache_dir.mkdir(exist_ok=True)
        self.default_ttl = default_ttl
    
    def get_cache_key(
        self,
        provider: str,
        category: str,
        params: dict
    ) -> str:
        """캐시 키 생성"""
        # params를 정렬된 JSON으로 변환
        params_str = json.dumps(params, sort_keys=True)
        key = f"{provider}:{category}:{params_str}"
        
        # 해시로 짧게 변환
        return hashlib.md5(key.encode()).hexdigest()
    
    async def get(
        self,
        provider: str,
        category: str,
        params: dict
    ) -> Optional[Any]:
        """캐시 조회"""
        key = self.get_cache_key(provider, category, params)
        
        # Redis 먼저 확인
        if self.use_redis:
            try:
                cached = self.redis_client.get(key)
                if cached:
                    return pickle.loads(cached)
            except Exception:
                pass
        
        # 로컬 파일 확인
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
        """캐시 저장"""
        key = self.get_cache_key(provider, category, params)
        ttl = ttl or self.default_ttl
        
        # Redis에 저장
        if self.use_redis:
            try:
                self.redis_client.setex(
                    key,
                    ttl,
                    pickle.dumps(data)
                )
            except Exception:
                pass
        
        # 로컬 파일에도 저장
        local_path = self.local_cache_dir / f"{key}.pkl"
        try:
            with open(local_path, 'wb') as f:
                pickle.dump(data, f)
        except Exception:
            pass
    
    async def clear(self, pattern: str = "*") -> None:
        """캐시 삭제"""
        if self.use_redis:
            try:
                keys = self.redis_client.keys(pattern)
                if keys:
                    self.redis_client.delete(*keys)
            except Exception:
                pass



# data_fetcher/utils/exceptions.py

class FetcherError(Exception):
    """기본 Fetcher 에러"""
    pass

class ProviderError(FetcherError):
    """Provider 에러"""
    pass

class APIError(ProviderError):
    """API 에러"""
    def __init__(self, provider: str, status_code: int, message: str):
        self.provider = provider
        self.status_code = status_code
        super().__init__(f"{provider} API Error ({status_code}): {message}")

class RateLimitError(APIError):
    """Rate Limit 초과"""
    pass

class AuthenticationError(APIError):
    """인증 실패"""
    pass

class DataValidationError(FetcherError):
    """데이터 검증 실패"""
    pass

class NetworkError(FetcherError):
    """네트워크 에러"""
    pass


# data_fetcher/utils/error_handler.py

import asyncio
import logging
from typing import Callable, Any, Optional
from functools import wraps

logger = logging.getLogger(__name__)

class ErrorHandler:
    """통합 에러 처리"""
    
    def __init__(
        self,
        max_retries: int = 3,
        retry_delay: float = 1.0,
        backoff_factor: float = 2.0
    ):
        self.max_retries = max_retries
        self.retry_delay = retry_delay
        self.backoff_factor = backoff_factor
    
    def retry_on_error(
        self,
        exceptions: tuple = (Exception,),
        backoff: bool = True,
        on_retry: Optional[Callable] = None
    ):
        """재시도 데코레이터"""
        def decorator(func):
            @wraps(func)
            async def async_wrapper(*args, **kwargs):
                delay = self.retry_delay
                last_exception = None
                
                for attempt in range(1, self.max_retries + 1):
                    try:
                        return await func(*args, **kwargs)
                    except exceptions as e:
                        last_exception = e
                        
                        if attempt < self.max_retries:
                            logger.warning(
                                f"Attempt {attempt}/{self.max_retries} failed for {func.__name__}: {e}. "
                                f"Retrying in {delay}s..."
                            )
                            
                            if on_retry:
                                await on_retry(attempt, e)
                            
                            await asyncio.sleep(delay)
                            
                            if backoff:
                                delay *= self.backoff_factor
                        else:
                            logger.error(
                                f"All {self.max_retries} attempts failed for {func.__name__}"
                            )
                
                raise last_exception
            
            return async_wrapper
        return decorator



# data_fetcher/utils/rate_limiter.py

import asyncio
import time
from typing import Dict, Tuple
from collections import defaultdict

class RateLimiter:
    """API Rate Limit 관리"""
    
    def __init__(self):
        # provider -> (call_count, reset_time)
        self.limits: Dict[str, Tuple[int, float]] = {}
    
    def set_limit(
        self,
        provider: str,
        max_calls: int,
        time_window: int
    ) -> None:
        """Rate limit 설정
        
        Parameters
        ----------
        provider : str
            Provider 이름
        max_calls : int
            시간창 내 최대 호출 수
        time_window : int
            시간창 (초)
        """
        self.limits[provider] = (max_calls, time_window)
    
    async def wait_if_needed(self, provider: str) -> None:
        """필요시 대기"""
        
        if provider not in self.limits:
            return
        
        max_calls, time_window = self.limits[provider]
        
        key = f"{provider}_calls"
        key_reset = f"{provider}_reset"
        
        now = time.time()
        
        # 첫 호출이거나 시간 초과
        if not hasattr(self, key):
            setattr(self, key, 0)
            setattr(self, key_reset, now + time_window)
            return
        
        reset_time = getattr(self, key_reset)
        call_count = getattr(self, key)
        
        # 시간 초과 → 리셋
        if now > reset_time:
            setattr(self, key, 0)
            setattr(self, key_reset, now + time_window)
            return
        
        # Rate limit 도달
        if call_count >= max_calls:
            wait_time = reset_time - now
            print(f"⏳ {provider} Rate limit reached. Waiting {wait_time:.1f}s...")
            await asyncio.sleep(wait_time + 0.1)
            
            setattr(self, key, 0)
            setattr(self, key_reset, time.time() + time_window)
            return
        
        # 호출 수 증가
        setattr(self, key, call_count + 1)



# data_fetcher/utils/enhanced_fetcher.py

from typing import Any, Dict, Optional, Type
from data_fetcher.fetchers.base import Fetcher
from data_fetcher.utils.cache import CacheManager
from data_fetcher.utils.error_handler import ErrorHandler
from data_fetcher.utils.rate_limiter import RateLimiter
import logging

logger = logging.getLogger(__name__)

class EnhancedFetcher:
    """캐싱, 에러 처리, Rate Limiting이 포함된 Fetcher 래퍼"""
    
    def __init__(
        self,
        fetcher_class: Type[Fetcher],
        provider: str,
        category: str,
        cache_manager: Optional[CacheManager] = None,
        error_handler: Optional[ErrorHandler] = None,
        rate_limiter: Optional[RateLimiter] = None,
        cache_ttl: int = 3600
    ):
        self.fetcher_class = fetcher_class
        self.provider = provider
        self.category = category
        self.cache_manager = cache_manager or CacheManager()
        self.error_handler = error_handler or ErrorHandler()
        self.rate_limiter = rate_limiter or RateLimiter()
        self.cache_ttl = cache_ttl
    
    async def fetch(
        self,
        params: Dict[str, Any],
        credentials: Optional[Dict[str, str]] = None,
        use_cache: bool = True,
        **kwargs
    ) -> Any:
        """통합 데이터 조회
        
        1. 캐시 확인
        2. Rate Limit 대기
        3. API 호출 (재시도 로직 포함)
        4. 결과 캐싱
        """
        
        # 1️⃣ 캐시 확인
        if use_cache:
            cached = await self.cache_manager.get(
                self.provider,
                self.category,
                params
            )
            if cached is not None:
                logger.debug(f"✅ Cache hit: {self.provider}.{self.category}")
                return cached
        
        # 2️⃣ Rate Limit 대기
        await self.rate_limiter.wait_if_needed(self.provider)
        
        # 3️⃣ API 호출 (재시도 로직)
        @self.error_handler.retry_on_error(
            exceptions=(Exception,),
            on_retry=self._on_retry
        )
        async def _fetch():
            logger.debug(f"🔄 Fetching: {self.provider}.{self.category}")
            return await self.fetcher_class.fetch_data(
                params=params,
                credentials=credentials,
                **kwargs
            )
        
        try:
            data = await _fetch()
        except Exception as e:
            logger.error(f"❌ Failed to fetch {self.provider}.{self.category}: {e}")
            raise
        
        # 4️⃣ 결과 캐싱
        if use_cache and data:
            await self.cache_manager.set(
                self.provider,
                self.category,
                params,
                data,
                ttl=self.cache_ttl
            )
        
        return data
    
    async def _on_retry(self, attempt: int, exception: Exception) -> None:
        """재시도 콜백"""
        logger.warning(
            f"Retry {attempt}: {self.provider}.{self.category} - {exception}"
        )



# data_fetcher/utils/router.py (기존 코드에 추가)

from enum import Enum
from typing import Literal
from data_fetcher.utils.enhanced_fetcher import EnhancedFetcher
from data_fetcher.utils.cache import CacheManager
from data_fetcher.utils.error_handler import ErrorHandler
from data_fetcher.utils.rate_limiter import RateLimiter

class DataRouter:
    """강화된 Data Router (캐싱, 에러 처리, Rate Limiting)"""
    
    def __init__(
        self,
        use_cache: bool = True,
        cache_ttl: int = 3600,
        max_retries: int = 3
    ):
        self.use_cache = use_cache
        self.cache_ttl = cache_ttl
        self.cache_manager = CacheManager() if use_cache else None
        self.error_handler = ErrorHandler(max_retries=max_retries)
        self.rate_limiter = RateLimiter()
        
        # Rate limit 기본값 설정
        self.rate_limiter.set_limit("fred", 120, 60)      # 60초당 120회
        self.rate_limiter.set_limit("yahoo", 2000, 3600)  # 1시간당 2000회
        self.rate_limiter.set_limit("fmp", 250, 86400)    # 1일당 250회
        
        self._fetchers: dict = {}
    
    async def fetch(
        self,
        category: str,
        provider: str,
        params: dict,
        credentials: dict = None,
        use_cache: bool = None,
        **kwargs
    ) -> Any:
        """강화된 데이터 조회"""
        
        use_cache = use_cache if use_cache is not None else self.use_cache
        
        # EnhancedFetcher 가져오기
        fetcher = self._get_enhanced_fetcher(
            category, provider
        )
        
        # 통합 fetch (캐싱, 에러 처리, Rate Limiting)
        return await fetcher.fetch(
            params=params,
            credentials=credentials,
            use_cache=use_cache,
            **kwargs
        )
    
    def _get_enhanced_fetcher(
        self,
        category: str,
        provider: str
    ) -> EnhancedFetcher:
        """Enhanced Fetcher 캐싱"""
        
        key = f"{provider}:{category}"
        
        if key not in self._fetchers:
            fetcher_class = FetcherRegistry.get(category, provider)
            
            self._fetchers[key] = EnhancedFetcher(
                fetcher_class=fetcher_class,
                provider=provider,
                category=category,
                cache_manager=self.cache_manager,
                error_handler=self.error_handler,
                rate_limiter=self.rate_limiter,
                cache_ttl=self.cache_ttl
            )
        
        return self._fetchers[key]
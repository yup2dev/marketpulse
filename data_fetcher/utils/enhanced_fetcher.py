from typing import Any, Dict, Optional, Type
import logging

from data_fetcher.fetchers.base import Fetcher, AnnotatedResult
from data_fetcher.utils.cache import CacheManager
from data_fetcher.utils.error_handler import ErrorHandler
from data_fetcher.utils.rate_limiter import RateLimiter

logger = logging.getLogger(__name__)


class EnhancedFetcher:
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
        self.cache_manager = cache_manager
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
        if use_cache and self.cache_manager:
            cached = await self.cache_manager.get(
                self.provider, self.category, params
            )
            if cached is not None:
                logger.debug(f"Cache hit: {self.provider}.{self.category}")
                return cached

        await self.rate_limiter.wait_if_needed(self.provider)

        @self.error_handler.retry_on_error(
            exceptions=(Exception,),
            on_retry=self._on_retry
        )
        async def _fetch():
            logger.debug(f"Fetching: {self.provider}.{self.category}")
            result = await self.fetcher_class.fetch_data(
                params=params,
                credentials=credentials,
                **kwargs
            )
            if isinstance(result, AnnotatedResult):
                return result.result
            return result

        data = await _fetch()

        if use_cache and self.cache_manager and data:
            await self.cache_manager.set(
                self.provider, self.category, params, data,
                ttl=self.cache_ttl
            )

        return data

    async def _on_retry(self, attempt: int, exception: Exception) -> None:
        logger.warning(
            f"Retry {attempt}: {self.provider}.{self.category} - {exception}"
        )

"""Provider executor — dispatches fetch pipeline to the correct Fetcher."""
import inspect
import logging
from typing import Dict, Optional

log = logging.getLogger(__name__)


async def _maybe_coroutine(func, **kwargs):
    """Call func — awaits if coroutine, calls directly if sync."""
    result = func(**kwargs)
    if inspect.iscoroutine(result):
        return await result
    return result


class ProviderExecutor:
    """Dispatches the Fetcher pipeline for a given QueryParams type.

    Usage:
        result = await executor.fetch(SomeQueryParams(...))
        item   = await executor.fetch_one(SomeQueryParams(...))

    When multiple fetchers share the same QueryParams type, pass fetcher_cls
    explicitly:
        result = await executor.fetch(query, fetcher_cls=SpecificFetcher)
    """

    def __init__(self, fetcher_map: Dict[type, type]):
        self._map = fetcher_map

    async def fetch(
        self,
        query,
        *,
        limit: Optional[int] = None,
        fetcher_cls=None,
    ) -> list:
        cls = fetcher_cls or self._map.get(type(query))
        if cls is None:
            raise ValueError(f"No fetcher registered for {type(query).__name__}")
        try:
            raw_data = await _maybe_coroutine(cls.extract_data, query=query, credentials=None)
            result = cls.transform_data(query, raw_data)
            if hasattr(result, 'result'):
                result = result.result
            if result:
                return result[:limit] if limit is not None else result
        except Exception as e:
            log.error(f"[{cls.__name__}] {e}")
        return []

    async def fetch_one(self, query, *, fetcher_cls=None):
        result = await self.fetch(query, fetcher_cls=fetcher_cls)
        return result[0] if result else None

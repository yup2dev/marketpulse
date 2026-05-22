import asyncio
import time
import logging
from typing import Dict, Tuple

logger = logging.getLogger(__name__)


class RateLimiter:
    def __init__(self):
        self.limits: Dict[str, Tuple[int, int]] = {}
        self._call_counts: Dict[str, int] = {}
        self._reset_times: Dict[str, float] = {}

    def set_limit(self, provider: str, max_calls: int, time_window: int) -> None:
        self.limits[provider] = (max_calls, time_window)

    async def wait_if_needed(self, provider: str) -> None:
        if provider not in self.limits:
            return

        max_calls, time_window = self.limits[provider]
        now = time.time()

        if provider not in self._call_counts:
            self._call_counts[provider] = 1
            self._reset_times[provider] = now + time_window
            return

        reset_time = self._reset_times[provider]

        if now > reset_time:
            self._call_counts[provider] = 1
            self._reset_times[provider] = now + time_window
            return

        if self._call_counts[provider] >= max_calls:
            wait_time = reset_time - now
            logger.info(f"{provider} rate limit reached. Waiting {wait_time:.1f}s...")
            await asyncio.sleep(wait_time + 0.1)
            self._call_counts[provider] = 1
            self._reset_times[provider] = time.time() + time_window
            return

        self._call_counts[provider] += 1

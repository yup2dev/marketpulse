import asyncio
import logging
from typing import Callable, Optional
from functools import wraps

logger = logging.getLogger(__name__)


class ErrorHandler:
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
                                f"Attempt {attempt}/{self.max_retries} failed for "
                                f"{func.__name__}: {e}. Retrying in {delay}s..."
                            )

                            if on_retry:
                                await on_retry(attempt, e)

                            await asyncio.sleep(delay)

                            if backoff:
                                delay *= self.backoff_factor
                        else:
                            logger.error(
                                f"All {self.max_retries} attempts failed for "
                                f"{func.__name__}"
                            )

                raise last_exception

            return async_wrapper
        return decorator

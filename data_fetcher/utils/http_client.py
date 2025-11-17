"""
HTTP Client Utility for API Requests

Provides a unified HTTP client with retry logic, error handling, and logging.
"""
import logging
import time
from typing import Any, Dict, Optional, Union
from urllib.parse import urlencode

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

log = logging.getLogger(__name__)


class HTTPClientError(Exception):
    """HTTP 클라이언트 오류"""
    pass


class RateLimitError(HTTPClientError):
    """Rate limit 오류"""
    pass


class HTTPClient:
    """
    통합 HTTP 클라이언트

    Features:
    - Automatic retry with exponential backoff
    - Rate limiting
    - Timeout handling
    - Error logging
    - Session pooling
    """

    def __init__(
        self,
        base_url: Optional[str] = None,
        timeout: int = 30,
        max_retries: int = 3,
        backoff_factor: float = 0.3,
        rate_limit_delay: float = 0.0,
        headers: Optional[Dict[str, str]] = None
    ):
        """
        Initialize HTTP Client

        Args:
            base_url: Base URL for all requests
            timeout: Request timeout in seconds
            max_retries: Maximum number of retries
            backoff_factor: Backoff factor for retries
            rate_limit_delay: Delay between requests in seconds
            headers: Default headers
        """
        self.base_url = base_url
        self.timeout = timeout
        self.rate_limit_delay = rate_limit_delay
        self._last_request_time = 0.0

        # Create session with retry logic
        self.session = requests.Session()

        retry_strategy = Retry(
            total=max_retries,
            backoff_factor=backoff_factor,
            status_forcelist=[429, 500, 502, 503, 504],
            allowed_methods=["GET", "POST"]
        )

        adapter = HTTPAdapter(max_retries=retry_strategy)
        self.session.mount("http://", adapter)
        self.session.mount("https://", adapter)

        # Set default headers
        if headers:
            self.session.headers.update(headers)

    def _enforce_rate_limit(self):
        """Rate limiting enforcement"""
        if self.rate_limit_delay > 0:
            elapsed = time.time() - self._last_request_time
            if elapsed < self.rate_limit_delay:
                time.sleep(self.rate_limit_delay - elapsed)

        self._last_request_time = time.time()

    def _build_url(self, endpoint: str) -> str:
        """Build full URL from endpoint"""
        if endpoint.startswith('http'):
            return endpoint

        if self.base_url:
            return f"{self.base_url.rstrip('/')}/{endpoint.lstrip('/')}"

        return endpoint

    def get(
        self,
        endpoint: str,
        params: Optional[Dict[str, Any]] = None,
        headers: Optional[Dict[str, str]] = None,
        **kwargs
    ) -> Dict[str, Any]:
        """
        Send GET request

        Args:
            endpoint: API endpoint
            params: Query parameters
            headers: Request headers
            **kwargs: Additional requests.get() arguments

        Returns:
            JSON response as dict

        Raises:
            HTTPClientError: On request failure
        """
        self._enforce_rate_limit()

        url = self._build_url(endpoint)

        try:
            log.debug(f"GET {url} with params: {params}")

            response = self.session.get(
                url,
                params=params,
                headers=headers,
                timeout=kwargs.get('timeout', self.timeout),
                **{k: v for k, v in kwargs.items() if k != 'timeout'}
            )

            # Handle rate limiting
            if response.status_code == 429:
                raise RateLimitError(f"Rate limit exceeded for {url}")

            response.raise_for_status()

            return response.json()

        except requests.exceptions.Timeout:
            log.error(f"Request timeout for {url}")
            raise HTTPClientError(f"Request timeout for {url}")

        except requests.exceptions.RequestException as e:
            log.error(f"Request failed for {url}: {e}")
            raise HTTPClientError(f"Request failed: {e}")

    def post(
        self,
        endpoint: str,
        data: Optional[Union[Dict[str, Any], str]] = None,
        json: Optional[Dict[str, Any]] = None,
        headers: Optional[Dict[str, str]] = None,
        **kwargs
    ) -> Dict[str, Any]:
        """
        Send POST request

        Args:
            endpoint: API endpoint
            data: Form data
            json: JSON data
            headers: Request headers
            **kwargs: Additional requests.post() arguments

        Returns:
            JSON response as dict

        Raises:
            HTTPClientError: On request failure
        """
        self._enforce_rate_limit()

        url = self._build_url(endpoint)

        try:
            log.debug(f"POST {url}")

            response = self.session.post(
                url,
                data=data,
                json=json,
                headers=headers,
                timeout=kwargs.get('timeout', self.timeout),
                **{k: v for k, v in kwargs.items() if k != 'timeout'}
            )

            # Handle rate limiting
            if response.status_code == 429:
                raise RateLimitError(f"Rate limit exceeded for {url}")

            response.raise_for_status()

            return response.json()

        except requests.exceptions.Timeout:
            log.error(f"Request timeout for {url}")
            raise HTTPClientError(f"Request timeout for {url}")

        except requests.exceptions.RequestException as e:
            log.error(f"Request failed for {url}: {e}")
            raise HTTPClientError(f"Request failed: {e}")

    def close(self):
        """Close session"""
        self.session.close()

    def __enter__(self):
        """Context manager entry"""
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        """Context manager exit"""
        self.close()


# Pre-configured clients for common APIs
def get_fred_client(api_key: str) -> HTTPClient:
    """
    Get FRED API client

    Args:
        api_key: FRED API key

    Returns:
        Configured HTTPClient instance
    """
    return HTTPClient(
        base_url="https://api.stlouisfed.org/fred",
        timeout=30,
        max_retries=3,
        rate_limit_delay=0.1,  # FRED rate limit: ~120 requests/min
        headers={
            'Accept': 'application/json'
        }
    )


def get_alphavantage_client(api_key: str) -> HTTPClient:
    """
    Get Alpha Vantage API client

    Args:
        api_key: Alpha Vantage API key

    Returns:
        Configured HTTPClient instance
    """
    return HTTPClient(
        base_url="https://www.alphavantage.co/query",
        timeout=30,
        max_retries=3,
        rate_limit_delay=12.0,  # Alpha Vantage free tier: 5 requests/min
        headers={
            'Accept': 'application/json'
        }
    )


def get_yahoo_client() -> HTTPClient:
    """
    Get Yahoo Finance client

    Returns:
        Configured HTTPClient instance
    """
    return HTTPClient(
        base_url="https://query2.finance.yahoo.com",
        timeout=30,
        max_retries=3,
        rate_limit_delay=0.5,
        headers={
            'Accept': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
    )

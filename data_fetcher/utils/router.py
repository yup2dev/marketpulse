"""
Enhanced Data Router

OpenBB-style router with automatic provider discovery, multi-provider support,
caching, error handling, and rate limiting.
"""
import logging
from typing import Any, Dict, List, Optional

from data_fetcher.utils.registry import FetcherRegistry
from data_fetcher.provider import ProviderRegistry
from data_fetcher.utils.cache import CacheManager
from data_fetcher.utils.error_handler import ErrorHandler
from data_fetcher.utils.rate_limiter import RateLimiter
from data_fetcher.utils.enhanced_fetcher import EnhancedFetcher

log = logging.getLogger(__name__)


class RouterError(Exception):
    pass


class DataRouter:
    """
    Enhanced Data Router with caching, error handling, and rate limiting.
    """

    def __init__(
        self,
        use_cache: bool = True,
        cache_ttl: int = 3600,
        max_retries: int = 3
    ):
        try:
            import data_fetcher.providers_init
            log.debug("Providers initialized")
        except ImportError as e:
            log.warning(f"Failed to import providers_init: {e}")

        self.use_cache = use_cache
        self.cache_ttl = cache_ttl
        self.cache_manager = CacheManager() if use_cache else None
        self.error_handler = ErrorHandler(max_retries=max_retries)
        self.rate_limiter = RateLimiter()

        self.rate_limiter.set_limit("fred", 120, 60)
        self.rate_limiter.set_limit("yahoo", 2000, 3600)
        self.rate_limiter.set_limit("fmp", 250, 86400)

        self._fetchers: Dict[str, EnhancedFetcher] = {}

    def _get_enhanced_fetcher(
        self,
        category: str,
        provider: str
    ) -> EnhancedFetcher:
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

    async def fetch(
        self,
        category: str,
        params: Dict[str, Any],
        provider: Optional[str] = None,
        credentials: Optional[Dict[str, str]] = None,
        use_cache: Optional[bool] = None,
        **kwargs: Any
    ) -> List[Any]:
        use_cache = use_cache if use_cache is not None else self.use_cache

        try:
            if provider is None:
                providers = FetcherRegistry.list_providers(category)
                provider = providers[0] if providers else None

            fetcher = self._get_enhanced_fetcher(category, provider)
            data = await fetcher.fetch(
                params=params,
                credentials=credentials,
                use_cache=use_cache,
                **kwargs
            )

            log.info(
                f"Fetched {len(data) if data else 0} records for "
                f"category='{category}', provider='{provider}'"
            )

            return data

        except Exception as e:
            log.error(f"Error fetching data: {e}")
            raise RouterError(f"Failed to fetch data for category '{category}': {e}")

    def fetch_sync(
        self,
        category: str,
        params: Dict[str, Any],
        provider: Optional[str] = None,
        credentials: Optional[Dict[str, str]] = None,
        **kwargs: Any
    ) -> List[Any]:
        """
        데이터 조회 (동기 - 편의 메서드)

        내부적으로 fetch를 호출하고 결과를 기다림

        Args:
            category: 데이터 카테고리
            params: 쿼리 파라미터
            provider: Provider 이름
            credentials: API 자격증명
            **kwargs: 추가 파라미터

        Returns:
            표준 모델 데이터 리스트

        Example:
            ```python
            router = DataRouter()

            # Sync usage
            data = router.fetch_sync(
                category="gdp",
                params={"country": "US"}
            )
            ```
        """
        import asyncio
        return asyncio.run(self.fetch(category, params, provider, credentials, **kwargs))

    def list_categories(self) -> List[str]:
        """
        사용 가능한 카테고리 목록

        Returns:
            카테고리 이름 리스트
        """
        return FetcherRegistry.list_categories()

    def list_providers(self, category: Optional[str] = None) -> List[str]:
        """
        Provider 목록

        Args:
            category: 특정 카테고리의 provider만 조회 (None이면 전체)

        Returns:
            Provider 이름 리스트
        """
        if category:
            return FetcherRegistry.list_providers(category)
        else:
            return ProviderRegistry.list()

    def get_provider_info(self, provider_name: str) -> Dict[str, Any]:
        """
        Provider 정보 조회

        Args:
            provider_name: Provider 이름

        Returns:
            Provider 정보 딕셔너리

        Raises:
            KeyError: Provider를 찾을 수 없는 경우
        """
        provider = ProviderRegistry.get(provider_name)
        return provider.to_dict()

    def get_category_info(self, category: str) -> Dict[str, Any]:
        """
        카테고리 정보 조회

        Args:
            category: 카테고리 이름

        Returns:
            카테고리 정보 딕셔너리
        """
        providers = FetcherRegistry.list_providers(category)

        info = {
            'category': category,
            'providers': providers,
            'metadata': {}
        }

        # Collect metadata from all providers
        for provider_name in providers:
            meta = FetcherRegistry.get_metadata(category, provider_name)
            if meta:
                info['metadata'][provider_name] = meta

        return info

    def print_info(self):
        """라우터 정보 출력 (디버깅용)"""
        print("=" * 70)
        print("DATA ROUTER - INFORMATION")
        print("=" * 70)

        # Categories
        categories = self.list_categories()
        print(f"\nTotal Categories: {len(categories)}")
        print(f"Categories: {', '.join(categories)}")

        # Providers
        providers = ProviderRegistry.list()
        print(f"\nTotal Providers: {len(providers)}")

        for provider_name in providers:
            provider = ProviderRegistry.get(provider_name)
            print(f"\n[{provider_name.upper()}]")
            if provider.description:
                print(f"  Description: {provider.description}")
            if provider.website:
                print(f"  Website: {provider.website}")
            print(f"  Credentials: {', '.join(provider.credentials) or 'None'}")
            print(f"  Categories: {', '.join(provider.list_categories())}")

        print("\n" + "=" * 70)

    # ==================== Convenience Methods ====================

    async def get_gdp(
        self,
        country: str = "US",
        frequency: str = "quarterly",
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        provider: str = "fred",
        credentials: Optional[Dict[str, str]] = None
    ) -> List[Any]:
        """
        GDP 데이터 조회 (편의 메서드)

        Args:
            country: 국가 코드
            frequency: 데이터 빈도
            start_date: 시작일
            end_date: 종료일
            provider: Provider 이름
            credentials: API 자격증명

        Returns:
            GDP 데이터 리스트
        """
        params = {
            'country': country,
            'frequency': frequency,
            'start_date': start_date,
            'end_date': end_date
        }
        return await self.fetch("gdp", params, provider, credentials)

    async def get_cpi(
        self,
        country: str = "US",
        category: str = "all",
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        provider: str = "fred",
        credentials: Optional[Dict[str, str]] = None
    ) -> List[Any]:
        """
        CPI 데이터 조회 (편의 메서드)

        Args:
            country: 국가 코드
            category: CPI 카테고리
            start_date: 시작일
            end_date: 종료일
            provider: Provider 이름
            credentials: API 자격증명

        Returns:
            CPI 데이터 리스트
        """
        params = {
            'country': country,
            'category': category,
            'start_date': start_date,
            'end_date': end_date
        }
        return await self.fetch("cpi", params, provider, credentials)

    async def get_quote(
        self,
        symbol: str,
        provider: str = "alphavantage",
        credentials: Optional[Dict[str, str]] = None
    ) -> List[Any]:
        """
        주식 시세 조회 (편의 메서드)

        Args:
            symbol: 종목 코드
            provider: Provider 이름
            credentials: API 자격증명

        Returns:
            Quote 데이터 리스트
        """
        params = {'symbol': symbol}
        return await self.fetch("quote", params, provider, credentials)


# ==================== Singleton ====================

_router_instance = None


def get_data_router() -> DataRouter:
    """
    DataRouter 싱글톤 인스턴스 반환

    Returns:
        DataRouter 인스턴스
    """
    global _router_instance

    if _router_instance is None:
        _router_instance = DataRouter()

    return _router_instance


# ==================== Usage Example ====================

if __name__ == "__main__":
    # Initialize router
    router = DataRouter()

    # Print information
    router.print_info()

    print("\n" + "=" * 70)
    print("EXAMPLE USAGE")
    print("=" * 70)

    # Example: List categories
    print("\nAvailable categories:")
    for cat in router.list_categories():
        providers = router.list_providers(cat)
        print(f"  - {cat}: {', '.join(providers)}")

    # Example: Get provider info
    print("\nFRED Provider Info:")
    fred_info = router.get_provider_info("fred")
    print(f"  Description: {fred_info['description']}")
    print(f"  Categories: {', '.join(fred_info['categories'])}")

    print("\n" + "=" * 70)

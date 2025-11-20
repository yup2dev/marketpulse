"""
Fetcher Registry

Automatic registration and discovery system for fetchers.
Inspired by OpenBB Platform's provider registry pattern.
"""
import logging
from typing import Any, Dict, List, Optional, Type

from data_fetcher.fetchers.base import Fetcher

log = logging.getLogger(__name__)


class RegistryError(Exception):
    """레지스트리 오류"""
    pass


class FetcherRegistry:
    """
    Fetcher 자동 등록 및 발견 시스템

    Features:
    - Decorator-based registration
    - Category-based lookup
    - Provider-based lookup
    - Multi-provider support (같은 카테고리에 여러 provider)
    """

    # Registry storage
    # Structure: {category: {provider: FetcherClass}}
    _registry: Dict[str, Dict[str, Type[Fetcher]]] = {}

    # Metadata storage
    # Structure: {category: {provider: metadata_dict}}
    _metadata: Dict[str, Dict[str, Dict[str, Any]]] = {}

    @classmethod
    def register(
        cls,
        category: str,
        provider: str,
        description: Optional[str] = None,
        **metadata
    ):
        """
        Fetcher 등록 데코레이터

        Args:
            category: 데이터 카테고리 (예: "gdp", "cpi", "quote")
            provider: Provider 이름 (예: "fred", "yahoo", "alphavantage")
            description: 설명
            **metadata: 추가 메타데이터

        Example:
            ```python
            @FetcherRegistry.register(
                category="gdp",
                provider="fred",
                description="FRED GDP data"
            )
            class FREDGDPFetcher(Fetcher):
                ...
            ```
        """
        def wrapper(fetcher_class: Type[Fetcher]):
            # Validate fetcher class
            if not issubclass(fetcher_class, Fetcher):
                raise RegistryError(
                    f"{fetcher_class.__name__} must inherit from Fetcher"
                )

            # Register fetcher
            if category not in cls._registry:
                cls._registry[category] = {}

            if provider in cls._registry[category]:
                log.warning(
                    f"Overwriting existing fetcher for category='{category}', "
                    f"provider='{provider}'"
                )

            cls._registry[category][provider] = fetcher_class

            # Register metadata
            if category not in cls._metadata:
                cls._metadata[category] = {}

            cls._metadata[category][provider] = {
                'description': description,
                'class_name': fetcher_class.__name__,
                **metadata
            }

            log.debug(
                f"Registered fetcher: {fetcher_class.__name__} "
                f"(category='{category}', provider='{provider}')"
            )

            return fetcher_class

        return wrapper

    @classmethod
    def get(
        cls,
        category: str,
        provider: Optional[str] = None
    ) -> Type[Fetcher]:
        """
        Fetcher 조회

        Args:
            category: 데이터 카테고리
            provider: Provider 이름 (None이면 첫 번째 provider 반환)

        Returns:
            Fetcher 클래스

        Raises:
            RegistryError: Fetcher를 찾을 수 없는 경우
        """
        if category not in cls._registry:
            available = cls.list_categories()
            raise RegistryError(
                f"Category '{category}' not found. "
                f"Available categories: {', '.join(available)}"
            )

        providers = cls._registry[category]

        if not providers:
            raise RegistryError(f"No providers registered for category '{category}'")

        # If provider not specified, use first available
        if provider is None:
            provider = list(providers.keys())[0]
            log.debug(
                f"No provider specified for category '{category}', "
                f"using default: '{provider}'"
            )

        if provider not in providers:
            available = list(providers.keys())
            raise RegistryError(
                f"Provider '{provider}' not found for category '{category}'. "
                f"Available providers: {', '.join(available)}"
            )

        return providers[provider]

    @classmethod
    def list_categories(cls) -> List[str]:
        """
        등록된 모든 카테고리 목록 반환

        Returns:
            카테고리 이름 리스트
        """
        return sorted(cls._registry.keys())

    @classmethod
    def list_providers(cls, category: Optional[str] = None) -> List[str]:
        """
        Provider 목록 반환

        Args:
            category: 특정 카테고리의 provider만 조회 (None이면 전체)

        Returns:
            Provider 이름 리스트
        """
        if category:
            if category not in cls._registry:
                return []
            return sorted(cls._registry[category].keys())
        else:
            # Collect all unique providers
            all_providers = set()
            for providers in cls._registry.values():
                all_providers.update(providers.keys())
            return sorted(all_providers)

    @classmethod
    def get_metadata(
        cls,
        category: str,
        provider: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Fetcher 메타데이터 조회

        Args:
            category: 데이터 카테고리
            provider: Provider 이름

        Returns:
            메타데이터 딕셔너리
        """
        if category not in cls._metadata:
            return {}

        if provider is None:
            # Return metadata for all providers in category
            return cls._metadata[category]

        return cls._metadata[category].get(provider, {})

    @classmethod
    def clear(cls):
        """레지스트리 초기화 (테스트용)"""
        cls._registry.clear()
        cls._metadata.clear()
        log.debug("Registry cleared")

    @classmethod
    def get_registry_info(cls) -> Dict[str, Any]:
        """
        레지스트리 전체 정보 반환

        Returns:
            레지스트리 정보 딕셔너리
        """
        info = {
            'total_categories': len(cls._registry),
            'total_providers': len(cls.list_providers()),
            'categories': {}
        }

        for category in cls.list_categories():
            providers = cls.list_providers(category)
            info['categories'][category] = {
                'providers': providers,
                'metadata': cls._metadata.get(category, {})
            }

        return info

    @classmethod
    def print_registry(cls):
        """레지스트리 정보 출력 (디버깅용)"""
        info = cls.get_registry_info()

        print("=" * 60)
        print("FETCHER REGISTRY")
        print("=" * 60)
        print(f"Total Categories: {info['total_categories']}")
        print(f"Total Providers: {info['total_providers']}")
        print()

        for category, cat_info in info['categories'].items():
            print(f"Category: {category}")
            print(f"  Providers: {', '.join(cat_info['providers'])}")

            for provider, meta in cat_info['metadata'].items():
                desc = meta.get('description', 'No description')
                class_name = meta.get('class_name', 'Unknown')
                print(f"    - {provider}: {class_name}")
                print(f"      {desc}")

            print()


# Singleton instance getter (optional, for convenience)
def get_registry() -> FetcherRegistry:
    """
    Registry 싱글톤 인스턴스 반환

    Returns:
        FetcherRegistry 인스턴스
    """
    return FetcherRegistry

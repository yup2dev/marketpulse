"""
Provider Abstraction

Defines the Provider pattern for organizing fetchers by data source.
"""
import logging
from typing import Any, Dict, List, Optional, Type

from data_fetcher.fetchers.base import Fetcher

log = logging.getLogger(__name__)


class Provider:
    """Serves as provider extension entry point."""

    def __init__(
        self,
        name: str,
        description: str = "",
        website: str | None = None,
        credentials: list[str] | None = None,
        fetcher_dict: dict[str, type[Fetcher]] | None = None,
        **kwargs,
    ) -> None:
        """Initialize the provider."""
        if not name:
            raise ValueError("Provider name is required")

        self.name = name
        self.description = description
        self.website = website or ""
        self.credentials = credentials or []
        self.fetcher_dict = fetcher_dict or {}
        self.metadata: Dict[str, Any] = kwargs.get("metadata", {})

        # Validate fetcher classes
        for category, fetcher_class in self.fetcher_dict.items():
            if not issubclass(fetcher_class, Fetcher):
                raise TypeError(
                    f"Fetcher for category '{category}' must inherit from Fetcher, "
                    f"got {fetcher_class}"
                )

    def get_fetcher(self, category: str) -> type[Fetcher]:
        """카테고리별 Fetcher 반환"""
        if category not in self.fetcher_dict:
            available = list(self.fetcher_dict.keys())
            raise KeyError(
                f"Category '{category}' not supported by provider '{self.name}'. "
                f"Available categories: {', '.join(available)}"
            )
        return self.fetcher_dict[category]

    def list_categories(self) -> list[str]:
        """지원하는 카테고리 목록 반환"""
        return sorted(self.fetcher_dict.keys())

    def requires_credentials(self) -> bool:
        """자격증명 필요 여부"""
        return len(self.credentials) > 0

    def validate_credentials(self, credentials: dict[str, str] | None) -> bool:
        """자격증명 유효성 검증"""
        if not self.requires_credentials():
            return True

        if not credentials:
            raise ValueError(
                f"Provider '{self.name}' requires credentials: {', '.join(self.credentials)}"
            )

        missing = [cred for cred in self.credentials if cred not in credentials]
        if missing:
            raise ValueError(
                f"Missing required credentials for provider '{self.name}': {', '.join(missing)}"
            )
        return True

    def to_dict(self) -> Dict[str, Any]:
        """Provider 정보를 딕셔너리로 변환"""
        return {
            "name": self.name,
            "description": self.description,
            "website": self.website,
            "credentials": self.credentials,
            "categories": self.list_categories(),
            "fetchers": {
                category: fetcher.__name__
                for category, fetcher in self.fetcher_dict.items()
            },
            "metadata": self.metadata,
        }

    def __repr__(self) -> str:
        categories = ", ".join(self.list_categories())
        return (
            f"Provider(name='{self.name}', "
            f"categories=[{categories}], "
            f"credentials={self.credentials})"
        )


class ProviderRegistry:
    """Provider 레지스트리 — 모든 Provider를 등록하고 관리합니다."""

    _providers: Dict[str, Provider] = {}

    @classmethod
    def register(cls, provider: Provider) -> None:
        if provider.name in cls._providers:
            log.warning(f"Overwriting existing provider: {provider.name}")
        cls._providers[provider.name] = provider
        log.info(
            f"Registered provider: {provider.name} "
            f"({len(provider.list_categories())} categories)"
        )

    @classmethod
    def get(cls, name: str) -> Provider:
        if name not in cls._providers:
            available = cls.list()
            raise KeyError(
                f"Provider '{name}' not found. "
                f"Available providers: {', '.join(available)}"
            )
        return cls._providers[name]

    @classmethod
    def list(cls) -> list[str]:
        return sorted(cls._providers.keys())

    @classmethod
    def get_all(cls) -> Dict[str, Provider]:
        return cls._providers.copy()

    @classmethod
    def clear(cls) -> None:
        cls._providers.clear()
        log.debug("Provider registry cleared")

    @classmethod
    def print_registry(cls) -> None:
        print("=" * 60)
        print("PROVIDER REGISTRY")
        print("=" * 60)
        print(f"Total Providers: {len(cls._providers)}")
        print()
        for name, provider in sorted(cls._providers.items()):
            print(f"Provider: {name}")
            if provider.description:
                print(f"  Description: {provider.description}")
            if provider.website:
                print(f"  Website: {provider.website}")
            print(f"  Credentials: {', '.join(provider.credentials) or 'None'}")
            print(f"  Categories: {', '.join(provider.list_categories())}")
            print()

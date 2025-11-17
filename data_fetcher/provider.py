"""
Provider Abstraction

Defines the Provider pattern for organizing fetchers by data source.
Inspired by OpenBB Platform's provider system.
"""
import logging
from typing import Any, Dict, List, Optional, Type
from dataclasses import dataclass, field

from data_fetcher.fetchers.base import Fetcher

log = logging.getLogger(__name__)


@dataclass
class Provider:
    """
    Provider 추상화

    Provider는 특정 데이터 소스(FRED, Yahoo, AlphaVantage 등)에 대한
    모든 fetcher들을 그룹화하고 메타데이터를 제공합니다.

    Attributes:
        name: Provider 이름 (예: "fred", "yahoo")
        description: Provider 설명
        website: Provider 웹사이트
        credentials: 필요한 자격증명 목록
        fetcher_dict: {category: FetcherClass} 매핑
        metadata: 추가 메타데이터
    """
    name: str
    description: str = ""
    website: str = ""
    credentials: List[str] = field(default_factory=list)
    fetcher_dict: Dict[str, Type[Fetcher]] = field(default_factory=dict)
    metadata: Dict[str, Any] = field(default_factory=dict)

    def __post_init__(self):
        """초기화 후 검증"""
        if not self.name:
            raise ValueError("Provider name is required")

        # Validate fetcher classes
        for category, fetcher_class in self.fetcher_dict.items():
            if not issubclass(fetcher_class, Fetcher):
                raise TypeError(
                    f"Fetcher for category '{category}' must inherit from Fetcher, "
                    f"got {fetcher_class}"
                )

    def get_fetcher(self, category: str) -> Type[Fetcher]:
        """
        카테고리별 Fetcher 반환

        Args:
            category: 데이터 카테고리

        Returns:
            Fetcher 클래스

        Raises:
            KeyError: 해당 카테고리를 지원하지 않는 경우
        """
        if category not in self.fetcher_dict:
            available = list(self.fetcher_dict.keys())
            raise KeyError(
                f"Category '{category}' not supported by provider '{self.name}'. "
                f"Available categories: {', '.join(available)}"
            )

        return self.fetcher_dict[category]

    def list_categories(self) -> List[str]:
        """
        지원하는 카테고리 목록 반환

        Returns:
            카테고리 이름 리스트
        """
        return sorted(self.fetcher_dict.keys())

    def requires_credentials(self) -> bool:
        """
        자격증명 필요 여부

        Returns:
            자격증명이 필요하면 True
        """
        return len(self.credentials) > 0

    def validate_credentials(self, credentials: Optional[Dict[str, str]]) -> bool:
        """
        자격증명 유효성 검증

        Args:
            credentials: 자격증명 딕셔너리

        Returns:
            유효하면 True

        Raises:
            ValueError: 필수 자격증명이 누락된 경우
        """
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
        """
        Provider 정보를 딕셔너리로 변환

        Returns:
            Provider 정보 딕셔너리
        """
        return {
            'name': self.name,
            'description': self.description,
            'website': self.website,
            'credentials': self.credentials,
            'categories': self.list_categories(),
            'fetchers': {
                category: fetcher.__name__
                for category, fetcher in self.fetcher_dict.items()
            },
            'metadata': self.metadata
        }

    def __repr__(self) -> str:
        categories = ', '.join(self.list_categories())
        return (
            f"Provider(name='{self.name}', "
            f"categories=[{categories}], "
            f"credentials={self.credentials})"
        )


class ProviderRegistry:
    """
    Provider 레지스트리

    모든 Provider를 등록하고 관리합니다.
    """

    _providers: Dict[str, Provider] = {}

    @classmethod
    def register(cls, provider: Provider):
        """
        Provider 등록

        Args:
            provider: 등록할 Provider 인스턴스

        Raises:
            ValueError: Provider 이름이 중복되는 경우
        """
        if provider.name in cls._providers:
            log.warning(f"Overwriting existing provider: {provider.name}")

        cls._providers[provider.name] = provider
        log.info(f"Registered provider: {provider.name} ({len(provider.list_categories())} categories)")

    @classmethod
    def get(cls, name: str) -> Provider:
        """
        Provider 조회

        Args:
            name: Provider 이름

        Returns:
            Provider 인스턴스

        Raises:
            KeyError: Provider를 찾을 수 없는 경우
        """
        if name not in cls._providers:
            available = cls.list()
            raise KeyError(
                f"Provider '{name}' not found. "
                f"Available providers: {', '.join(available)}"
            )

        return cls._providers[name]

    @classmethod
    def list(cls) -> List[str]:
        """
        등록된 Provider 목록 반환

        Returns:
            Provider 이름 리스트
        """
        return sorted(cls._providers.keys())

    @classmethod
    def get_all(cls) -> Dict[str, Provider]:
        """
        모든 Provider 반환

        Returns:
            {name: Provider} 딕셔너리
        """
        return cls._providers.copy()

    @classmethod
    def clear(cls):
        """레지스트리 초기화 (테스트용)"""
        cls._providers.clear()
        log.debug("Provider registry cleared")

    @classmethod
    def print_registry(cls):
        """레지스트리 정보 출력 (디버깅용)"""
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

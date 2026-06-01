"""
FetcherRegistry — ProviderRegistry 위에 얹힌 category/provider 쿼리 인터페이스

이전: _registry dict를 직접 관리하며 providers_init.py에서 이중 등록
이후: ProviderRegistry.get_all()에 위임 → 단일 등록, 자동 동기화
"""
import logging
from typing import Any, Dict, List, Optional, Type

from data_fetcher.abstract_provider.abstract.fetcher import Fetcher

log = logging.getLogger(__name__)


class RegistryError(Exception):
    """레지스트리 오류"""
    pass


class FetcherRegistry:
    """
    category + provider 기반 Fetcher 조회 인터페이스.

    데이터 원본: ProviderRegistry (abstract_provider.abstract.provider)
    직접 registry를 관리하지 않고 ProviderRegistry에 위임합니다.
    providers_init.py에서 ProviderRegistry에 등록하는 것만으로 자동 반영됩니다.
    """

    @staticmethod
    def _pr():
        """ProviderRegistry 지연 임포트 (순환 의존 방지)"""
        from data_fetcher.abstract_provider.abstract.provider import ProviderRegistry
        return ProviderRegistry

    # ── 조회 ──────────────────────────────────────────────────────────────────

    @classmethod
    def get(cls, category: str, provider: Optional[str] = None) -> Type[Fetcher]:
        """Fetcher 클래스 반환.

        provider가 None이면 해당 category를 지원하는 첫 번째 provider를 사용합니다.
        """
        all_providers = cls._pr().get_all()

        if provider:
            prov = all_providers.get(provider)
            if not prov:
                raise RegistryError(
                    f"Provider '{provider}' not found. "
                    f"Available: {', '.join(sorted(all_providers))}"
                )
            if category not in prov.fetcher_dict:
                raise RegistryError(
                    f"Category '{category}' not found in provider '{provider}'. "
                    f"Available: {', '.join(prov.list_categories())}"
                )
            return prov.fetcher_dict[category]

        # provider 미지정 → category를 지원하는 첫 번째 provider
        for prov_name, prov in all_providers.items():
            if category in prov.fetcher_dict:
                log.debug("No provider specified for '%s', using '%s'", category, prov_name)
                return prov.fetcher_dict[category]

        raise RegistryError(
            f"Category '{category}' not found in any provider. "
            f"Available categories: {', '.join(cls.list_categories())}"
        )

    @classmethod
    def list_categories(cls) -> List[str]:
        """등록된 모든 카테고리 목록"""
        categories: set = set()
        for prov in cls._pr().get_all().values():
            categories.update(prov.fetcher_dict.keys())
        return sorted(categories)

    @classmethod
    def list_providers(cls, category: Optional[str] = None) -> List[str]:
        """Provider 목록. category가 주어지면 해당 카테고리를 지원하는 provider만 반환."""
        all_providers = cls._pr().get_all()
        if category:
            return sorted(
                name for name, prov in all_providers.items()
                if category in prov.fetcher_dict
            )
        return cls._pr().list()

    @classmethod
    def get_metadata(
        cls,
        category: str,
        provider: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Fetcher 메타데이터 조회 (class_name + description)."""
        all_providers = cls._pr().get_all()

        if provider:
            prov = all_providers.get(provider)
            if not prov or category not in prov.fetcher_dict:
                return {}
            fetcher_cls = prov.fetcher_dict[category]
            return {
                "class_name": fetcher_cls.__name__,
                "description": f"{provider} {category} data",
            }

        # 카테고리의 모든 provider 메타데이터
        result: Dict[str, Any] = {}
        for prov_name, prov in all_providers.items():
            if category in prov.fetcher_dict:
                fetcher_cls = prov.fetcher_dict[category]
                result[prov_name] = {
                    "class_name": fetcher_cls.__name__,
                    "description": f"{prov_name} {category} data",
                }
        return result

    @classmethod
    def get_registry_info(cls) -> Dict[str, Any]:
        """레지스트리 전체 정보"""
        categories = cls.list_categories()
        all_providers = cls._pr().get_all()

        info: Dict[str, Any] = {
            "total_categories": len(categories),
            "total_providers": len(all_providers),
            "categories": {},
        }
        for cat in categories:
            providers = cls.list_providers(cat)
            info["categories"][cat] = {
                "providers": providers,
                "metadata": {
                    p: {"class_name": all_providers[p].fetcher_dict[cat].__name__}
                    for p in providers
                },
            }
        return info

    @classmethod
    def print_registry(cls) -> None:
        """레지스트리 정보 출력 (디버깅용)"""
        info = cls.get_registry_info()
        print("=" * 60)
        print("FETCHER REGISTRY  (via ProviderRegistry)")
        print("=" * 60)
        print(f"Total Categories : {info['total_categories']}")
        print(f"Total Providers  : {info['total_providers']}")
        print()
        for cat, cat_info in info["categories"].items():
            print(f"  {cat}: {', '.join(cat_info['providers'])}")
        print()


def get_registry() -> type[FetcherRegistry]:
    return FetcherRegistry

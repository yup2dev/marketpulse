"""
abstract_provider — OpenBB core 역할 (규칙 정의)

이 패키지는 직접 수정하거나 인스턴스화하지 않습니다.
구현체는 data_fetcher.providers.* 패키지에 위치합니다.
"""
from data_fetcher.abstract_provider.abstract import (
    BaseData,
    BaseQueryParams,
    Fetcher,
    AnnotatedResult,
    Provider,
    ProviderRegistry,
)

__all__ = [
    "BaseData",
    "BaseQueryParams",
    "Fetcher",
    "AnnotatedResult",
    "Provider",
    "ProviderRegistry",
]

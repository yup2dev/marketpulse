"""Fetcher 레지스트리 스모크 (scripts/smoke_fetchers.py의 pytest 버전, 네트워크 불필요).

전체 ProviderRegistry를 순회하며 각 fetcher의 제네릭 해석이 정상인지 검증한다.
`query_params_type`이 bare BaseModel로 폴백하면 query_executor._filter_extra_params가
모든 사용자 파라미터를 제거해 런타임에 조용히 깨지므로, 폴백 = 실패로 취급한다.
"""
import pytest
from pydantic import BaseModel

import data_fetcher.providers_init  # noqa: F401  (등록 트리거)
from data_fetcher.abstract_provider.abstract.provider import ProviderRegistry


def _all_fetchers():
    for pname, provider in sorted(ProviderRegistry.get_all().items()):
        for key, fetcher_cls in sorted(provider.fetcher_dict.items()):
            yield pytest.param(fetcher_cls, id=f"{pname}/{key}")


@pytest.mark.parametrize("fetcher_cls", _all_fetchers())
def test_query_params_resolved(fetcher_cls):
    """제네릭 해석이 bare BaseModel로 폴백하지 않아야 한다 (파라미터 전멸 방지)."""
    qp = fetcher_cls.query_params_type
    assert isinstance(qp, type) and issubclass(qp, BaseModel)
    assert qp is not BaseModel, (
        f"{fetcher_cls.__name__}: query_params_type이 BaseModel로 폴백 — "
        "query_executor._filter_extra_params가 모든 파라미터를 제거한다"
    )


@pytest.mark.parametrize("fetcher_cls", _all_fetchers())
def test_extract_data_wired(fetcher_cls):
    """extract_data가 Fetcher 기본(no-op)으로 남아 있지 않아야 한다."""
    impl = getattr(fetcher_cls.extract_data, "__qualname__", "")
    assert not impl.startswith("Fetcher."), (
        f"{fetcher_cls.__name__}: extract_data가 Fetcher 기본으로 남음"
    )


def test_registry_not_empty():
    providers = ProviderRegistry.get_all()
    total = sum(len(p.fetcher_dict) for p in providers.values())
    assert len(providers) >= 20 and total >= 140, (
        f"레지스트리 축소 감지: providers={len(providers)} fetchers={total}"
    )

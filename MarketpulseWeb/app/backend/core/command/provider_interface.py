"""ProviderInterface — 모델 하나를 어느 provider 들이 주는지, 파라미터가 무엇인지 (OpenBB openbb_core.app.provider_interface).

OpenBB 와 같은 나눔:
  - standard 파라미터 : 표준 모델(abstract_provider/standard_models) QueryParams 의 칸 — 모든 provider 공통
  - extra 파라미터    : provider 별 QueryParams 가 더 선언한 칸 — 그 provider 를 골랐을 때만 넘긴다 (Query 가 거른다)

모델 키는 OpenBB 의 표준 모델 이름 대신 provider fetcher_dict 키(yield_curve · series …)를 쓴다.

create_executor() — Query 가 조회를 맡길 실행기 (OpenBB 와 같은 자리). 기본은 순수 QueryExecutor.
웹 서버는 기동할 때 set_executor 로 자기 실행 계층(캐시 · 실행 위치 · 사용자 키)을 끼운다 — 이 패키지는 그걸 모른다.
"""
from dataclasses import dataclass, field
from functools import lru_cache
from typing import Dict, List, Optional, Tuple, Type

from pydantic import BaseModel
from pydantic.fields import FieldInfo

_STANDARD_PKG = "data_fetcher.abstract_provider.standard_models"


@dataclass
class ModelParams:
    providers: List[str]
    standard: Dict[str, FieldInfo] = field(default_factory=dict)
    extra: Dict[str, Tuple[FieldInfo, List[str]]] = field(default_factory=dict)   # 칸 → (정의, 그 칸을 가진 provider)


def _registry():
    import data_fetcher.providers_init  # noqa: F401 — provider 등록
    from data_fetcher.utils.registry import FetcherRegistry
    return FetcherRegistry


def _qp_type(fetcher_cls) -> Optional[Type[BaseModel]]:
    try:
        qp = fetcher_cls.query_params_type
    except Exception:  # noqa: BLE001 — 제네릭 해석 실패 fetcher
        return None
    return qp if isinstance(qp, type) and issubclass(qp, BaseModel) else None


def _standard_type(qp: Type[BaseModel]) -> Type[BaseModel]:
    """provider QueryParams 의 조상 중 표준 모델 — 없으면(단일 provider 전용 모델) 자기 자신."""
    for base in qp.__mro__:
        if getattr(base, "__module__", "").startswith(_STANDARD_PKG) and base.model_fields:
            return base
    return qp


_executor = None   # set_executor 로 끼운 실행기 — execute(provider_name, model_name, params, credentials, **kw)


class ProviderInterface:
    """모델 → provider 목록 · 표준/추가 파라미터. 등록이 끝난 뒤 처음 물을 때 만들고 캐시한다."""

    @staticmethod
    def create_executor():
        """Query 가 쓸 실행기 (OpenBB ProviderInterface.create_executor)."""
        if _executor is not None:
            return _executor
        from data_fetcher.query_executor import QueryExecutor
        return QueryExecutor()

    @staticmethod
    def set_executor(executor) -> None:
        """실행기를 바꿔 끼운다 — None 이면 순수 QueryExecutor 로."""
        global _executor
        _executor = executor

    @staticmethod
    @lru_cache(maxsize=None)
    def params(model: str) -> ModelParams:
        reg = _registry()
        providers = reg.list_providers(model)
        if not providers:
            raise KeyError(f"model '{model}' 를 주는 provider 가 없다")

        qps = {p: _qp_type(reg.get(model, p)) for p in providers}
        known = [q for q in qps.values() if q is not None]
        if not known:
            return ModelParams(providers=providers)

        # 표준 = 모든 provider 의 표준 모델에 공통인 칸 (같은 모델 키라도 provider 마다 표준이 다를 수 있다 — series 등)
        std_fields = [_standard_type(q).model_fields for q in known]
        common = set(std_fields[0]).intersection(*std_fields[1:])
        standard = {n: f for n, f in std_fields[0].items() if n in common}
        extra: Dict[str, Tuple[FieldInfo, List[str]]] = {}
        for p, qp in qps.items():
            for name, f in (qp.model_fields.items() if qp else ()):
                if name in standard:
                    continue
                if name in extra:
                    extra[name][1].append(p)
                else:
                    extra[name] = (f, [p])
        return ModelParams(providers=providers, standard=standard, extra=extra)

    @staticmethod
    def providers(model: str) -> List[str]:
        return ProviderInterface.params(model).providers

    @staticmethod
    def fetcher(model: str, provider: str):
        """(provider, model) 의 fetcher 클래스 — 없으면 None."""
        from data_fetcher.abstract_provider.abstract.provider import ProviderRegistry
        _registry()
        prov = ProviderRegistry.get_all().get(provider)
        return prov.fetcher_dict.get(model) if prov else None

    @staticmethod
    def schema(model: str, provider: str, dynamic: bool = True) -> Optional[dict]:
        """(provider, model) 의 파라미터 폼 스펙 + 응답 필드 (위젯 · 사용자 위젯 · 데이터 카탈로그가 쓴다)."""
        from data_fetcher.utils.model_schema import model_schema
        fetcher_cls = ProviderInterface.fetcher(model, provider)
        return model_schema(fetcher_cls, dynamic=dynamic) if fetcher_cls else None

    @staticmethod
    def field_names(model: str, provider: str) -> Optional[set]:
        """그 provider 가 받는 칸 이름 (alias 포함). fetcher · QueryParams 를 못 읽으면 None — 거르지 않는다."""
        fetcher_cls = ProviderInterface.fetcher(model, provider)
        qp = _qp_type(fetcher_cls) if fetcher_cls else None
        if qp is None:
            return None
        names = set(qp.model_fields)
        names |= {f.alias for f in qp.model_fields.values() if f.alias}
        return names

    @staticmethod
    def has_field(model: str, name: str) -> bool:
        mp = ProviderInterface.params(model)
        return name in mp.standard or name in mp.extra


def reset_cache() -> None:
    """provider 를 새로 등록한 뒤(테스트 등) 다시 읽게."""
    ProviderInterface.params.cache_clear()


__all__ = ["ProviderInterface", "ModelParams", "reset_cache"]

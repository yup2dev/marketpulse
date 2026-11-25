"""모델 → provider 지도 — 라우트 생성기(CommandRouter)가 파라미터와 provider 선택지를 여기서 얻는다.

ProviderRegistry 의 fetcher_dict 를 모델 기준으로 뒤집는다. 모델 이름은 fetcher_dict 키
(snake_case) 로, /api/data/{provider}/{model} · 데이터 카탈로그와 같은 이름이다. PascalCase 도 받는다.

파라미터는 둘로 나뉜다:
    표준   모든 provider 가 받는 것 — 표준 모델(standard_models)의 QueryParams 필드.
           provider 마다 표준 모델이 다르면 모든 provider 에 공통인 필드.
    추가   일부 provider 만 받는 것 — 늘 선택값. 설명 끝에 (provider: fmp, sec) 로 받는 provider 를 적는다
           (OpenAPI 를 읽어 위젯 목록을 만드는 쪽이 이 표기로 provider 별 파라미터를 가른다).

라우트 기본값은 None 이다 (필수 제외). 보내지 않은 값은 fetcher 의 기본값을 따른다 —
provider 가 표준 기본값을 바꿔 둔 경우(limit 등)가 있어 라우트가 대신 채우지 않는다.
"""
from __future__ import annotations

import enum
import re
from dataclasses import dataclass
from typing import Any, Dict, List, Literal, Optional, Tuple, Union, get_args, get_origin

from pydantic import BaseModel

_STANDARD_PKG = "data_fetcher.abstract_provider.standard_models"
_SCALARS = (str, int, float, bool)


def model_key(model: str) -> str:
    """"IncomeStatement" · "income-statement" · "income_statement" → "income_statement"."""
    s = re.sub(r"([A-Z]+)([A-Z][a-z])", r"\1_\2", model)
    s = re.sub(r"([a-z\d])([A-Z])", r"\1_\2", s)
    return s.replace("-", "_").lower()


@dataclass(frozen=True)
class ParamSpec:
    name: str
    annotation: Any            # 쿼리 문자열로 받을 수 있는 타입 (_query_type)
    required: bool
    description: str
    providers: Tuple[str, ...] = ()   # 비면 표준 (모든 provider)


@dataclass(frozen=True)
class ModelSpec:
    model: str
    providers: Tuple[str, ...]        # 등록 순서
    params: Tuple[ParamSpec, ...]


def _registry() -> Dict[str, Any]:
    import data_fetcher.providers_init  # noqa: F401 — 등록 보장 (이미 됐으면 no-op)
    from data_fetcher.abstract_provider.abstract.provider import ProviderRegistry
    return ProviderRegistry.get_all()


def models() -> Dict[str, Tuple[str, ...]]:
    """모델 → 그 모델을 주는 provider (등록 순서)."""
    out: Dict[str, List[str]] = {}
    for pname, prov in _registry().items():
        for key in prov.fetcher_dict:
            out.setdefault(key, []).append(pname)
    return {k: tuple(v) for k, v in sorted(out.items())}


def _qp_fields(fetcher_cls) -> Dict[str, Any]:
    try:
        qp = fetcher_cls.query_params_type
    except Exception:  # noqa: BLE001 — 제네릭 인자를 못 읽는 옛 fetcher
        return {}
    return dict(qp.model_fields) if isinstance(qp, type) and issubclass(qp, BaseModel) else {}


def _standard_class(fetcher_cls) -> Optional[type]:
    try:
        qp = fetcher_cls.query_params_type
    except Exception:  # noqa: BLE001
        return None
    for c in getattr(qp, "__mro__", ()):
        mod = getattr(c, "__module__", "")
        if mod.startswith(_STANDARD_PKG) and not mod.endswith("._base") and c.__name__.endswith("QueryParams"):
            return c
    return None


def _query_type(ann: Any) -> Any:
    """쿼리 문자열로 받을 타입. 숫자 · 불리언 · 선택지 외(날짜 · 목록 · 합집합)는 str 로 받아
    fetcher 의 QueryParams 가 검증하게 둔다 — "-7d" 같은 상대 날짜를 받는 fetcher 가 있다."""
    if get_origin(ann) is Union:
        args = [a for a in get_args(ann) if a is not type(None)]
        ann = args[0] if len(args) == 1 else str
    if get_origin(ann) is Literal and all(isinstance(a, _SCALARS) for a in get_args(ann)):
        return ann
    if isinstance(ann, type) and (issubclass(ann, enum.Enum) or ann in _SCALARS):
        return ann
    return str


def _param(name: str, field, providers: Tuple[str, ...] = ()) -> ParamSpec:
    desc = (field.description or "").strip()
    if providers:
        desc = f"{desc} (provider: {', '.join(providers)})".strip()
    return ParamSpec(
        name=name,
        annotation=_query_type(field.annotation),
        required=not providers and field.is_required(),
        description=desc,
        providers=providers,
    )


def model_spec(model: str) -> ModelSpec:
    """모델 하나의 provider 와 파라미터. 없는 모델이면 KeyError."""
    registry = _registry()
    # 키 그대로 먼저 (form_13FHR 처럼 대문자가 섞인 키), 없으면 snake_case 로 — 실행기와 같은 순서
    key = model if any(model in prov.fetcher_dict for prov in registry.values()) else model_key(model)
    fetchers = {p: prov.fetcher_dict[key] for p, prov in registry.items() if key in prov.fetcher_dict}
    if not fetchers:
        raise KeyError(f"모델 '{model}' 을 주는 provider 가 없다 (fetcher_dict 키: {key})")

    fields = {p: _qp_fields(f) for p, f in fetchers.items()}
    standards = {_standard_class(f) for f in fetchers.values()}
    if len(standards) == 1 and None not in standards:
        std_fields = dict(next(iter(standards)).model_fields)
    else:   # provider 마다 표준 모델이 다르다 → 모두에 있는 필드
        common = set.intersection(*(set(fs) for fs in fields.values())) if fields else set()
        first = next(iter(fields.values()))
        std_fields = {n: first[n] for n in first if n in common}

    params: List[ParamSpec] = [_param(n, f) for n, f in std_fields.items()]
    extra: Dict[str, List[str]] = {}
    for p, fs in fields.items():
        for n in fs:
            if n not in std_fields:
                extra.setdefault(n, []).append(p)
    for n, ps in extra.items():
        spec = _param(n, fields[ps[0]][n], tuple(ps))
        types = {_query_type(fields[p][n].annotation) for p in ps}
        if len(types) > 1:   # provider 마다 타입이 다르다 → 문자열로 받는다
            spec = ParamSpec(spec.name, str, False, spec.description, spec.providers)
        params.append(spec)

    params = [s for s in params if s.name != "provider" and not s.name.startswith("_")]
    return ModelSpec(model=key, providers=tuple(fetchers), params=tuple(params))

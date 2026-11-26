"""QueryExecutor — provider 의 fetcher 를 찾아 실행한다 (OpenBB openbb_core.provider.query_executor).

    QueryExecutor().execute(provider_name, model_name, params, credentials)
        provider 조회 → fetcher 조회 → 자격증명 거르기 → 파라미터 거르기 → fetcher.fetch_data()

어디서 실행되는지 모른다 — 웹 서버 · 사용자 PC Fetcher(exe) · 로컬 배치가 같은 코드를 쓴다.
캐시 · 실행 위치(로컬 전용 / 서버) · 사용자 키 · 서킷브레이커는 부르는 쪽(웹 서버의 core/execution)의 일이다.

OpenBB 와 다른 점 (이 프로젝트 fetcher 에 맞춘 것):
    - 모델 이름은 PascalCase 도 받는다 (snake_case 키로 다시 찾는다)
    - credentials 를 안 주면 이 프로세스의 환경 변수(API_ENV_MAPPING)에서 읽는다 — exe · 배치용
    - QueryParams 에 없는 파라미터는 경고(add_warning)와 함께 빼고, OpenBB 이식 QueryParams 의 빠진 표준
      필드는 기본값으로 채운다 (OpenBB 는 app 계층의 Query 가 표준 필드를 모두 채워 넘긴다)
"""
import logging
import re
from typing import Any, Dict, List, Optional, Type

from pydantic import BaseModel

from data_fetcher.abstract_provider.abstract.fetcher import Fetcher
from data_fetcher.abstract_provider.abstract.provider import Provider, ProviderRegistry
from data_fetcher.utils.api_keys import (
    API_ENV_MAPPING,
    CredentialsError,
    get_credentials_from_env,
)

log = logging.getLogger(__name__)


# provider.name → API_ENV_MAPPING 키 매핑
_PROVIDER_TO_ENV_KEY: Dict[str, str] = {
    "fred": "FRED",
    "yahoo": "YAHOO",
    "alphavantage": "ALPHA_VANTAGE",
    "fmp": "FMP",
    "polygon": "POLYGON",
}


class QueryExecutorError(Exception):
    """provider · model 을 찾을 수 없음 등 실행 전 오류 (OpenBB OpenBBError 자리)."""


def _to_snake_case(name: str) -> str:
    """
    PascalCase / camelCase → snake_case 변환

    Examples:
        "BalanceSheet"    → "balance_sheet"
        "IncomeStatement" → "income_statement"
        "gdp"             → "gdp"
    """
    s = re.sub(r"([A-Z]+)([A-Z][a-z])", r"\1_\2", name)
    s = re.sub(r"([a-z\d])([A-Z])", r"\1_\2", s)
    return s.lower()


def _resolve_fetcher(provider_obj: Provider, model: str) -> Type[Fetcher]:
    """
    provider.fetcher_dict에서 model 키로 Fetcher 조회.

    조회 순서:
        1. 전달된 model 그대로 (snake_case 키 사용 시)
        2. snake_case 변환 후 재시도  (PascalCase 모델명 허용)
    """
    if model in provider_obj.fetcher_dict:
        return provider_obj.fetcher_dict[model]

    snake = _to_snake_case(model)
    if snake in provider_obj.fetcher_dict:
        log.debug(f"Model '{model}' resolved to snake_case key '{snake}'")
        return provider_obj.fetcher_dict[snake]

    available = ", ".join(sorted(provider_obj.fetcher_dict.keys()))
    raise QueryExecutorError(
        f"Model '{model}' not found in provider '{provider_obj.name}'. "
        f"Available models: {available}"
    )


try:
    from data_fetcher.abstract_provider.standard_models._base import QueryParams as _ObbQueryParams
except Exception:  # noqa: BLE001
    _ObbQueryParams = None  # type: ignore[assignment]


def _fill_obb_query_defaults(
    qp_type: Type[BaseModel],
    params: Dict[str, Any],
) -> Dict[str, Any]:
    """OpenBB 이식 QueryParams 의 누락 필드를 모델 기본값으로 채운다.

    OpenBB fetcher 의 transform_query 는 표준 필드가 항상 존재한다고 가정하고
    직접 인덱싱하는 경우가 있어, 기본값(주로 None)을 미리 채워준다.
    필수 필드(기본값 없음)는 채우지 않아 모델 검증이 정상 동작하게 둔다.
    """
    if _ObbQueryParams is None or not issubclass(qp_type, _ObbQueryParams):
        return params
    from pydantic_core import PydanticUndefined

    out = dict(params)
    for name, field in qp_type.model_fields.items():
        if name in out or (field.alias and field.alias in out):
            continue
        default = field.get_default(call_default_factory=True)
        if default is not PydanticUndefined:
            out[name] = default
    return out


def _filter_extra_params(
    fetcher_cls: Type[Fetcher],
    params: Dict[str, Any],
    provider: str,
    model: str,
) -> Dict[str, Any]:
    """
    Fetcher의 query_params_type 모델 필드 기준으로 params 를 필터링.

    - 모델에 정의되지 않은 키 → WarningsCollector 에 경고 발생 후 params 에서 제거
    - model_config.extra == "allow" 인 경우 원본 params 그대로 반환 (자유형 Fetcher)

    Pydantic BaseModel 이 아닌 경우(하위 호환) 필터링 스킵.
    """
    try:
        qp_type = fetcher_cls.query_params_type
    except Exception:
        return params

    if not (isinstance(qp_type, type) and issubclass(qp_type, BaseModel)):
        return params

    # OpenBB 이식 fetcher 보정: OpenBB는 command 계층에서 표준 필드(start_date 등)를
    # 기본값과 함께 모두 채워 transform_query 에 넘긴다. 이 프로젝트 executor 는
    # 사용자 제공 param 만 넘기므로, transform_query 가 `params["start_date"]` 처럼
    # 직접 인덱싱하면 KeyError 가 난다. 누락 필드를 모델 기본값으로 채워 호환시킨다.
    params = _fill_obb_query_defaults(qp_type, params)

    # extra="allow" 설정 Fetcher 는 자유 필드 허용 → 필터링 안 함
    if getattr(qp_type, "model_config", {}).get("extra") == "allow":
        return params

    allowed = set(qp_type.model_fields.keys())
    # Pydantic alias 도 허용
    for field in qp_type.model_fields.values():
        if field.alias:
            allowed.add(field.alias)

    filtered: Dict[str, Any] = {}
    extras: List[str] = []
    for k, v in params.items():
        if k in allowed:
            filtered[k] = v
        else:
            extras.append(k)

    if extras:
        from data_fetcher.utils.warnings import add_warning
        for k in extras:
            add_warning(
                f"Unsupported param '{k}' for {provider}:{model} "
                f"({qp_type.__name__}) -- ignored."
            )

    return filtered


def _normalize_credentials(
    provider_name: str,
    credentials: Optional[Dict[str, str]],
) -> Optional[Dict[str, str]]:
    """credential 키 별칭 보정.

    프로젝트 키스토어/ENV는 'api_key'로 저장하지만 OpenBB 이식 fetcher는
    '<provider>_api_key'(예: eia_api_key, bls_api_key) 규약을 쓴다. 둘 다 채워
    어느 쪽 규약의 fetcher든 키를 찾을 수 있게 한다.
    """
    if not credentials:
        return credentials
    creds = dict(credentials)
    prefixed = f"{provider_name.lower()}_api_key"
    single = creds.get("api_key") or creds.get("key") or creds.get(prefixed)
    if single:
        creds.setdefault("api_key", single)
        creds.setdefault(prefixed, single)
    return creds


def _load_credentials(
    provider_obj: Provider,
    credentials: Optional[Dict[str, str]],
    require_credentials: bool = True,
) -> Optional[Dict[str, str]]:
    """
    credentials 우선순위:
        1. 호출자가 직접 전달한 credentials
        2. 환경 변수 자동 로드 (API_ENV_MAPPING 참조)
        3. 자격증명 불필요 provider → 빈 dict 반환
    """
    if not provider_obj.credentials:
        return _normalize_credentials(provider_obj.name, credentials) or {}

    if credentials:
        return _normalize_credentials(provider_obj.name, credentials)

    env_key = _PROVIDER_TO_ENV_KEY.get(provider_obj.name, provider_obj.name.upper())
    env_map = API_ENV_MAPPING.get(env_key)

    if not require_credentials:
        # 키 없이도 도는 fetcher — 환경 변수에 키가 있으면 넘기고, 없으면 빈 채로
        try:
            return _normalize_credentials(provider_obj.name, get_credentials_from_env(env_key, env_map)) if env_map else {}
        except CredentialsError:
            return {}

    if not env_map:
        raise CredentialsError(
            f"Provider '{provider_obj.name}' requires credentials "
            f"but no ENV mapping is configured. "
            f"Pass credentials explicitly."
        )

    try:
        return _normalize_credentials(
            provider_obj.name, get_credentials_from_env(env_key, env_map)
        )
    except CredentialsError as e:
        raise CredentialsError(
            f"Provider '{provider_obj.name}' credentials not found. "
            f"Required keys: {provider_obj.credentials}. "
            f"Original error: {e}"
        ) from e


class QueryExecutor:
    """provider 의 fetcher 를 실행한다 (OpenBB QueryExecutor 와 같은 모양)."""

    def __init__(self, registry: Optional[type] = None) -> None:
        self.registry = registry or ProviderRegistry

    def get_provider(self, provider_name: str) -> Provider:
        try:
            return self.registry.get(provider_name.lower())
        except KeyError as e:
            raise QueryExecutorError(str(e)) from e

    def get_fetcher(self, provider: Provider, model_name: str) -> Type[Fetcher]:
        return _resolve_fetcher(provider, model_name)

    @staticmethod
    def filter_credentials(
        credentials: Optional[Dict[str, str]],
        provider: Provider,
        require_credentials: bool,
    ) -> Dict[str, str]:
        """provider 가 받는 자격증명만. 안 주면 환경 변수. 필요한데 없으면 CredentialsError."""
        creds = _load_credentials(provider, credentials, require_credentials)
        if require_credentials:
            try:
                provider.validate_credentials(creds)
            except ValueError as e:
                raise CredentialsError(str(e)) from e
        return creds or {}

    async def execute(
        self,
        provider_name: str,
        model_name: str,
        params: Dict[str, Any],
        credentials: Optional[Dict[str, str]] = None,
        **kwargs: Any,
    ) -> Any:
        provider = self.get_provider(provider_name)
        fetcher = self.get_fetcher(provider, model_name)
        creds = self.filter_credentials(credentials, provider, fetcher.require_credentials)
        params = _filter_extra_params(fetcher, dict(params or {}), provider.name, model_name)
        log.debug("[QE] %s/%s → %s", provider.name, model_name, fetcher.__name__)
        return await fetcher.fetch_data(params, creds, **kwargs)


__all__ = ["QueryExecutor", "QueryExecutorError", "CredentialsError"]

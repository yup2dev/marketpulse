"""
QueryExecutor

Provider → Fetcher 조회 → 인증 → fetch_data() 까지의 공통 파이프라인.

┌──────────────────────────────────────────────────────────────┐
│  사용자 요청                                                   │
│    ↓                                                          │
│  [공통 처리 1] Provider 조회                                   │
│    ↓                                                          │
│  [공통 처리 2] Fetcher 조회                                    │
│    ↓                                                          │
│  [공통 처리 3] 인증 처리                                       │
│    ↓                                                          │
│  [공통 처리 4] Fetcher.fetch_data() 호출                       │
│               ├─ transform_query(params)                      │
│               ├─ await maybe_coroutine(extract_data, …)      │
│               └─ transform_data(query, data)                  │
└──────────────────────────────────────────────────────────────┘

Usage:
    result = await QueryExecutor.execute(
        provider="fmp",
        model="income_statement",
        params={"symbol": "AAPL"},
    )
"""
import asyncio
import logging
import re
from typing import Any, Dict, List, Optional, Type, Union

from pydantic import BaseModel

from data_fetcher.fetchers.base import AnnotatedResult, Fetcher
from data_fetcher.provider import Provider, ProviderRegistry
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
    """QueryExecutor 전용 오류"""
    pass


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
        # Lazy import to avoid circular dependency with data_fetcher.core
        from data_fetcher.core.warnings import add_warning
        for k in extras:
            add_warning(
                f"Unsupported param '{k}' for {provider}:{model} "
                f"({qp_type.__name__}) -- ignored."
            )

    return filtered


def _load_credentials(
    provider_obj: Provider,
    credentials: Optional[Dict[str, str]],
) -> Optional[Dict[str, str]]:
    """
    credentials 우선순위:
        1. 호출자가 직접 전달한 credentials
        2. 환경 변수 자동 로드 (API_ENV_MAPPING 참조)
        3. 자격증명 불필요 provider → 빈 dict 반환
    """
    if not provider_obj.credentials:
        return credentials or {}

    if credentials:
        return credentials

    env_key = _PROVIDER_TO_ENV_KEY.get(provider_obj.name, provider_obj.name.upper())
    env_map = API_ENV_MAPPING.get(env_key)

    if not env_map:
        raise CredentialsError(
            f"Provider '{provider_obj.name}' requires credentials "
            f"but no ENV mapping is configured. "
            f"Pass credentials explicitly."
        )

    try:
        return get_credentials_from_env(env_key, env_map)
    except CredentialsError as e:
        raise CredentialsError(
            f"Provider '{provider_obj.name}' credentials not found. "
            f"Required keys: {provider_obj.credentials}. "
            f"Original error: {e}"
        ) from e


class QueryExecutor:
    """
    공통 실행 파이프라인

    단계:
        [1] ProviderRegistry에서 Provider 조회
        [2] provider.fetcher_dict에서 Fetcher 조회 (PascalCase → snake_case 자동 변환)
        [3] 자격증명 로드 및 검증
        [4] fetcher.fetch_data(params, credentials) 호출
            → transform_query → extract_data → transform_data
    """

    @classmethod
    async def fetch(
        cls,
        provider: str,
        model: str,
        params: Dict[str, Any],
        credentials: Optional[Dict[str, str]] = None,
        **kwargs: Any,
    ) -> Union[List[Any], AnnotatedResult]:
        """
        비동기 실행

        Args:
            provider:    Provider 이름 (예: "fmp", "yahoo", "fred")
            model:       Fetcher 모델 키 (예: "income_statement", "IncomeStatement")
            params:      Fetcher에 전달할 쿼리 파라미터
            credentials: API 자격증명 (None이면 환경 변수에서 자동 로드)
            **kwargs:    fetch_data에 추가로 전달할 옵션

        Returns:
            List[DataModel] 또는 AnnotatedResult[List[DataModel]]
        """
        # [공통 처리 1] Provider 조회
        try:
            provider_obj: Provider = ProviderRegistry.get(provider)
        except KeyError as e:
            raise QueryExecutorError(str(e)) from e

        # [공통 처리 2] Fetcher 조회
        fetcher_cls = _resolve_fetcher(provider_obj, model)

        # [공통 처리 3] 자격증명 처리 및 검증
        resolved_creds = _load_credentials(provider_obj, credentials)
        provider_obj.validate_credentials(resolved_creds)

        # [공통 처리 3.5] 미지원 파라미터 필터링 + 경고
        filtered_params = _filter_extra_params(
            fetcher_cls, params, provider, model
        )

        log.debug(
            f"QueryExecutor: provider={provider}, model={model}, "
            f"fetcher={fetcher_cls.__name__}"
        )

        # [공통 처리 4] Fetcher.fetch_data() 호출
        return await fetcher_cls.fetch_data(
            params=filtered_params,
            credentials=resolved_creds,
            **kwargs,
        )

    @classmethod
    def fetch_sync(
        cls,
        provider: str,
        model: str,
        params: Dict[str, Any],
        credentials: Optional[Dict[str, str]] = None,
        **kwargs: Any,
    ) -> Union[List[Any], AnnotatedResult]:
        """동기 실행 (fetch의 동기 래퍼)"""
        return asyncio.run(
            cls.fetch(provider, model, params, credentials, **kwargs)
        )

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
import json
import logging
import re
from typing import Any, Dict, List, Optional, Protocol, Type, Union, runtime_checkable

from pydantic import BaseModel

from data_fetcher.fetchers.base import AnnotatedResult, Fetcher
from data_fetcher.provider import Provider, ProviderRegistry
from data_fetcher.utils.api_keys import (
    API_ENV_MAPPING,
    CredentialsError,
    get_credentials_from_env,
)

log = logging.getLogger(__name__)


@runtime_checkable
class CacheProtocol(Protocol):
    """cache.get / cache.set 인터페이스 — app.backend에 의존하지 않음."""
    async def get(self, key: str) -> Optional[Any]: ...
    async def set(self, key: str, value: Any, ttl: int) -> None: ...


# 모델별 기본 TTL(초).  0 = 캐시 안 함.
_DEFAULT_TTL: Dict[str, int] = {
    # ── Real-time (30-60s) ───────────────────────────────────────────────────
    "stock_price":              60,
    "batch_quotes":             30,
    "orderbook":                30,
    # ── Semi-fresh (5-15min) ────────────────────────────────────────────────
    "news":                    300,
    "earnings":                600,
    "sentiment":               300,
    "calendar":                600,
    "options":                 300,
    "short_interest":          900,
    "technical_indicators":    300,
    "quote":                    60,   # alphavantage / fmp quote
    "most_actives":            120,
    "gainers":                 120,
    "losers":                  120,
    # ── Daily (30-60min) ────────────────────────────────────────────────────
    "financials":             1800,
    "balance_sheet":          1800,
    "quarterly_pnl":          1800,
    "estimates":              1800,
    "analyst_data":           1800,
    "analyst_estimates":      1800,
    "analyst_recommendations":1800,
    "holders":                1800,
    "insider_trading":        1800,
    "insider_trading_summary":1800,
    "insider_holders":        1800,
    "dividends":              3600,
    "splits":                 3600,
    "filings":                3600,
    "revenue_segments":       3600,
    "search":                 1800,
    "timeseries":             1800,
    "series":                 3600,
    "bond_prices":            3600,
    # ── FRED macro (1h) ─────────────────────────────────────────────────────
    "gdp":                          3600,
    "cpi":                          3600,
    "unemployment":                 3600,
    "interest_rate":                3600,
    "employment":                   3600,
    "industrial_production":        3600,
    "consumer_sentiment":           3600,
    "housing_starts":               3600,
    "retail_sales":                 3600,
    "nonfarm_payroll":              3600,
    # ── FRED composite / multi-series (1h) ─────────────────────────────────
    "fed_balance_sheet":            3600,
    "real_rates":                   3600,
    "pmi":                          3600,
    "yield_curve":                  1800,  # snapshot — intraday 변동
    "yield_curve_history":          3600,
    "inflation_momentum":           3600,
    "inflation_sector":             3600,
    "initial_claims":               3600,
    "jobs_breakdown":               3600,
    "phillips_curve":               7200,  # 분기별 GDP 기반 — 느리게 변함
    "regime_history":               7200,
    "financial_conditions_history": 3600,
    "financial_conditions":         1800,  # snapshot — 크레딧 스프레드 일중 변동
    "sentiment_composite":          1800,  # snapshot — VIX 일중 변동
    "sentiment_history":            3600,
    "labor_dashboard":              1800,  # snapshot — 다수 현재값
    # ── Yahoo quote (별칭 구분) ─────────────────────────────────────────────
    "quote":                          60,  # yahoo:quote (StockQuoteFetcher)
    # ── Mostly static (1h+) ─────────────────────────────────────────────────
    "company_info":           3600,
    "key_metrics":            3600,
    "management":             3600,
    "moat":                   3600,
    "swot":                   3600,
    "scorecard":              3600,
    "company_profile":        3600,
    "company_overview":       3600,
    "income_statement":       3600,
    "index_constituents":     7200,
    "stock_list":             7200,
    "institutional_holdings": 3600,
    "institutions_list":      7200,
    "filing_13f":             7200,
    "institutional_13f":      7200,
    # ── No cache — computed on-the-fly ──────────────────────────────────────
    "capm":                      0,
    "rolling":                   0,
    "normality":                 0,
    "unitroot":                  0,
    "summary":                   0,
    "pricing":                   0,
}


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
        [1] 캐시 조회 (hit → 즉시 반환)
        [2] ProviderRegistry에서 Provider 조회
        [3] provider.fetcher_dict에서 Fetcher 조회 (PascalCase → snake_case 자동 변환)
        [4] 자격증명 로드 및 검증
        [5] fetcher.fetch_data(params, credentials) 호출
            → transform_query → extract_data → transform_data
        [6] 결과 캐시 저장
    """

    _cache: Optional[CacheProtocol] = None
    _ttl_map: Dict[str, int] = dict(_DEFAULT_TTL)

    # ── 캐시 주입 ────────────────────────────────────────────────────────────

    @classmethod
    def configure(
        cls,
        cache: CacheProtocol,
        ttl_map: Optional[Dict[str, int]] = None,
    ) -> None:
        """앱 시작 시 캐시 백엔드 주입. data_fetcher는 app.backend를 직접 import하지 않는다.

        Args:
            cache:   CacheProtocol을 구현한 객체 (CacheManager 등)
            ttl_map: 모델별 TTL 오버라이드 (기본값 _DEFAULT_TTL 위에 병합)
        """
        cls._cache = cache
        if ttl_map:
            cls._ttl_map.update(ttl_map)
        log.info(f"[QueryExecutor] Cache configured: {type(cache).__name__}")

    @classmethod
    def _cache_key(cls, provider: str, model: str, params: Dict[str, Any]) -> str:
        params_str = json.dumps(params, sort_keys=True, default=str)
        return f"qe:{provider}:{model}:{params_str}"

    @classmethod
    def _ttl(cls, model: str) -> int:
        return cls._ttl_map.get(model, 0)

    # ── 실행 ─────────────────────────────────────────────────────────────────

    @classmethod
    async def fetch(
        cls,
        provider: str,
        model: str,
        params: Dict[str, Any],
        credentials: Optional[Dict[str, str]] = None,
        ttl: Optional[int] = None,
        **kwargs: Any,
    ) -> Union[List[Any], AnnotatedResult]:
        """비동기 실행.

        Args:
            provider:    Provider 이름 (예: "fmp", "yahoo", "fred")
            model:       Fetcher 모델 키 (예: "income_statement", "IncomeStatement")
            params:      Fetcher에 전달할 쿼리 파라미터
            credentials: API 자격증명 (None이면 환경 변수에서 자동 로드)
            ttl:         캐시 TTL 초. None이면 _ttl_map 기본값 사용. 0이면 캐시 안 함.
            **kwargs:    fetch_data에 추가로 전달할 옵션
        """
        effective_ttl = cls._ttl(model) if ttl is None else ttl

        # [1] 캐시 조회
        cache_key: Optional[str] = None
        if cls._cache and effective_ttl > 0:
            cache_key = cls._cache_key(provider, model, params)
            hit = await cls._cache.get(cache_key)
            if hit is not None:
                log.debug(f"[Cache HIT] {cache_key[:80]}")
                return hit

        # [2] Provider 조회
        try:
            provider_obj: Provider = ProviderRegistry.get(provider)
        except KeyError as e:
            raise QueryExecutorError(str(e)) from e

        # [3] Fetcher 조회
        fetcher_cls = _resolve_fetcher(provider_obj, model)

        # [4] 자격증명 처리 및 검증
        resolved_creds = _load_credentials(provider_obj, credentials)
        provider_obj.validate_credentials(resolved_creds)

        # [4.5] 미지원 파라미터 필터링 + 경고
        filtered_params = _filter_extra_params(fetcher_cls, params, provider, model)

        log.debug(f"[QueryExecutor] provider={provider} model={model} fetcher={fetcher_cls.__name__}")

        # [5] Fetcher.fetch_data() 호출
        result = await fetcher_cls.fetch_data(
            params=filtered_params,
            credentials=resolved_creds,
            **kwargs,
        )

        # [6] 캐시 저장
        if cls._cache and cache_key and result is not None:
            await cls._cache.set(cache_key, result, effective_ttl)

        return result

    @classmethod
    def fetch_sync(
        cls,
        provider: str,
        model: str,
        params: Dict[str, Any],
        credentials: Optional[Dict[str, str]] = None,
        ttl: Optional[int] = None,
        **kwargs: Any,
    ) -> Union[List[Any], AnnotatedResult]:
        """동기 실행 (fetch의 동기 래퍼)."""
        return asyncio.run(cls.fetch(provider, model, params, credentials, ttl=ttl, **kwargs))

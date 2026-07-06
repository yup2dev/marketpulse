"""유형별 중간 Fetcher 베이스 클래스.

Fetcher(TET 파이프라인)와 구체 fetcher 사이에서 유형별 보일러플레이트를 흡수한다.

    ApiFetcher      원격 HTTP API (async·sync 모두 허용, API 키 선언형)
    DbFetcher       로컬 SQLite 조회 (세션 관리)
    ComputeFetcher  순수 로컬 계산 (numpy/QuantLib 등)
    LibraryFetcher  서드파티 라이브러리 래퍼 (yfinance/pykrx 등)
    YFinanceFetcher LibraryFetcher의 yfinance 특화

규칙:
  - 모든 베이스는 Generic TypeVar를 그대로 전달한다: ``class X(Fetcher[Q, R])``.
  - 구체 클래스는 반드시 subscript를 유지한다: ``class My(ApiFetcher[MyQuery, MyData])``.
    (fetcher.py의 _generic_args()가 query_params_type을 해석하는 근거)
  - ``_intermediate_base = True`` 마커로 __init_subclass__의 extract 구현 검사를 면제받는다.
  - 서킷브레이커/credentials 해석은 query_executor가 외부에서 수행하므로 여기서 재래핑하지 않는다.
"""
import os
from contextlib import contextmanager
from typing import Any, Callable, ClassVar, Dict, Optional

from data_fetcher.abstract_provider.abstract.fetcher import Fetcher, Q, R


# ── ApiFetcher ────────────────────────────────────────────────────────────────

class ApiFetcher(Fetcher[Q, R]):
    """원격 HTTP API fetcher.

    서브클래스는 둘 중 하나를 택한다:
      (a) 기존처럼 aextract_data / extract_data(sync 허용)를 직접 구현 — 마이그레이션용
      (b) build_url(+선택적 response_callback)만 선언하고 기본 aextract_data를 상속 — 신규용

    API 키는 선언형으로:
        api_name = "FMP"                  # 에러 메시지용
        api_key_env = "FMP_API_KEY"       # 환경변수 폴백
        credential_key = "fmp_api_key"    # credentials dict 키 (기본 "api_key")
    무인증 API는 ``require_credentials = False`` 만 선언하면 get_api_key가 None을 반환한다.
    """

    _intermediate_base = True

    api_name: ClassVar[Optional[str]] = None
    api_key_env: ClassVar[Optional[str]] = None
    credential_key: ClassVar[str] = "api_key"
    #: OpenBB 호환 (response, session) 콜백 — aiohttp ClientResponse를 받는다
    response_callback: ClassVar[Optional[Callable]] = None
    #: amake_request(s)에 전달할 추가 kwargs (예: {"timeout": 30})
    request_kwargs: ClassVar[Dict[str, Any]] = {}

    @classmethod
    def get_api_key(cls, credentials: Optional[Dict[str, str]] = None) -> Optional[str]:
        """credentials[credential_key] → "api_key"/"key" → env 순서로 API 키 조회.

        require_credentials=True인데 키가 없으면 CredentialsError.
        """
        creds = credentials or {}
        key = (
            creds.get(cls.credential_key)
            or creds.get("api_key")
            or creds.get("key")
        )
        if not key and cls.api_key_env:
            key = os.getenv(cls.api_key_env)
        if not key and cls.require_credentials:
            from data_fetcher.utils.api_keys import CredentialsError

            hint = f" Set {cls.api_key_env}." if cls.api_key_env else ""
            raise CredentialsError(
                f"{cls.api_name or cls.__name__} API key required.{hint}"
            )
        return key

    @staticmethod
    def build_url(query: Any, api_key: Optional[str]) -> "str | list[str]":
        """선언형 서브클래스용 훅 — 요청 URL(단일 또는 리스트)을 만든다."""
        raise NotImplementedError(
            "Declarative ApiFetcher subclasses must implement build_url "
            "(or override aextract_data/extract_data directly)."
        )

    @classmethod
    async def aextract_data(
        cls,
        query: Q,
        credentials: Optional[Dict[str, str]] = None,
        **kwargs: Any,
    ) -> Any:
        """기본 구현: build_url → provider_helpers.amake_request(s)."""
        from data_fetcher.utils.provider_helpers import amake_request, amake_requests

        urls = cls.build_url(query, cls.get_api_key(credentials))
        req = {**cls.request_kwargs, **kwargs}
        if isinstance(urls, (list, tuple)):
            return await amake_requests(
                list(urls), response_callback=cls.response_callback, **req
            )
        return await amake_request(
            urls, response_callback=cls.response_callback, **req
        )


# ── DbFetcher ─────────────────────────────────────────────────────────────────

class DbFetcher(Fetcher[Q, R]):
    """로컬 SQLite 조회 fetcher.

    ``with cls.db_session(**kwargs) as session:`` 로 세션을 얻는다.
    경로 우선순위: kwargs["db_path"] → cls.db_path → index_analyzer 기본 DB.
    """

    _intermediate_base = True
    require_credentials = False

    db_path: ClassVar[Optional[str]] = None

    @classmethod
    def _resolve_db_path(cls, **kwargs: Any) -> str:
        if kwargs.get("db_path"):
            return str(kwargs["db_path"])
        if cls.db_path:
            return str(cls.db_path)
        from index_analyzer.utils.db import DB_PATH

        return str(DB_PATH)

    @classmethod
    @contextmanager
    def db_session(cls, **kwargs: Any):
        """SQLAlchemy 세션 컨텍스트 매니저 (자동 close)."""
        from index_analyzer.utils.db import get_sqlite_db

        session = get_sqlite_db(cls._resolve_db_path(**kwargs)).get_session()
        try:
            yield session
        finally:
            session.close()


# ── ComputeFetcher ────────────────────────────────────────────────────────────

class ComputeFetcher(Fetcher[Q, R]):
    """순수 로컬 계산 fetcher — 네트워크·credentials 없음 (quantitative/quantlib)."""

    _intermediate_base = True
    require_credentials = False


# ── LibraryFetcher ────────────────────────────────────────────────────────────

class LibraryFetcher(Fetcher[Q, R]):
    """서드파티 라이브러리 래퍼 fetcher (yfinance, pykrx 등)."""

    _intermediate_base = True
    require_credentials = False

    library_name: ClassVar[str] = ""


class YFinanceFetcher(LibraryFetcher[Q, R]):
    """yfinance 래퍼 공통 베이스."""

    _intermediate_base = True
    library_name = "yfinance"

    @staticmethod
    def get_ticker(symbol: str):
        """yf.Ticker 생성 (지연 import)."""
        import yfinance as yf

        return yf.Ticker(symbol)


__all__ = [
    "ApiFetcher",
    "DbFetcher",
    "ComputeFetcher",
    "LibraryFetcher",
    "YFinanceFetcher",
]

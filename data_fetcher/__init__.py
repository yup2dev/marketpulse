"""
data_fetcher — 금융 데이터 수집 라이브러리

주요 진입점:
    from data_fetcher.query_executor import QueryExecutor
    from data_fetcher.abstract_provider.abstract import Fetcher, BaseData, BaseQueryParams
    from data_fetcher.abstract_provider.abstract.provider import Provider, ProviderRegistry
    from data_fetcher.abstract_provider.standard_models import EquityQuoteData, ...
    from data_fetcher.providers.{name}.fetchers.{module} import {FetcherClass}
"""
__version__ = "0.1.0"


def _ensure_ca_bundle() -> None:
    """certifi CA 번들을 SSL_CERT_FILE 등으로 노출한다.

    aiohttp의 기본 SSLContext(ssl.create_default_context)는 macOS 등에서 시스템 CA를
    찾지 못해 인증서 검증에 실패할 수 있다(특히 sec fetcher의 aiohttp_client_cache
    CachedSession이 connector 없이 생성되는 경로). certifi 경로를 환경변수로 지정하면
    OpenSSL 기본 컨텍스트와 requests가 모두 동일 번들을 사용한다.
    이미 설정돼 있으면 덮어쓰지 않는다(운영 환경 우선).
    """
    import os

    try:
        import certifi
    except ImportError:  # certifi 없으면 그대로 둔다
        return

    ca = certifi.where()
    for var in ("SSL_CERT_FILE", "REQUESTS_CA_BUNDLE"):
        os.environ.setdefault(var, ca)


_ensure_ca_bundle()

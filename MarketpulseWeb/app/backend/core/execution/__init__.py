"""웹 서버의 조회 실행 계층 — 어디서 실행할지(로컬 전용 / 서버) · 캐시 · 사용자 키 · 서킷브레이커.

    executor.py         ServerExecutor — 조회 한 곳. Query(app 계층) · commands · 서비스 · 웹소켓이 모두 여기로
    routes.py           (provider, model) 실행 위치 — fetcher target (local / server), data_model_routes 는 긴급 전환
    context.py          요청 사용자 (current_user_id)
    errors.py           MissingCredentialsError(424) · RemoteUnavailableError(503) · FetcherOutdatedError(503)
    revalidate.py       PC Fetcher 결과를 fetcher data_type 으로 재검증 (Partial + 격리)
    circuit_breaker.py  provider 별 서킷브레이커
    ttl.py              모델별 캐시 TTL

fetcher 패키지(MarketpulseFetcher/data_fetcher)는 이 계층을 모른다 — 순수 실행(QueryExecutor)만 한다.
install() 이 app 계층의 executor 자리(ProviderInterface.set_executor)에 ServerExecutor 를 끼운다.
"""
from app.backend.core.execution.context import current_user_id
from app.backend.core.execution.errors import MissingCredentialsError, RemoteUnavailableError
from app.backend.core.execution.executor import (
    RemoteTransport, ServerExecutor, fetch, fetch_blocking, rows_blocking,
)

__all__ = [
    "ServerExecutor", "fetch", "fetch_blocking", "rows_blocking", "install", "current_user_id", "RemoteTransport",
    "MissingCredentialsError", "RemoteUnavailableError",
]


def install() -> None:
    """Query.execute 가 ServerExecutor 를 쓰게 한다 (앱 import 때 한 번)."""
    from app.backend.platform.provider_interface import ProviderInterface

    ProviderInterface.set_executor(ServerExecutor())

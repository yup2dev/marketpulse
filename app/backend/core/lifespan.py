"""앱 수명주기 — 기동 시 초기화와 종료 시 정리.

main.py 에서 분리했다. 여기서 뜨는 것(캐시·Pub/Sub·WS 스트림·워밍업 태스크)은
전부 종료 시 대칭으로 정리돼야 하므로, yield 앞뒤를 한 화면에서 보게 둔다.
"""
import asyncio
import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.backend.core.config import settings
from app.backend.core.db import init_db

log = logging.getLogger(__name__)


def _build_fetcher_client():
    """FETCHER_REMOTE_ENABLED 설정에 맞는 Fetcher 위임 클라이언트(없으면 None).

    FETCHER_REMOTE_ENABLED=True 면 모든 데이터 조회를 로컬 Fetcher(exe) REST로 위임한다.
    (배포 WebServer는 provider 키를 갖지 않음 — 키와 외부 호출은 Fetcher에 집중)
    False(기본)에서는 기존처럼 백엔드가 provider를 직접 호출한다.
    """
    if not settings.FETCHER_REMOTE_ENABLED:
        return None

    if settings.FETCHER_WORKER_MODE:
        # 사용자 PC의 Fetcher가 /ws/fetcher 로 outbound 접속(push) → 워커 풀에 위임
        from app.backend.core.fetcher_ws_transport import WSFetcherTransport
        log.info("[startup] Fetcher 위임 활성화 (WS 워커 풀, /ws/fetcher)")
        return WSFetcherTransport(timeout=settings.FETCHER_TIMEOUT)

    from app.backend.core.fetcher_client import FetcherClient
    # 풀 모드는 백엔드와 Fetcher가 같은 PC에서 돌며 data_fetcher 패키지의
    # 공유 토큰 파일(%APPDATA%\MarketPulseFetcher\token)을 함께 쓴다.
    # FETCHER_TOKEN 을 .env 로 수동 지정하지 않아도, Fetcher 가 생성한
    # 그 토큰을 여기서 그대로 읽어 401 을 방지한다(명시 설정이 있으면 우선).
    fetcher_token = settings.FETCHER_TOKEN
    if not fetcher_token:
        try:
            from data_fetcher.server.auth import get_or_create_token
            fetcher_token = get_or_create_token()
        except Exception as exc:  # 파일 접근 실패 등은 무시(토큰 없이 진행)
            log.warning("[startup] 로컬 Fetcher 토큰 자동 로드 실패: %s", exc)
    log.info("[startup] Fetcher 위임 활성화 → %s", settings.FETCHER_URL)
    return FetcherClient(
        base_url=settings.FETCHER_URL,
        timeout=settings.FETCHER_TIMEOUT,
        token=fetcher_token or None,
    )


@asynccontextmanager
async def lifespan(app: FastAPI):
    import data_fetcher.providers_init  # noqa: F401 — registers all providers/fetchers
    init_db()

    from app.backend.services.symbol_cache import get_symbol_cache
    await get_symbol_cache().ensure_loaded()

    from app.backend.core.cache import cache
    from data_fetcher.query_executor import QueryExecutor
    await cache.init(redis_url=settings.REDIS_URL if settings.QUEUE_ENABLED else None)
    fetcher_client = _build_fetcher_client()

    # key-only provider(Class B)를 서버에서 '요청 사용자의 키'로 호출하기 위한 해석기.
    # current_user_id별로 DB에 저장된 사용자 키를 복호화해 반환한다.
    def _credential_resolver(provider: str, user_id: str):
        from app.backend.services.user_key_service import get_credentials
        return get_credentials(user_id, provider)

    # server_mode: 13F 원본 파싱 모델(_local_only_models)을 이 서버 프로세스에서 실행하지 않는다.
    QueryExecutor.configure(
        cache=cache, remote=fetcher_client, credential_resolver=_credential_resolver,
        server_mode=True,
    )

    # ── Redis Pub/Sub (멀티워커 WS fan-out) ──────────────────────────────────
    from app.backend.core.pubsub import init_pubsub, close_pubsub
    from app.backend.api.routes.ws import register_pubsub_handlers, quote_publisher_loop
    await init_pubsub(redis_url=settings.REDIS_URL if settings.QUEUE_ENABLED else None)
    register_pubsub_handlers()

    quote_pub_task = asyncio.create_task(quote_publisher_loop())

    # KIS(한국투자증권) 실시간 체결 스트림 — KIS_APPKEY/SECRET 없으면 즉시 종료(폴링 백업)
    from app.backend.api.routes.ws import kis_stream_loop
    kis_task = asyncio.create_task(kis_stream_loop(env=os.getenv("KIS_ENV", "real")))

    from app.backend.services.ranking_service import warmup_ranking_loop
    warmup_task = asyncio.create_task(warmup_ranking_loop())

    from app.backend.services.stock_list_service import refresh_cache, stock_list_warmup_loop
    await refresh_cache()
    stock_list_task = asyncio.create_task(stock_list_warmup_loop())

    yield

    quote_pub_task.cancel()
    kis_task.cancel()
    warmup_task.cancel()
    stock_list_task.cancel()
    if fetcher_client is not None:
        await fetcher_client.aclose()
    await cache.close()
    await close_pubsub()

    from data_fetcher.utils.provider_helpers import aclose_shared_session
    await aclose_shared_session()

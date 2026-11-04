"""동기 extract_data가 이벤트 루프를 막지 않는지 (워커 스레드 실행 + contextvar 전달)."""
import asyncio
import threading
import time

import pytest

from data_fetcher.abstract_provider.abstract.base_fetchers import ApiFetcher
from data_fetcher.abstract_provider.abstract.data import BaseData
from data_fetcher.abstract_provider.abstract.query_params import BaseQueryParams
from data_fetcher.query_executor import current_user_id


class _Q(BaseQueryParams):
    delay: float = 0.3


class _D(BaseData):
    thread: str
    user: str | None = None


class _SyncFetcher(ApiFetcher[_Q, _D]):
    require_credentials = False

    @staticmethod
    def transform_query(params):
        return _Q(**params)

    @staticmethod
    def extract_data(query, credentials=None, **kwargs):
        time.sleep(query.delay)   # requests 같은 블로킹 호출 흉내
        return {"thread": threading.current_thread().name, "user": current_user_id.get()}

    @staticmethod
    def transform_data(query, data, **kwargs):
        return [_D(**data)]


class _AsyncFetcher(ApiFetcher[_Q, _D]):
    require_credentials = False

    @staticmethod
    def transform_query(params):
        return _Q(**params)

    @staticmethod
    async def aextract_data(query, credentials=None, **kwargs):
        return {"thread": threading.current_thread().name}

    @staticmethod
    def transform_data(query, data, **kwargs):
        return [_D(**data)]


@pytest.mark.asyncio
async def test_sync_extract_runs_off_loop_and_keeps_context():
    token = current_user_id.set("user-1")
    try:
        ticks = 0

        async def heartbeat():
            nonlocal ticks
            while True:
                await asyncio.sleep(0.02)
                ticks += 1

        hb = asyncio.create_task(heartbeat())
        row = (await _SyncFetcher.fetch_data({"delay": 0.3}))[0]
        hb.cancel()
    finally:
        current_user_id.reset(token)

    assert row.thread != threading.current_thread().name   # 워커 스레드에서 실행
    assert row.user == "user-1"                              # contextvar 전달
    assert ticks >= 5                                        # 그동안 루프가 계속 돌았다


@pytest.mark.asyncio
async def test_sync_fetchers_run_concurrently():
    t0 = time.perf_counter()
    await asyncio.gather(*(_SyncFetcher.fetch_data({"delay": 0.3}) for _ in range(4)))
    assert time.perf_counter() - t0 < 0.9   # 직렬이면 1.2초


@pytest.mark.asyncio
async def test_async_extract_stays_on_loop():
    row = (await _AsyncFetcher.fetch_data({}))[0]
    assert row.thread == threading.current_thread().name


def test_fetch_data_sync_still_works():
    assert _SyncFetcher.fetch_data_sync({"delay": 0})[0].user is None

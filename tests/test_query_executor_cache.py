"""QueryExecutor 캐시 상태기계 테스트 — 네트워크 없음.

QueryExecutor 는 이 프로젝트에서 가장 부하가 큰 경로다(모든 데이터 조회가 여길 지난다).
캐시 로직이 조용히 깨지면 provider 호출이 폭증해 작은 운영 서버가 먼저 죽는다.
그래서 업스트림 호출 '횟수'를 계약으로 고정한다.

검증 대상:
  - MISS  → 업스트림 1회, 이후 HIT 는 0회
  - single-flight → 동시 N 요청도 업스트림 1회
  - SWR   → freshness 만료 시 stale 즉시 반환 + 백그라운드 1회 갱신
  - ttl=0 → 캐시 우회
"""
import asyncio

import pytest

from data_fetcher.query_executor import QueryExecutor


class FakeCache:
    """TTL 을 흉내내는 인메모리 캐시. expire()로 시간 경과를 직접 조작한다."""

    def __init__(self):
        self.store: dict = {}

    async def get(self, key):
        return self.store.get(key)

    async def set(self, key, value, ttl):
        self.store[key] = value

    def expire(self, key):
        self.store.pop(key, None)


@pytest.fixture
def qe(monkeypatch):
    """QueryExecutor 의 클래스 전역 상태를 격리한다 (테스트 간 누수 방지)."""
    cache = FakeCache()
    calls = []

    async def fake_upstream(provider, model, params, credentials=None, **kwargs):
        calls.append((provider, model, tuple(sorted(params.items()))))
        return [{"symbol": params.get("symbol"), "n": len(calls)}]

    monkeypatch.setattr(QueryExecutor, "_cache", cache)
    monkeypatch.setattr(QueryExecutor, "_inflight", {})
    monkeypatch.setattr(QueryExecutor, "_swr_pending", set())
    monkeypatch.setattr(QueryExecutor, "_upstream_fetch", staticmethod(fake_upstream))

    return type("QE", (), {"cache": cache, "calls": calls})


async def test_miss_then_hit_calls_upstream_once(qe):
    first = await QueryExecutor.fetch("fmp", "quote", {"symbol": "AAPL"}, ttl=60)
    second = await QueryExecutor.fetch("fmp", "quote", {"symbol": "AAPL"}, ttl=60)

    assert first == second
    assert len(qe.calls) == 1, "fresh HIT 인데 업스트림을 다시 호출했다"


async def test_different_params_are_cached_separately(qe):
    await QueryExecutor.fetch("fmp", "quote", {"symbol": "AAPL"}, ttl=60)
    await QueryExecutor.fetch("fmp", "quote", {"symbol": "MSFT"}, ttl=60)
    await QueryExecutor.fetch("fmp", "quote", {"symbol": "AAPL"}, ttl=60)

    assert len(qe.calls) == 2


async def test_param_order_does_not_change_cache_key(qe):
    """_cache_key 는 sort_keys=True 로 직렬화한다 — 키 순서가 캐시를 쪼개면 안 된다."""
    await QueryExecutor.fetch("fmp", "hist", {"symbol": "AAPL", "start": "2026-01-01"}, ttl=60)
    await QueryExecutor.fetch("fmp", "hist", {"start": "2026-01-01", "symbol": "AAPL"}, ttl=60)

    assert len(qe.calls) == 1


async def test_single_flight_collapses_concurrent_misses(qe):
    """동시 MISS 10건이 업스트림 1회로 합쳐져야 한다 (스탬피드 방지)."""
    results = await asyncio.gather(*[
        QueryExecutor.fetch("fmp", "quote", {"symbol": "AAPL"}, ttl=60)
        for _ in range(10)
    ])

    assert len(qe.calls) == 1, f"스탬피드 — 업스트림이 {len(qe.calls)}회 호출됐다"
    assert all(r == results[0] for r in results)


async def test_stale_hit_returns_immediately_and_refreshes_in_background(qe):
    """freshness 플래그만 만료된 상태 = stale. 즉시 stale 을 주고 뒤에서 갱신한다."""
    await QueryExecutor.fetch("fmp", "quote", {"symbol": "AAPL"}, ttl=60)
    assert len(qe.calls) == 1

    # freshness 플래그만 지운다 → 값은 살아 있음 (stale TTL 은 더 길다)
    key = QueryExecutor._cache_key("fmp", "quote", {"symbol": "AAPL"})
    qe.cache.expire(f"{key}:f")

    stale = await QueryExecutor.fetch("fmp", "quote", {"symbol": "AAPL"}, ttl=60)
    assert stale == [{"symbol": "AAPL", "n": 1}], "stale 값을 즉시 반환해야 한다"

    # 백그라운드 SWR 태스크가 끝날 때까지 양보
    for _ in range(10):
        await asyncio.sleep(0)
        if len(qe.calls) > 1:
            break

    assert len(qe.calls) == 2, "SWR 백그라운드 갱신이 돌지 않았다"

    # 갱신 후에는 새 값이 fresh 로 서빙된다
    fresh = await QueryExecutor.fetch("fmp", "quote", {"symbol": "AAPL"}, ttl=60)
    assert fresh == [{"symbol": "AAPL", "n": 2}]
    assert len(qe.calls) == 2


async def test_ttl_zero_bypasses_cache(qe):
    """ttl=0 이면 매번 업스트림을 친다 (실시간 조회 경로)."""
    await QueryExecutor.fetch("fmp", "quote", {"symbol": "AAPL"}, ttl=0)
    await QueryExecutor.fetch("fmp", "quote", {"symbol": "AAPL"}, ttl=0)

    assert len(qe.calls) == 2
    assert qe.cache.store == {}, "ttl=0 인데 캐시에 썼다"

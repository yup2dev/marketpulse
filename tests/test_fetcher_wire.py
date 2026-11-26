"""PC Fetcher ↔ 서버 — hello(버전 · 실행 가능한 fetcher) 와 PC 결과 재검증.

    hello      PC Fetcher 가 접속 직후 보낸다 (data_fetcher.server.wire). 서버 워커 풀은 hello 의 fetchers 에
               있는 (provider, model) 만 그 워커에 위임하고, 없으면 FetcherOutdatedError(503, exe 업데이트 안내).
    재검증     PC 가 JSON 으로 보낸 행을 fetcher 의 data_type 으로 되살린다 — 서버 실행과 같은 Data 타입.
               실패 행은 결과에 섞지 않고 빼며(Partial + 격리) validation_failed 경고를 남긴다.
"""
import asyncio
import json
from datetime import date

import pytest

import data_fetcher.providers_init  # noqa: F401 — provider 등록
from app.backend.core.execution import ServerExecutor, current_user_id, routes
from app.backend.core.execution.errors import FetcherOutdatedError
from app.backend.core.execution.revalidate import revalidate
from app.backend.core.fetcher_pool import FetcherWorkerOutdated, FetcherWorkerPool
from data_fetcher.abstract_provider.abstract.annotated_result import AnnotatedResult
from data_fetcher.core.warnings import WarningsCollector
from data_fetcher.server import wire

ROW = {"symbol": "AAPL", "date": "2026-11-20", "open": 1.0, "high": 2.0, "low": 0.5, "close": 1.5, "volume": 10}


class _WS:
    def __init__(self):
        self.sent = []

    async def send_text(self, text):
        self.sent.append(json.loads(text))


def _hello(fetchers, protocol=wire.PROTOCOL_VERSION):
    return {"type": wire.HELLO, "fetcher_version": "9.9.9", "protocol_version": protocol, "fetchers": fetchers}


async def _fetch_and_answer(pool, worker_id, ws, provider, model):
    task = asyncio.ensure_future(pool.fetch("u1", provider, model, {}, timeout=2))
    await asyncio.sleep(0)
    req = ws.sent[-1]
    await pool.handle_message(worker_id, {"type": wire.FETCH_RESULT, "id": req["id"], "data": [], "metadata": {}})
    return await task


# ── hello ────────────────────────────────────────────────────────────────────

def test_hello_lists_only_local_fetchers():
    msg = wire.hello_message()
    pairs = {tuple(p) for p in msg["fetchers"]}
    assert msg["protocol_version"] == wire.PROTOCOL_VERSION and msg["fetcher_version"]
    assert ("yahoo", "stock_price") in pairs and ("sec", "institutional_13f") in pairs
    assert all(routes.target_of(p, m) == "local" for p, m in pairs)
    assert wire.parse_hello(msg)[2] == sorted(pairs)


def test_worker_with_hello_gets_only_fetchers_it_has():
    async def scenario():
        pool, ws = FetcherWorkerPool(), _WS()
        wid = pool.register(ws, "u1")
        await pool.handle_message(wid, _hello([["yahoo", "stock_price"]]))
        assert (await _fetch_and_answer(pool, wid, ws, "yahoo", "stock_price"))["type"] == wire.FETCH_RESULT
        assert (await _fetch_and_answer(pool, wid, ws, "yahoo", "StockPrice"))["type"] == wire.FETCH_RESULT  # PascalCase
        with pytest.raises(FetcherWorkerOutdated):
            await pool.fetch("u1", "yahoo", "quote", {}, timeout=2)           # 새 local fetcher, 옛 exe
        assert pool.status()[0]["versions"] == ["9.9.9"]
    asyncio.run(scenario())


def test_protocol_mismatch_is_outdated():
    async def scenario():
        pool, ws = FetcherWorkerPool(), _WS()
        wid = pool.register(ws, "u1")
        await pool.handle_message(wid, _hello([["yahoo", "quote"]], protocol=wire.PROTOCOL_VERSION + 1))
        with pytest.raises(FetcherWorkerOutdated):
            await pool.fetch("u1", "yahoo", "quote", {}, timeout=2)
    asyncio.run(scenario())


def test_legacy_worker_without_hello_is_still_served():
    """hello 를 보내지 않는 구버전 exe 는 예전처럼 위임받는다 (점진 전환)."""
    async def scenario():
        pool, ws = FetcherWorkerPool(), _WS()
        wid = pool.register(ws, "u1")
        assert (await _fetch_and_answer(pool, wid, ws, "yahoo", "quote"))["type"] == wire.FETCH_RESULT
    asyncio.run(scenario())


def test_transport_maps_outdated_to_503_error(monkeypatch):
    from app.backend.core import fetcher_ws_transport

    async def outdated(*a, **k):
        raise FetcherWorkerOutdated("업데이트하세요")

    monkeypatch.setattr(fetcher_ws_transport.fetcher_pool, "fetch", outdated)
    token = current_user_id.set("u1")
    try:
        with pytest.raises(FetcherOutdatedError):
            asyncio.run(fetcher_ws_transport.WSFetcherTransport().fetch("yahoo", "quote", {}))
    finally:
        current_user_id.reset(token)


# ── 재검증 ────────────────────────────────────────────────────────────────────

def test_revalidate_restores_types_and_keeps_metadata():
    raw = AnnotatedResult(result=[dict(ROW)], metadata={"source": "yahoo"})
    out = revalidate("yahoo", "stock_price", raw)
    row = out.result[0]
    assert type(row).__name__ == "YFinanceStockPriceData"
    assert isinstance(row.date, date) and str(row.date)[:10] == "2026-11-20"  # 문자열 날짜 → date 객체
    assert row.volume == 10
    assert out.metadata == {"source": "yahoo"}


def test_revalidate_partial_drops_bad_rows_with_warning():
    bad = {**ROW, "date": "not-a-date"}
    with WarningsCollector() as wc:
        out = revalidate("yahoo", "stock_price", [dict(ROW), bad])
    assert len(out) == 1 and type(out[0]).__name__ == "YFinanceStockPriceData"   # DotDict 를 섞지 않는다
    assert wc.warnings == ["validation_failed: yahoo/stock_price 1/2행 제외"]


def test_revalidate_unknown_pair_passes_through():
    raw = [{"a": 1}]
    assert revalidate("nope", "nothing", raw) is raw


def test_server_executor_revalidates_remote_rows(monkeypatch):
    class _Remote:
        async def fetch(self, provider, model, params, credentials=None, **kwargs):
            return [dict(ROW)]                                                 # PC 가 보낸 JSON 행

    monkeypatch.setattr(ServerExecutor, "_cache", None)
    monkeypatch.setattr(ServerExecutor, "_remote", _Remote())
    monkeypatch.setattr(routes, "_overrides", set())
    token = current_user_id.set("u1")
    try:
        rows = asyncio.run(ServerExecutor.fetch("yahoo", "stock_price", {"symbol": "AAPL"}))
    finally:
        current_user_id.reset(token)
    assert type(rows[0]).__name__ == "YFinanceStockPriceData" and isinstance(rows[0].date, date)

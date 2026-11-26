"""응답 metadata — cached · duration_ms · row_count · executed_at(server | local | mixed).

ServerExecutor.fetch 가 조회마다 캐시 여부와 실행 위치를 남기고(core/execution/context.record_execution),
OBBject 를 만드는 곳(OBBject.from_query · CommandRunner.run)이 모아 metadata 에 넣는다.
executed_at 은 fetcher 의 target 이 아니라 실제로 실행한 곳이다 (긴급 전환 중이면 local fetcher 도 server).
"""
import asyncio

import pytest

import data_fetcher.providers_init  # noqa: F401 — provider 등록
from app.backend.core.execution import ServerExecutor, current_user_id, routes
from app.backend.core.execution import executor as executor_module
from app.backend.core.execution.context import ExecutionLog, record_execution
from app.backend.platform import Fetch, OBBject, Query
from app.backend.platform.command_runner import CommandRunner
from data_fetcher.query_executor import QueryExecutor


class _MemCache:
    def __init__(self):
        self.data = {}

    async def get(self, key):
        return self.data.get(key)

    async def set(self, key, value, ttl):
        self.data[key] = value


class _Remote:
    async def fetch(self, provider, model, params, credentials=None, **kwargs):
        return [{"via": "local"}]


@pytest.fixture
def setup(monkeypatch):
    monkeypatch.setattr(ServerExecutor, "_cache", _MemCache())
    monkeypatch.setattr(ServerExecutor, "_remote", _Remote())
    monkeypatch.setattr(ServerExecutor, "_credential_resolver", None)
    monkeypatch.setattr(ServerExecutor, "_ttl_map", {"series": 60, "quote": 60})
    monkeypatch.setattr(routes, "_overrides", set())
    monkeypatch.setattr(executor_module, "revalidate", lambda provider, model, raw: raw)

    async def direct(self, provider_name, model_name, params, credentials=None, **kw):
        return [{"via": "server"}, {"via": "server"}]

    monkeypatch.setattr(QueryExecutor, "execute", direct)
    token = current_user_id.set("u1")
    yield
    current_user_id.reset(token)


def test_from_query_reports_execution(setup):
    async def scenario():
        first = await OBBject.from_query(Query(_model="series", provider="fred", series_id="X"))
        again = await OBBject.from_query(Query(_model="series", provider="fred", series_id="X"))
        return first, again
    first, again = asyncio.run(scenario())
    assert first.metadata["cached"] is False and again.metadata["cached"] is True
    assert first.metadata["executed_at"] == "server" and first.metadata["row_count"] == 2
    assert isinstance(first.metadata["duration_ms"], float) and first.metadata["duration_ms"] >= 0


def test_local_target_reports_local_and_override_reports_server(setup):
    obb = asyncio.run(OBBject.from_query(Query(_model="quote", provider="yahoo", symbol="AAPL")))
    assert obb.metadata["executed_at"] == "local" and obb.results == [{"via": "local"}]

    routes._overrides.add(("yahoo", "quote"))                   # 긴급 전환 — 실제로 서버에서 돈다
    obb = asyncio.run(OBBject.from_query(Query(_model="quote", provider="yahoo", symbol="MSFT")))
    assert obb.metadata["executed_at"] == "server"


def test_command_with_mixed_inputs(setup):
    def combine(data):
        return [{"n": len(data["a"]) + len(data["b"])}]

    inputs = lambda: {"a": Fetch("fred", "series", {"series_id": "A"}),                # noqa: E731
                      "b": Fetch("yahoo", "quote", {"symbol": "AAPL"})}
    obb = asyncio.run(CommandRunner.run(combine, {}, inputs=inputs))
    assert obb.metadata["executed_at"] == "mixed" and obb.metadata["row_count"] == 1
    assert obb.metadata["cached"] is False


def test_log_without_fetches_and_record_without_log():
    record_execution("fred", "series", cached=True, executed_at="server")      # 통이 없으면 버린다 (오류 아님)
    with ExecutionLog() as runs:
        pass
    assert runs.metadata(0) == {"cached": False, "duration_ms": runs.duration_ms, "row_count": 0, "executed_at": None}

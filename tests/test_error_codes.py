"""오류 응답 — 모든 오류는 {detail, code, provider?} (app/backend/api/deps.exception_response).

위젯은 code 로 분기한다. 401 · 403 은 provider 오류에 쓰지 않는다 (apiClient 가 세션 만료로 보고
refresh · 로그아웃하므로). 빈 결과는 오류가 아니다 — 200 + 빈 results + warnings.
"""
import asyncio
import json
import logging

import pytest
from fastapi import HTTPException

from app.backend.api.deps import exception_response, route_handler
from app.backend.core.execution import MissingCredentialsError, RemoteUnavailableError
from app.backend.core.execution.circuit_breaker import CircuitBreakerOpen
from app.backend.core.execution.errors import FetcherOutdatedError, FetcherTimeoutError
from data_fetcher.query_executor import QueryExecutorError
from data_fetcher.utils.http_client import HTTPClientError
from data_fetcher.utils.provider_errors import EmptyDataError, UnauthorizedError

LOG = logging.getLogger("test")


def _wrapped(exc):
    """실행 계층이 감싸 올리는 모양 — 원인은 __cause__ 에."""
    try:
        raise QueryExecutorError("wrapped") from exc
    except QueryExecutorError as e:
        return e


def _resp(exc):
    r = exception_response(exc, LOG, "t")
    return r.status_code, json.loads(r.body)


@pytest.mark.parametrize("exc,status,code", [
    (MissingCredentialsError("fred"), 424, "missing_key"),
    (RemoteUnavailableError("worker offline"), 503, "fetcher_offline"),
    (FetcherTimeoutError("slow"), 503, "fetcher_timeout"),
    (FetcherOutdatedError("old exe"), 503, "fetcher_outdated"),
    (_wrapped(CircuitBreakerOpen("fmp", 12.0)), 503, "circuit_open"),
    (HTTPClientError("x", status_code=402), 402, "upstream_subscription"),
    (HTTPClientError("x", status_code=429), 429, "upstream_limit"),
    (HTTPClientError("x", status_code=401), 502, "upstream_denied"),
    (HTTPClientError("x", status_code=403), 502, "upstream_denied"),
    (HTTPClientError("x", status_code=500), 502, "upstream_error"),
    (UnauthorizedError("bad key"), 502, "upstream_denied"),
    (QueryExecutorError("provider broke"), 502, "upstream_error"),
    (ValueError("bad date"), 400, "bad_param"),
    (HTTPException(status_code=404, detail="no model"), 404, "not_found"),
    (RuntimeError("boom"), 500, "internal_error"),
])
def test_every_error_has_a_code(exc, status, code):
    got_status, body = _resp(exc)
    assert (got_status, body["code"]) == (status, code)
    assert "detail" in body
    assert got_status not in (401, 403)                    # 세션 오류로 오해받지 않게


def test_missing_key_carries_provider_and_circuit_sets_retry_after():
    assert _resp(MissingCredentialsError("fred"))[1]["provider"] == "fred"
    r = exception_response(_wrapped(CircuitBreakerOpen("fmp", 12.0)), LOG, "t")
    assert r.headers["retry-after"] == "13" and json.loads(r.body)["provider"] == "fmp"


def test_empty_data_is_200_with_warning():
    status, body = _resp(_wrapped(EmptyDataError("no rows for this period")))
    assert status == 200
    assert body == {"results": [], "provider": None, "warnings": ["no rows for this period"], "metadata": {}}


def test_route_handler_turns_exceptions_into_coded_responses():
    @route_handler
    async def boom_async():
        raise FetcherOutdatedError("update")

    @route_handler
    def boom_sync():
        raise HTTPException(status_code=400, detail="bad")

    r = asyncio.run(boom_async())
    assert r.status_code == 503 and json.loads(r.body)["code"] == "fetcher_outdated"
    r = boom_sync()
    assert r.status_code == 400 and json.loads(r.body) == {"detail": "bad", "code": "bad_param"}


def test_pc_fetcher_empty_result_is_empty_list(monkeypatch):
    """PC 에서 EmptyDataError 는 fetch_error 가 아니라 빈 목록 — 서버에서 '조회 실패'가 되지 않게."""
    from data_fetcher.server import runner

    async def empty(*a, **k):
        raise EmptyDataError()

    monkeypatch.setattr(runner._executor, "execute", empty)
    assert asyncio.run(runner.run("yahoo", "quote", {"symbol": "AAPL"})) == []

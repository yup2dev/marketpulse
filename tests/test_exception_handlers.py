"""전역 예외 처리(core/exception_handlers) — 예외 → 상태 코드, __cause__ 체인, 500 에도 CORS 헤더.

실제 앱과 같은 순서(예외 처리 → CORS)로 작은 앱을 만들어 본다. 라우트는 sync · async 둘 다.
"""
import pytest
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.testclient import TestClient

from app.backend.core.exception_handlers import add_exception_handlers
from data_fetcher.query_executor import (
    MissingCredentialsError, QueryExecutorError, RemoteUnavailableError,
)
from data_fetcher.utils.circuit_breaker import CircuitBreakerOpen
from data_fetcher.utils.http_client import HTTPClientError

ORIGIN = "http://localhost:5173"


def _wrapped(cause: Exception) -> Exception:
    try:
        raise RuntimeError("wrapper") from cause
    except RuntimeError as e:
        return e


CASES = {
    "http404": HTTPException(status_code=404, detail="nope"),
    "value": ValueError("bad input"),
    "missing_key": MissingCredentialsError("fmp"),
    "remote": RemoteUnavailableError("fetcher down"),
    "query": QueryExecutorError("model failed"),
    "breaker": CircuitBreakerOpen("fred", 4.2),
    "breaker_wrapped": _wrapped(CircuitBreakerOpen("fred", 4.2)),
    "breaker_in_query": None,   # QueryExecutorError from CircuitBreakerOpen — 아래에서 만든다
    "http402": HTTPClientError("pay", status_code=402),
    "http429": HTTPClientError("slow down", status_code=429),
    "http401": HTTPClientError("denied", status_code=401),
    "http500": HTTPClientError("upstream", status_code=500),
    "missing_wrapped": _wrapped(MissingCredentialsError("polygon")),
    "boom": RuntimeError("boom"),
}
try:
    raise QueryExecutorError("fetch failed") from CircuitBreakerOpen("fmp", 1.0)
except QueryExecutorError as _e:
    CASES["breaker_in_query"] = _e


@pytest.fixture(scope="module")
def client() -> TestClient:
    app = FastAPI()
    add_exception_handlers(app)
    app.add_middleware(CORSMiddleware, allow_origins=[ORIGIN], allow_credentials=True,
                       allow_methods=["*"], allow_headers=["*"])

    @app.get("/sync/{name}")
    def sync_route(name: str):
        raise CASES[name]

    @app.get("/async/{name}")
    async def async_route(name: str):
        raise CASES[name]

    return TestClient(app, raise_server_exceptions=False)


EXPECTED = {
    "http404": 404, "value": 400, "missing_key": 424, "remote": 503, "query": 502,
    "breaker": 503, "breaker_wrapped": 503, "breaker_in_query": 503,
    "http402": 402, "http429": 429, "http401": 403, "http500": 502,
    "missing_wrapped": 424, "boom": 500,
}


@pytest.mark.parametrize("kind", ["sync", "async"])
@pytest.mark.parametrize("name,status", sorted(EXPECTED.items()))
def test_status_and_cors(client, kind, name, status):
    r = client.get(f"/{kind}/{name}", headers={"Origin": ORIGIN})
    assert r.status_code == status
    assert "detail" in r.json()
    # 500 을 포함해 모든 오류 응답에 CORS 헤더 — 없으면 브라우저가 네트워크 오류로 본다
    assert r.headers.get("access-control-allow-origin") == ORIGIN


def test_missing_key_body(client):
    body = client.get("/async/missing_key").json()
    assert body["code"] == "missing_key" and body["provider"] == "fmp"
    assert client.get("/async/missing_wrapped").json()["provider"] == "polygon"


def test_breaker_retry_after(client):
    r = client.get("/sync/breaker")
    assert r.headers["retry-after"] == "5"


def test_unexpected_error_detail(client):
    assert client.get("/sync/boom").json() == {"detail": "boom"}

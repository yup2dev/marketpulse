"""polygon:orderbook — 호가 집계 · snapshot 폴백 · QueryExecutor 경유(사용자 키) 확인."""
import pytest

import data_fetcher.providers_init  # noqa: F401 — provider 등록
from data_fetcher.providers.polygon.models import orderbook as ob
from data_fetcher.query_executor import QueryExecutor

QUOTES = [  # 최신순
    {"bid_price": 100.004, "bid_size": 3, "ask_price": 100.02, "ask_size": 5},
    {"bid_price": 100.0, "bid_size": 7, "ask_price": 100.02, "ask_size": 2},   # 같은 ask 레벨 → max
    {"bid_price": 99.99, "bid_size": 4, "ask_price": 100.03, "ask_size": 1},
    {"bid_price": 0, "bid_size": 9, "ask_price": 100.05, "ask_size": 0},       # 무효 값 제외
]


def test_aggregate_quotes_levels_and_depth():
    out = ob.aggregate_quotes(QUOTES, depth=2)
    assert out["source"] == "quotes"
    assert out["best_bid"] == 100.004 and out["best_ask"] == 100.02
    assert out["bids"] == [{"price": 100.0, "size": 7}, {"price": 99.99, "size": 4}]
    assert out["asks"] == [{"price": 100.02, "size": 5}, {"price": 100.03, "size": 1}]


def test_from_snapshot():
    out = ob.from_snapshot({"ticker": {"lastQuote": {"p": 10.0, "s": 2, "P": 10.1, "S": 3}}})
    assert out["bids"] == [{"price": 10.0, "size": 2}] and out["asks"] == [{"price": 10.1, "size": 3}]
    assert ob.from_snapshot({})["bids"] == []


class _NoCache:
    async def get(self, key):
        return None

    async def set(self, key, value, ttl):
        pass


@pytest.fixture
def http(monkeypatch):
    calls = []

    def _setup(quotes_resp=None, quotes_exc=None, snapshot=None):
        async def fake(url, params=None, **kw):
            calls.append((url, dict(params or {})))
            if "/v3/quotes/" in url:
                if quotes_exc:
                    raise quotes_exc
                return quotes_resp
            return snapshot

        monkeypatch.setattr(ob, "amake_request", fake)
        monkeypatch.setattr(QueryExecutor, "_cache", _NoCache())
        monkeypatch.setattr(QueryExecutor, "_inflight", {})
        monkeypatch.setattr(QueryExecutor, "_swr_pending", set())
        return calls

    return _setup


@pytest.mark.asyncio
async def test_fetch_via_query_executor_uses_given_key(http):
    calls = http(quotes_resp={"results": QUOTES})
    raw = await QueryExecutor.fetch("polygon", "orderbook", {"symbol": "aapl"},
                                    credentials={"api_key": "user-key"})
    row = getattr(raw, "result", raw)[0]
    assert row.symbol == "AAPL" and row.source == "quotes"
    assert row.bids[0].price == 100.0 and row.asks[0].size == 5
    assert calls[0][0].endswith("/v3/quotes/AAPL") and calls[0][1]["apiKey"] == "user-key"


@pytest.mark.asyncio
async def test_falls_back_to_snapshot(http):
    calls = http(quotes_exc=RuntimeError("403 not authorized"),
                 snapshot={"ticker": {"lastQuote": {"p": 5.0, "s": 1, "P": 5.1, "S": 2}}})
    raw = await QueryExecutor.fetch("polygon", "orderbook", {"symbol": "XYZ"},
                                    credentials={"api_key": "k"})
    row = getattr(raw, "result", raw)[0]
    assert row.source == "snapshot" and row.best_ask == 5.1
    assert [c[0].split("/")[3] for c in calls] == ["v3", "v2"]


def test_route_uses_user_key_not_operator_env(auth_client, monkeypatch):
    """예전엔 라우트가 os.getenv로 운영자 키를 직접 썼다 — 이제 사용자 키 정책을 따른다."""
    client, user_id = auth_client
    seen = []

    async def fake(url, params=None, **kw):
        seen.append(params.get("apiKey"))
        return {"results": QUOTES}

    monkeypatch.setattr(ob, "amake_request", fake)
    monkeypatch.setattr(QueryExecutor, "_cache", _NoCache())
    monkeypatch.setattr(QueryExecutor, "_inflight", {})
    monkeypatch.setattr(QueryExecutor, "_swr_pending", set())
    monkeypatch.setenv("POLYGON_API_KEY", "OPERATOR")
    keys = {}
    monkeypatch.setattr(QueryExecutor, "_credential_resolver",
                        staticmethod(lambda provider, uid: keys.get(uid)))

    res = client.get("/api/stock/orderbook/AAPL")
    assert res.status_code >= 400 and seen == []          # 키 미등록 → 운영자 키 폴백 없음

    keys[user_id] = {"api_key": "USERKEY"}
    res = client.get("/api/stock/orderbook/AAPL")
    assert res.status_code == 200 and seen == ["USERKEY"]
    assert res.json()["results"][0]["asks"][0] == {"price": 100.02, "size": 5}

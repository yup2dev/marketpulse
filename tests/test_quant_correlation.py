"""quantitative:correlation — 계산 정확성 + 서버에서 시세가 사용자 Fetcher로 위임되는지."""
import numpy as np
import pandas as pd
import pytest

import data_fetcher.providers_init  # noqa: F401 — provider 등록
from data_fetcher.query_executor import QueryExecutor, RemoteUnavailableError, current_user_id
from data_fetcher.providers.quantitative.models.correlation import (
    closes_from_prices,
    correlation_matrix,
)

DATES = [f"2026-01-{d:02d}" for d in range(1, 11)]
A = [100, 101, 103, 102, 105, 107, 106, 108, 110, 111]
B = [50, 50.4, 51.5, 51.2, 52.4, 53.6, 53.0, 54.1, 55.0, 55.6]   # A와 거의 같이 움직임
C = [80, 79, 77, 78, 75, 73, 74, 72, 70, 69]                     # A와 반대


def _prices(closes):
    return [{"date": d, "close": c} for d, c in zip(DATES, closes)]


def test_correlation_matrix_matches_pandas():
    closes = {s: closes_from_prices(_prices(v)) for s, v in {"A": A, "B": B, "C": C}.items()}
    out = correlation_matrix(closes)

    expected = pd.DataFrame({"A": A, "B": B, "C": C}).pct_change().dropna().corr()
    assert out["labels"] == ["A", "B", "C"]
    assert out["rows"] == len(DATES) - 1
    np.testing.assert_allclose(out["matrix"], expected.values.round(4), atol=1e-4)
    assert out["matrix"][0][1] > 0.9 and out["matrix"][0][2] < -0.5


def test_correlation_matrix_needs_two_series():
    with pytest.raises(ValueError):
        correlation_matrix({"A": closes_from_prices(_prices(A)), "B": {}})


class _NoCache:
    async def get(self, key):
        return None

    async def set(self, key, value, ttl):
        pass


class _PriceRemote:
    """사용자 Fetcher 워커 스텁 — 종목별 시세를 돌려주고 위임 호출을 기록한다."""

    def __init__(self, by_symbol, exc=None):
        self.by_symbol, self.exc, self.calls = by_symbol, exc, []

    async def fetch(self, provider, model, params, credentials=None, **kwargs):
        self.calls.append((provider, model, dict(params)))
        if self.exc:
            raise self.exc
        return _prices(self.by_symbol[params["symbol"]])


@pytest.fixture
def server_qe(monkeypatch):
    def _setup(remote):
        monkeypatch.setattr(QueryExecutor, "_cache", _NoCache())
        monkeypatch.setattr(QueryExecutor, "_inflight", {})
        monkeypatch.setattr(QueryExecutor, "_swr_pending", set())
        monkeypatch.setattr(QueryExecutor, "_remote", remote)
        monkeypatch.setattr(QueryExecutor, "_server_mode", True)
        # 서버에서 yfinance를 직접 부르면 실패하게 만든다
        import yfinance
        monkeypatch.setattr(yfinance, "Ticker", lambda *a, **k: pytest.fail("server called yfinance"))
        monkeypatch.setattr(yfinance, "download", lambda *a, **k: pytest.fail("server called yfinance"))
        return remote
    token = current_user_id.set("user-1")
    yield _setup
    current_user_id.reset(token)


@pytest.mark.asyncio
async def test_server_delegates_prices_to_user_fetcher(server_qe):
    remote = server_qe(_PriceRemote({"AAPL": A, "MSFT": B, "XOM": C}))

    raw = await QueryExecutor.fetch(
        "quantitative", "correlation", {"symbols": "aapl,MSFT,xom,AAPL", "period": "2y"}
    )
    row = (getattr(raw, "result", raw))[0]

    assert row.labels == ["AAPL", "MSFT", "XOM"]            # 정규화 + 중복 제거
    assert row.rows == len(DATES) - 1 and row.missing == []
    # 계산은 서버에서, 시세만 위임 — 위임된 건 전부 yahoo stock_price 일봉
    assert {(p, m) for p, m, _ in remote.calls} == {("yahoo", "stock_price")}
    assert sorted(c[2]["symbol"] for c in remote.calls) == ["AAPL", "MSFT", "XOM"]
    assert all(c[2]["interval"] == "1d" and c[2]["period"] == "2y" for c in remote.calls)


@pytest.mark.asyncio
async def test_server_fetcher_offline_propagates(server_qe):
    server_qe(_PriceRemote({}, exc=RemoteUnavailableError("fetcher offline")))
    with pytest.raises(RemoteUnavailableError):
        await QueryExecutor.fetch("quantitative", "correlation", {"symbols": ["AAPL", "MSFT"]})

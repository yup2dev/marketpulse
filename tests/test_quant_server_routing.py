"""quantitative 단일종목 모델 — 서버에서 yfinance를 직접 부르지 않고 시세를 사용자 Fetcher로 위임.

quantitative provider는 웹 서버에서 실행된다. 시세 로딩(utils.prices.aload_series)이
QueryExecutor yahoo 경유인지, 결과가 정상 계산되는지 확인한다.
"""
from datetime import date, timedelta

import numpy as np
import pytest

import data_fetcher.providers_init  # noqa: F401 — provider 등록
from data_fetcher.query_executor import QueryExecutor, RemoteUnavailableError, current_user_id
from data_fetcher.providers.quantitative.utils.prices import prices_to_frame, series_from_frame


def _walk(seed: int, n: int = 300, start: float = 100.0):
    rng = np.random.default_rng(seed)
    closes = start * np.cumprod(1 + rng.normal(0.0005, 0.01, n))
    d0 = date(2025, 1, 1)
    return [
        {"date": (d0 + timedelta(days=i)).isoformat(), "open": c * 0.99, "high": c * 1.01,
         "low": c * 0.98, "close": float(c), "adj_close": float(c)}
        for i, c in enumerate(closes)
    ]


class _NoCache:
    async def get(self, key):
        return None

    async def set(self, key, value, ttl):
        pass


class _PriceRemote:
    def __init__(self, exc=None):
        self.exc, self.calls = exc, []

    async def fetch(self, provider, model, params, credentials=None, **kwargs):
        self.calls.append((provider, model, dict(params)))
        if self.exc:
            raise self.exc
        return _walk(seed=sum(map(ord, params["symbol"])))


@pytest.fixture
def server_remote(monkeypatch):
    def _setup(exc=None):
        remote = _PriceRemote(exc)
        monkeypatch.setattr(QueryExecutor, "_cache", _NoCache())
        monkeypatch.setattr(QueryExecutor, "_inflight", {})
        monkeypatch.setattr(QueryExecutor, "_swr_pending", set())
        monkeypatch.setattr(QueryExecutor, "_remote", remote)
        monkeypatch.setattr(QueryExecutor, "_server_mode", True)
        import yfinance
        monkeypatch.setattr(yfinance, "Ticker", lambda *a, **k: pytest.fail("server called yfinance"))
        monkeypatch.setattr(yfinance, "download", lambda *a, **k: pytest.fail("server called yfinance"))
        return remote
    token = current_user_id.set("user-1")
    yield _setup
    current_user_id.reset(token)


CASES = [
    ("summary",   {"symbol": "AAPL", "target": "close"},                       ["AAPL"]),
    ("normality", {"symbol": "AAPL", "target": "return"},                      ["AAPL"]),
    ("rolling",   {"symbol": "AAPL", "target": "return", "metric": "sharpe"},  ["AAPL"]),
    ("unitroot",  {"symbol": "AAPL", "target": "close"},                       ["AAPL"]),
    ("capm",      {"symbol": "AAPL", "benchmark": "^GSPC"},                    ["AAPL", "^GSPC"]),
]


@pytest.mark.asyncio
@pytest.mark.parametrize("model,params,symbols", CASES, ids=[c[0] for c in CASES])
async def test_quant_model_delegates_prices(server_remote, model, params, symbols):
    remote = server_remote()
    params = {**params, "start_date": "2025-01-01", "end_date": "2025-10-27"}

    raw = await QueryExecutor.fetch("quantitative", model, params)
    assert getattr(raw, "result", raw), f"{model}: empty result"

    assert {(p, m) for p, m, _ in remote.calls} == {("yahoo", "stock_price")}
    assert sorted(c[2]["symbol"] for c in remote.calls) == sorted(symbols)
    for _, _, p in remote.calls:
        assert p["interval"] == "1d"
        assert p["start_date"] == "2025-01-01"
        assert p["end_date"] == "2025-10-28"   # 종료일 포함(+1일)


@pytest.mark.asyncio
async def test_quant_model_fetcher_offline_propagates(server_remote):
    server_remote(exc=RemoteUnavailableError("fetcher offline"))
    with pytest.raises(RemoteUnavailableError):
        await QueryExecutor.fetch("quantitative", "summary", {"symbol": "AAPL"})


def test_series_from_frame_targets():
    df = prices_to_frame(_walk(1, n=10) + _walk(1, n=10)[-1:])   # 마지막 날 중복
    assert len(df) == 10
    price, rets = series_from_frame(df, "X", "high")
    assert np.allclose(price.values, df["high"].values) and len(rets) == 9
    ret_target, _ = series_from_frame(df, "X", "return")
    assert len(ret_target) == 9
    with pytest.raises(ValueError):
        series_from_frame(prices_to_frame([]), "X", "close")

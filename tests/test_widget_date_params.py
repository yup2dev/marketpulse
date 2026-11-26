"""위젯 기간·기준일 파라미터 — 이벤트 목록 기간 필터 + FRED 스냅샷 기준일(as-of)."""
import asyncio
from datetime import date, timedelta

import pytest

import data_fetcher.providers_init  # noqa: F401
from app.backend.api.deps import filter_dated_rows, period_start, resolve_date_range
from data_fetcher.providers.fred.models import yield_curve


# ── 이벤트 목록 기간 ──────────────────────────────────────────────────────────

def test_period_start_counts_back_from_today_without_end_lag():
    assert period_start("1y") == (date.today() - timedelta(days=365)).isoformat()
    assert period_start("6mo") == (date.today() - timedelta(days=180)).isoformat()
    assert period_start("max") is None and period_start(None) is None


def test_period_start_rejects_unknown_token():
    with pytest.raises(ValueError):
        period_start("forever")


def test_explicit_dates_win_over_period():
    assert resolve_date_range("1y", "2020-01-01", "2020-12-31") == ("2020-01-01", "2020-12-31")


def test_filter_uses_requested_key_and_sorts_newest_first():
    rows = [
        {"filing_date": "2026-01-10", "transaction_date": "2025-12-30"},
        {"filing_date": "2026-03-02", "transaction_date": "2026-02-27"},
        {"filing_date": "2024-05-01", "transaction_date": "2024-04-28"},
    ]
    # 거래일 기준: 2025-12-30 은 2026 시작 범위 밖 (공시일 기준이면 들어온다)
    out = filter_dated_rows(rows, "2026-01-01", None, key="transaction_date")
    assert [r["transaction_date"] for r in out] == ["2026-02-27"]
    # 키가 없으면 자동 감지(filing_date)
    out = filter_dated_rows(rows, "2026-01-01", None, key="missing")
    assert [r["filing_date"] for r in out] == ["2026-03-02", "2026-01-10"]


@pytest.fixture
def gateway(auth_client, monkeypatch):
    """게이트웨이 /api/data 를 가짜 ServerExecutor 로 — (client, 받은 파라미터, 돌려줄 행)."""
    from app.backend.core.execution import ServerExecutor
    client, _ = auth_client
    box = {"seen": {}, "rows": []}

    async def fake_fetch(provider, model, params, *a, **k):
        box["seen"] = dict(params, _provider=provider, _model=model)
        return box["rows"](params) if callable(box["rows"]) else box["rows"]

    monkeypatch.setattr(ServerExecutor, "fetch", fake_fetch)
    return client, box


def test_gateway_period_sends_dates_and_filters_newest_first(gateway):
    client, box = gateway
    today = date.today()
    box["rows"] = [{"date": (today - timedelta(days=90 * i)).isoformat(), "dividend": 0.25} for i in range(60)]
    body = client.get("/api/data/yahoo/dividends", params={"symbol": "aapl", "period": "10y"}).json()
    assert box["seen"]["symbol"] == "AAPL"                       # 예전 /api/stock 라우트처럼 대문자
    assert box["seen"]["start_date"] and "period" not in box["seen"]
    assert 39 <= len(body["results"]) <= 41                      # 10년 ≈ 40건, 기본 건수 제한 없음
    assert body["results"][0]["date"] == today.isoformat()       # 오늘 행도 남는다 (끝 = 오늘)


def test_gateway_keeps_model_own_period(gateway):
    """stock_price 처럼 모델이 period 를 직접 받으면 날짜로 바꾸지 않는다."""
    client, box = gateway
    box["rows"] = [{"date": "2026-01-02", "close": 1.0}]
    client.get("/api/data/yahoo/stock_price", params={"symbol": "aapl", "period": "1mo", "interval": "1d"})
    assert box["seen"]["period"] == "1mo" and "start_date" not in box["seen"]


def test_gateway_ignores_provider_query_param(gateway):
    client, box = gateway
    box["rows"] = []
    assert client.get("/api/data/yahoo/quote", params={"symbol": "x", "provider": "kis"}).status_code == 200
    assert box["seen"]["_provider"] == "yahoo"


def test_news_period_is_sent_and_filtered_by_published_utc(gateway):
    client, box = gateway
    now = date.today()
    box["rows"] = [{"title": str(d), "published_utc": f"{(now - timedelta(days=d)).isoformat()}T12:00:00Z"}
                   for d in (0, 3, 20)]
    body = client.get("/api/data/polygon/news", params={"symbol": "aapl", "limit": 10, "period": "1w"}).json()
    assert box["seen"]["start_date"]
    assert [r["title"] for r in body["results"]] == ["0", "3"]


# ── FRED 스냅샷 기준일 ────────────────────────────────────────────────────────

@pytest.mark.parametrize("fetcher_cls,qp_cls", [
    (yield_curve.FREDYieldCurveFetcher, yield_curve.FREDYieldCurveQueryParams),
])     # 노동 · 금융 여건 · 심리 · CPI 분해 스냅샷은 command — tests/test_macro_commands.py 가 기준일을 본다
def test_as_of_date_caps_every_fred_request(monkeypatch, fetcher_cls, qp_cls):
    """FRED HTTP 는 FREDGenericSeriesFetcher 한 곳 — 거기서 나가는 요청마다 observation_end 를 본다."""
    ends = []

    async def fake_request(url, params=None, **kwargs):
        ends.append(params.get("observation_end"))
        return {"observations": [{"date": "2020-03-13", "value": "1.0"}]}

    async def no_sleep(_):
        return None

    monkeypatch.setattr("data_fetcher.utils.provider_helpers.amake_json_request", fake_request)
    monkeypatch.setattr("data_fetcher.providers.fred.models.generic_series.asyncio.sleep", no_sleep)
    monkeypatch.setenv("FRED_API_KEY", "test")
    asyncio.run(fetcher_cls.aextract_data(qp_cls(date="2020-03-16"), credentials={"fred_api_key": "test"}))
    assert ends and all(e == "2020-03-16" for e in ends)

    ends.clear()
    asyncio.run(fetcher_cls.aextract_data(qp_cls(), credentials={"fred_api_key": "test"}))
    assert ends and all(e is None for e in ends)


# ── 결과에 날짜가 있는 위젯 — 재무제표·실적·13F 수익률·뉴스 ─────────────────────

def _quarterly_rows(key, n):
    today = date.today()
    return [{key: (today - timedelta(days=91 * i)).isoformat(), "v": i} for i in range(n)]






def test_fund_performance_period_maps_to_quarters(monkeypatch):
    from app.backend.commands.portfolio import router as portfolio

    seen = {}

    async def fake_fetch(provider, model, params):
        assert (provider, model) == ("db", "fund_performance")
        seen["quarters"] = params["quarters"]
        return _quarterly_rows("period", params["quarters"])

    monkeypatch.setattr(portfolio.ServerExecutor, "fetch", fake_fetch)
    obb = asyncio.run(portfolio.get_fund_performance("berkshire", period="3y"))
    assert seen["quarters"] == 13
    assert all(r["period"] >= period_start("3y") for r in obb.results)
    asyncio.run(portfolio.get_fund_performance("berkshire"))
    assert seen["quarters"] == 8                         # 기간 없으면 예전 기본값


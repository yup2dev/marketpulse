"""분석 command — 거시 지표 최신값 · 시리즈 변화율 · 비율, 환율, 종목 비교.

QueryExecutor.fetch 를 바꿔 네트워크 없이 본다. 라우트를 거치는 테스트는 어느 provider · model 을
몇 번 부르는지(호출 횟수)도 확인한다 — command 로 옮기면서 호출이 늘어나는 곳이 있어서다.
"""
import asyncio
from datetime import date
from types import SimpleNamespace

import pytest

from app.backend.commands import fx as fx_cmd, macro as macro_cmd, stock as stock_cmd
from app.backend.commands._base import Source
from app.backend.constants.macro_catalog import FX_PAIRS, INDICATORS, MACRO_SERIES
from data_fetcher.query_executor import MissingCredentialsError, QueryExecutor


class _Row(dict):
    def model_dump(self, **kwargs):
        return dict(self)


@pytest.fixture
def fake_qe(monkeypatch):
    """QueryExecutor.fetch 대체 — handler(provider, model, params) 가 행 목록을 돌려준다."""
    calls = []
    box = {"handler": lambda p, m, params: []}

    async def fetch(provider, model, params, *args, **kwargs):
        calls.append((provider, model, dict(params)))
        out = box["handler"](provider, model, params)
        if isinstance(out, BaseException):
            raise out
        return [_Row(r) if isinstance(r, dict) else r for r in out]

    monkeypatch.setattr(QueryExecutor, "fetch", fetch)
    box["calls"] = calls
    return box


def _run(coro):
    return asyncio.run(coro)


# ── macro ─────────────────────────────────────────────────────────────────────

def test_indicator_overview_picks_latest_by_date_whatever_the_order():
    asc = [{"date": date(2026, 8, 1), "value": 4.0}, {"date": date(2026, 9, 1), "value": 5.0}]
    data = {"gdp": asc, "rate": list(reversed(asc)), "failed": []}
    rows = {r.indicator: r for r in macro_cmd.indicator_overview(data, {"gdp": "B$", "rate": "Percent"})}
    assert rows["gdp"].value == 5.0 and rows["gdp"].change == pytest.approx(25.0)
    assert rows["rate"].value == 5.0 and rows["rate"].change == pytest.approx(25.0)    # 내림차순이어도 같다
    assert rows["rate"].unit == "Percent" and "failed" not in rows                    # 못 받은 지표는 빠진다


def test_series_overview_groups_by_series():
    rows = [
        {"date": date(2026, 10, 1), "value": 110.0, "series_id": "M2SL"},
        {"date": date(2026, 9, 1), "value": 100.0, "series_id": "M2SL"},
        {"date": date(2026, 11, 20), "value": 4.1, "series_id": "DGS10"},
    ]
    catalog = [macro_cmd.SeriesSpec("m2", "M2SL", "M2", "Money", "B$"),
               macro_cmd.SeriesSpec("t10", "DGS10", "10Y", "Rates", "Percent"),
               macro_cmd.SeriesSpec("none", "NOPE", "-", "-", "-")]
    out = {r.key: r for r in macro_cmd.series_overview(rows, catalog)}
    assert set(out) == {"m2", "t10"}                      # 관측이 없는 시리즈는 빠진다
    assert out["m2"].value == 110.0 and out["m2"].change == pytest.approx(10.0)
    assert out["t10"].change is None


def test_ratio_pct(fake_qe):
    fake_qe["handler"] = lambda p, m, params: [
        {"date": date(2026, 4, 1), "value": 3000.0, "series_id": "CPATAX"},
        {"date": date(2026, 4, 1), "value": 30000.0, "series_id": "GDP"},
        {"date": date(2026, 7, 1), "value": 3300.0, "series_id": "CPATAX"},     # 분모 없는 분기는 빠진다
    ]
    rows = _run(macro_cmd.ratio_pct(Source("x", "series"), "CPATAX", "GDP"))
    assert [(r.date, r.value) for r in rows] == [(date(2026, 4, 1), 10.0)]


# ── fx ────────────────────────────────────────────────────────────────────────

def test_latest_rates():
    def bar(d, c):
        return {"date": date(2026, 11, d), "close": c, "high": c + 1, "low": c - 1}

    data = {"EUR/USD": [bar(20, 100.0), bar(21, 110.0)], "GBP/USD": []}
    rows = {r.pair: r for r in fx_cmd.latest_rates(data, {"EUR/USD": "Euro"})}
    assert list(rows) == ["EUR/USD"]                       # 못 받은 쌍은 빠진다
    eur = rows["EUR/USD"]
    assert eur.name == "Euro" and eur.rate == 110.0 and eur.date == date(2026, 11, 21)
    assert eur.change == pytest.approx(10.0)


# ── stock ─────────────────────────────────────────────────────────────────────

def test_compare_rows_and_partial_failure(fake_qe):
    def handler(p, m, params):
        if params["symbol"] == "BAD":
            return RuntimeError("down")
        if m == "quote":
            return [{"price": 10.0, "change_percent": 1.5, "volume": 100}]
        return [{"symbol": params["symbol"], "pe_ratio": 20.0, "net_margin": 0.3, "week_52_high": 12.0}]

    fake_qe["handler"] = handler
    rows = _run(stock_cmd.compare("aapl,bad", Source("x", "quote"), Source("x", "key_metrics")))
    assert rows[0].symbol == "AAPL" and rows[0].price == 10.0 and rows[0].profit_margin == 0.3
    assert rows[1].symbol == "BAD" and rows[1].error
    assert len(fake_qe["calls"]) == 4                      # 종목 2 × 모델 2

    with pytest.raises(ValueError):
        _run(stock_cmd.compare("AAPL", Source("x", "quote"), Source("x", "key_metrics")))       # 2~4개


def test_compare_raises_when_every_symbol_fails(fake_qe):
    fake_qe["handler"] = lambda p, m, params: RuntimeError("worker offline")
    with pytest.raises(RuntimeError):                      # Fetcher 미접속 → 503 안내가 화면까지
        _run(stock_cmd.compare("A,B", Source("x", "quote"), Source("x", "key_metrics")))


# ── 라우트 — 어느 provider · model 을 몇 번 부르나 ─────────────────────────────────

def test_route_indicator_overview_calls_each_indicator_once(auth_client, fake_qe):
    client, _ = auth_client
    fake_qe["handler"] = lambda p, m, params: [{"date": date(2026, 9, 1), "value": 1.0}]
    body = client.get("/api/macro/indicators/overview").json()
    assert {r["indicator"] for r in body["results"]} == set(INDICATORS)
    assert sorted(m for _, m, _ in fake_qe["calls"]) == sorted(spec[0] for spec in INDICATORS.values())
    assert {p for p, _, _ in fake_qe["calls"]} == {"fred"}

    fake_qe["handler"] = lambda p, m, params: MissingCredentialsError("fred")
    r = client.get("/api/macro/indicators/overview")
    assert r.status_code == 424 and r.json()["code"] == "missing_key"


def test_route_series_overview_is_one_request(auth_client, fake_qe):
    client, _ = auth_client
    client.get("/api/macro/fred/series", params={"date": "2026-11-21"})
    [(provider, model, params)] = fake_qe["calls"]
    assert (provider, model) == ("fred", "series")
    assert params["limit"] == 2 and params["sort_order"] == "desc" and params["end_date"] == "2026-11-21"
    assert params["series_id"].count(",") == len(MACRO_SERIES) - 1


def test_route_history_is_plain_lookup(auth_client, fake_qe):
    client, _ = auth_client
    fake_qe["handler"] = lambda p, m, params: [{"date": date(2026, 8, 1), "value": 4.1234},
                                               {"date": date(2026, 9, 1), "value": None}]
    body = client.get("/api/macro/indicators/fed_funds_rate/history").json()
    assert body["results"] == [{"date": "2026-08-01", "value": 4.12}]
    [(provider, model, params)] = fake_qe["calls"]
    assert (provider, model, params["rate_type"]) == ("fred", "interest_rate", "federal_funds")
    assert client.get("/api/macro/indicators/nope/history").status_code == 400


def test_route_corp_profits_and_forex_and_compare(auth_client, fake_qe):
    client, _ = auth_client
    client.get("/api/stock/indicator/CORP_PROFITS_GDP")
    assert fake_qe["calls"][-1][:2] == ("fred", "series")
    assert fake_qe["calls"][-1][2]["series_id"] == "CPATAX,GDP"

    fake_qe["calls"].clear()
    client.get("/api/macro/forex/rates")
    assert len(fake_qe["calls"]) == len(FX_PAIRS)
    assert {(p, m) for p, m, _ in fake_qe["calls"]} == {("alphavantage", "forex")}

    fake_qe["calls"].clear()
    client.get("/api/stock/compare", params={"symbols": "AAPL,MSFT,NVDA"})
    assert sorted((p, m) for p, m, _ in fake_qe["calls"]) == sorted(
        [("yahoo", "key_metrics")] * 3 + [("yahoo", "quote")] * 3)


# ── 뉴스 감성 (#105 — polygon fetcher 에서 옮김) ─────────────────────────────

from app.backend.commands import news_sentiment as news_cmd  # noqa: E402


def test_news_sentiment_scores_titles_and_trend(fake_qe):
    from datetime import datetime, timezone
    fake_qe["handler"] = lambda p, m, params: [
        {"title": "Apple beats estimates, stock surges", "published_utc": datetime(2026, 9, 1, 13, tzinfo=timezone.utc),
         "publisher_name": "X", "article_url": "u1"},
        {"title": "Analyst downgrade on weak demand", "published_utc": datetime(2026, 9, 1, 15, tzinfo=timezone.utc)},
        {"title": "Apple event today", "published_utc": None, "publisher": "Y"},
    ]
    out = _run(news_cmd.news_sentiment("AAPL", Source("x", "news")))[0]
    assert fake_qe["calls"] == [("x", "news", {"symbol": "AAPL", "limit": 50})]
    assert [n["sentiment"] for n in out.news] == ["positive", "negative", "neutral"]
    assert [n["sentiment_score"] for n in out.news] == [70, 20, 50]   # downgrade 에 down 도 걸린다
    assert out.news[0]["published_at"].startswith("2026-09-01T13") and out.news[2]["source"] == "Y"
    assert out.aggregate == {"positive": 1, "negative": 1, "neutral": 1, "overall_score": 50}
    assert out.trend == [{"date": "2026-09-01", "score": 45.0}]

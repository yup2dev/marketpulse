"""macro_service 에서 fetcher 로 옮긴 가공 — fred indicator_* · macro_series_* · alphavantage forex_rates.

안쪽 fetcher(지표별 fred · generic series · forex)의 fetch_data 를 바꿔 네트워크 없이 본다.
"""
import asyncio
from datetime import date
from types import SimpleNamespace

import pytest

import data_fetcher.providers_init  # noqa: F401
from data_fetcher.providers.alphavantage.models import forex_rates as fx
from data_fetcher.providers.fred.models import indicators as ind
from data_fetcher.query_executor import QueryExecutor


@pytest.fixture(autouse=True)
def _keys(monkeypatch):
    """CI 에는 .env 가 없다 — 안쪽 fetcher 를 바꿔 부르지 않으니 값은 아무거나."""
    monkeypatch.setenv("FRED_API_KEY", "test")
    monkeypatch.setenv("ALPHA_VANTAGE_API_KEY", "test")


def _run(provider, model, params=None):
    return asyncio.run(QueryExecutor.fetch(provider, model, params or {}))


class _Row(dict):
    def model_dump(self, **kwargs):
        return dict(self)


def _fake_fetch(rows):
    async def fetch(params, credentials=None, **kwargs):
        fetch.calls.append(params)
        return [_Row(r) for r in rows]
    fetch.calls = []
    return fetch


def test_indicator_overview_latest_and_change(monkeypatch):
    asc = [{"date": "2026-08-01", "value": 4.0}, {"date": "2026-09-01", "value": 5.0}]
    desc = [{"date": "2026-09-01", "value": 4.5}, {"date": "2026-08-01", "value": 5.0}]
    for key, spec in ind.INDICATORS.items():
        monkeypatch.setattr(spec[0], "fetch_data", _fake_fetch(asc if spec[4] else desc))
    rows = {r.indicator: r for r in _run("fred", "indicator_overview")}
    assert set(rows) == set(ind.INDICATORS)
    assert rows["gdp"].value == 5.0 and rows["gdp"].change == pytest.approx(25.0)       # 오름차순 → 마지막이 최신
    assert rows["fed_funds_rate"].value == 4.5 and rows["fed_funds_rate"].change == pytest.approx(-10.0)
    assert rows["cpi"].unit == "Index"


def test_indicator_history_rounds_and_passes_dates(monkeypatch):
    fake = _fake_fetch([{"date": "2026-08-01", "value": 4.1234}, {"date": "2026-09-01", "value": None}])
    monkeypatch.setattr(ind.FREDInterestRateFetcher, "fetch_data", fake)
    rows = _run("fred", "indicator_history", {"indicator": "fed_funds_rate", "start_date": "2026-01-01"})
    assert [(r.date, r.value) for r in rows] == [(date(2026, 8, 1), 4.12)]
    assert fake.calls[0]["rate_type"] == "federal_funds" and fake.calls[0]["start_date"] == date(2026, 1, 1)
    with pytest.raises(Exception):
        _run("fred", "indicator_history", {"indicator": "nope"})


def test_macro_series_overview_one_request_for_all_series(monkeypatch):
    fake = _fake_fetch([
        {"date": "2026-10-01", "value": 110.0, "series_id": "M2SL"},
        {"date": "2026-09-01", "value": 100.0, "series_id": "M2SL"},
        {"date": "2026-11-20", "value": 4.1, "series_id": "DGS10"},
    ])
    monkeypatch.setattr(ind.FREDGenericSeriesFetcher, "fetch_data", fake)
    rows = {r.key: r for r in _run("fred", "macro_series_overview", {"as_of": "2026-11-21"})}
    assert set(rows) == {"money_supply_m2", "treasury_10y"}          # 관측이 없는 시리즈는 빠진다
    assert rows["money_supply_m2"].value == 110.0 and rows["money_supply_m2"].change == pytest.approx(10.0)
    assert rows["treasury_10y"].change is None and rows["treasury_10y"].unit == "Percent"
    [call] = fake.calls
    assert call["limit"] == 2 and call["sort_order"] == "desc" and call["end_date"] == date(2026, 11, 21)
    assert call["series_id"].count(",") == len(ind.MACRO_SERIES) - 1


def test_forex_rates_latest_is_last_row(monkeypatch):
    def bar(d, c):
        return SimpleNamespace(date=date(2026, 11, d), close=c, high=c + 1, low=c - 1)

    async def fetch(params, credentials=None, **kwargs):
        if params["from_currency"] == "GBP":
            raise RuntimeError("limit")
        return [bar(20, 100.0), bar(21, 110.0)]          # forex 는 날짜 오름차순

    monkeypatch.setattr(fx.AlphaVantageForexFetcher, "fetch_data", fetch)
    rows = {r.pair: r for r in _run("alphavantage", "forex_rates")}
    assert "GBP/USD" not in rows and len(rows) == 4                 # 실패한 쌍만 빠진다
    eur = rows["EUR/USD"]
    assert eur.rate == 110.0 and eur.date == date(2026, 11, 21) and eur.change == pytest.approx(10.0)


def test_macro_routes_have_no_service_layer():
    from app.backend.main import app

    paths = app.openapi()["paths"]
    for p in ("/api/macro/indicators/overview", "/api/macro/fred/series", "/api/macro/forex/rates",
              "/api/macro/regime/current", "/api/macro/bonds"):
        assert p in paths


def test_corporate_profits_pct_gdp(monkeypatch):
    fake = _fake_fetch([
        {"date": "2026-04-01", "value": 3000.0, "series_id": "CPATAX"},
        {"date": "2026-04-01", "value": 30000.0, "series_id": "GDP"},
        {"date": "2026-07-01", "value": 3300.0, "series_id": "CPATAX"},          # GDP 없는 분기는 빠진다
    ])
    monkeypatch.setattr(ind.FREDGenericSeriesFetcher, "fetch_data", fake)
    rows = _run("fred", "corporate_profits_gdp", {"start_date": "2026-01-01"})
    assert [(r.date, r.value) for r in rows] == [(date(2026, 4, 1), 10.0)]
    assert fake.calls[0]["series_id"] == "CPATAX,GDP"


def test_yahoo_compare_rows_and_partial_failure(monkeypatch):
    from data_fetcher.providers.yahoo.models import compare as cmp

    async def quote(params, credentials=None, **kwargs):
        if params["symbol"] == "BAD":
            raise RuntimeError("down")
        return [{"price": 10.0, "change_percent": 1.5, "volume": 100}]

    async def metrics(params, credentials=None, **kwargs):
        return [{"symbol": params["symbol"], "pe_ratio": 20.0, "net_margin": 0.3, "week_52_high": 12.0}]

    monkeypatch.setattr(cmp.YFinanceQuoteFetcher, "fetch_data", quote)
    monkeypatch.setattr(cmp.YFinanceKeyMetricsFetcher, "fetch_data", metrics)
    monkeypatch.setattr(QueryExecutor, "_remote", None)            # 위임 transport 없음 → 직접 실행
    rows = asyncio.run(cmp.YFinanceCompareFetcher.fetch_data({"symbols": "aapl,bad"}))
    assert rows[0].symbol == "AAPL" and rows[0].price == 10.0 and rows[0].profit_margin == 0.3
    assert rows[0].week_52_high == 12.0
    assert rows[1].symbol == "BAD" and rows[1].error
    with pytest.raises(Exception):
        cmp.YFinanceCompareFetcher.transform_query({"symbols": "AAPL"})        # 2~4개

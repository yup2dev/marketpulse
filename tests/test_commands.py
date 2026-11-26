"""분석 command — 거시 지표 최신값 · 시리즈 변화율 · 비율, 환율, 종목 비교.

ServerExecutor.fetch 를 바꿔 네트워크 없이 본다. 라우트를 거치는 테스트는 어느 provider · model 을
몇 번 부르는지(호출 횟수)도 확인한다 — command 로 옮기면서 호출이 늘어나는 곳이 있어서다.
"""
import asyncio
from datetime import date
from types import SimpleNamespace

import pytest

from app.backend.commands.macro import fx as fx_cmd
from app.backend.commands.macro import indicators as macro_cmd
from app.backend.commands.stock import overview as stock_cmd
from app.backend.constants.macro_catalog import FX_PAIRS, INDICATORS, MACRO_SERIES
from app.backend.core.execution import MissingCredentialsError, ServerExecutor


class _Row(dict):
    def model_dump(self, **kwargs):
        return dict(self)


@pytest.fixture
def fake_qe(monkeypatch):
    """ServerExecutor.fetch 대체 — handler(provider, model, params) 가 행 목록을 돌려준다."""
    calls = []
    box = {"handler": lambda p, m, params: []}

    async def fetch(provider, model, params, *args, **kwargs):
        calls.append((provider, model, dict(params)))
        out = box["handler"](provider, model, params)
        if isinstance(out, BaseException):
            raise out
        return [_Row(r) if isinstance(r, dict) else r for r in out]

    monkeypatch.setattr(ServerExecutor, "fetch", fetch)
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
    rows = macro_cmd.ratio_pct_from(fake_qe["handler"](None, None, None), "CPATAX", "GDP")
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

def test_compare_rows_and_partial_failure(auth_client, fake_qe):
    client, _ = auth_client

    def handler(p, m, params):
        if params["symbol"] == "BAD":
            return RuntimeError("down")
        if m == "quote":
            return [{"last_price": 10.0, "change_percent": 1.5, "volume": 100}]
        return [{"symbol": params["symbol"], "pe_ratio": 20.0, "net_margin": 0.3, "week_52_high": 12.0}]

    fake_qe["handler"] = handler
    rows = client.get("/api/stock/compare", params={"symbols": "aapl,bad"}).json()["results"]
    assert rows[0]["symbol"] == "AAPL" and rows[0]["price"] == 10.0 and rows[0]["profit_margin"] == 0.3
    assert rows[1]["symbol"] == "BAD" and rows[1]["error"]
    assert len(fake_qe["calls"]) == 4                      # 종목 2 × 모델 2
    assert client.get("/api/stock/compare", params={"symbols": "AAPL"}).status_code == 400    # 2~4개


def test_compare_raises_when_every_symbol_fails(auth_client, fake_qe):
    client, _ = auth_client
    fake_qe["handler"] = lambda p, m, params: MissingCredentialsError("yahoo")
    r = client.get("/api/stock/compare", params={"symbols": "A,B"})
    assert r.status_code == 424                            # 전부 실패 → 첫 오류 그대로 (키 · Fetcher 안내)


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

from app.backend.commands.stock import news_sentiment as news_cmd  # noqa: E402


def test_news_sentiment_scores_titles_and_trend(auth_client, fake_qe):
    from datetime import datetime, timezone
    client, _ = auth_client
    fake_qe["handler"] = lambda p, m, params: [
        {"title": "Apple beats estimates, stock surges", "published_utc": datetime(2026, 9, 1, 13, tzinfo=timezone.utc),
         "publisher_name": "X", "article_url": "u1"},
        {"title": "Analyst downgrade on weak demand", "published_utc": datetime(2026, 9, 1, 15, tzinfo=timezone.utc)},
        {"title": "Apple event today", "published_utc": None, "publisher": "Y"},
    ]
    out = client.get("/api/stock/sentiment/aapl", params={"provider": "x"}).json()["results"][0]
    assert fake_qe["calls"] == [("x", "news", {"symbol": "AAPL", "limit": 50})]
    assert [n["sentiment"] for n in out["news"]] == ["positive", "negative", "neutral"]
    assert [n["sentiment_score"] for n in out["news"]] == [70, 20, 50]   # downgrade 에 down 도 걸린다
    assert out["news"][0]["published_at"].startswith("2026-09-01T13") and out["news"][2]["source"] == "Y"
    assert out["aggregate"] == {"positive": 1, "negative": 1, "neutral": 1, "overall_score": 50}
    assert out["trend"] == [{"date": "2026-09-01", "score": 45.0}]
# ── 재무 분석 · 감성 · 포트폴리오 (#104 — fetcher 에서 옮김) ──────────────────

from app.backend.commands.stock import fundamentals as fund_cmd
from app.backend.commands.portfolio import performance as pf_cmd
from app.backend.commands.stock import social as sent_cmd  # noqa: E402


def _year(y, ni, eq, rev=100.0):
    return {"date": date(y, 12, 31), "revenue": rev, "gross_profit": 40.0, "operating_income": 20.0,
            "net_income": ni, "stockholders_equity": eq, "total_debt": 50.0,
            "operating_cash_flow": 30.0, "capital_expenditure": -10.0}


def test_moat_counts_high_roe_years_whatever_the_order(auth_client, fake_qe):
    client, _ = auth_client
    years = [_year(2016 + i, 20.0, 100.0) for i in range(8)]          # ROE 20% × 8년 → Wide
    fake_qe["handler"] = lambda p, m, params: list(reversed(years))
    out = client.get("/api/stock/moat/aapl", params={"provider": "x"}).json()["results"][0]
    assert fake_qe["calls"] == [("x", "financials", {"symbol": "AAPL", "period": "annual"})]
    assert out["moat_type"] == "Wide" and out["moat_score"] == 100
    assert [h["year"] for h in out["history"]][:2] == ["2016", "2017"]
    h = out["history"][0]
    assert (h["roe"], h["roic"], h["gross_margin"], h["op_margin"], h["fcf_margin"]) == (20.0, 13.3, 40.0, 20.0, 20.0)

    narrow = [_year(2016 + i, 20.0 if i < 4 else 1.0, 100.0) for i in range(8)]
    assert fund_cmd.moat_from_rows("X", narrow).moat_type == "Narrow"
    assert fund_cmd.moat_from_rows("X", []).moat_type == "No Moat"


def test_quarterly_pnl_margins_and_yoy(auth_client, fake_qe):
    client, _ = auth_client
    qs = [{"date": date(2025, 3 * i + 3, 28) if i < 3 else date(2026, 3 * (i - 3) + 3, 28),
           "revenue": (100 + 10 * i) * 1e9, "gross_profit": 50e9, "operating_income": 25e9,
           "net_income": None, "cost_of_revenue": 50e9}
          for i in range(5)]
    fake_qe["handler"] = lambda p, m, params: qs
    out = client.get("/api/stock/quarterly-pnl/aapl", params={"provider": "x"}).json()["results"][0]
    assert fake_qe["calls"][0][2]["period"] == "quarterly"
    assert out["history"][0]["revenue"] == 100.0 and out["history"][0]["gross_margin"] == 50.0
    assert out["history"][0]["net_margin"] is None
    assert out["yoy_revenue"] == {out["history"][4]["date"]: 40.0}          # 140 vs 100
    assert out["latest"]["revenue"] == 140.0
    assert len(fund_cmd.quarterly_pnl_from_rows("X", qs, 2).history) == 2


_METRICS = {"roe": 0.30, "roa": 0.12, "operating_margin": 0.30, "net_margin": 0.20,
            "revenue_growth": 0.25, "earnings_growth": 0.30, "earnings_quarterly_growth": 0.25,
            "pe_ratio": 15.0, "pb_ratio": 2.5, "ev_ebitda": 10.0, "forward_pe": 12.0,
            "current_price": 100.0, "target_mean_price": 130.0, "recommendation_mean": 1.0,
            "ma_50_day": 90.0, "ma_200_day": 80.0, "free_cash_flow": 5e9, "debt_to_equity": 20.0,
            "beta": 1.6, "market_cap": 200e9}


def test_scorecard_from_key_metrics(auth_client, fake_qe):
    client, _ = auth_client
    fake_qe["handler"] = lambda p, m, params: [_METRICS]
    out = client.get("/api/stock/scorecard/aapl", params={"provider": "x"}).json()["results"][0]
    assert fake_qe["calls"] == [("x", "key_metrics", {"symbol": "AAPL"})]
    c = out["categories"]
    assert (c["fundamentals"]["score"], c["growth"]["score"], c["technical"]["score"]) == (100, 100, 100)
    assert c["valuation"]["score"] == 50                   # 50·0.4 + 50·0.3 + 50·0.3
    assert c["sentiment"]["score"] == 100                  # 추천 1.0 + 상승 여력 30%
    assert out["overall_score"] == 90 and out["investment_grade"] == "Strong Buy"
    assert c["sentiment"]["detail"]["Price Upside"] == "+30.0%"

    empty = fund_cmd.scorecard_from_metrics("X", {})
    assert empty.categories["valuation"]["score"] == 50 and empty.categories["technical"]["score"] == 0
    assert empty.investment_grade == "Strong Sell"


def test_swot_buckets(fake_qe):
    out = fund_cmd.swot_from_metrics("AAPL", _METRICS)
    labels = lambda xs: {x.label for x in xs}  # noqa: E731
    assert {"High ROE", "Strong ROA", "High Operating Margin", "Revenue Growth", "Positive FCF",
            "Low Leverage", "Large Cap Stability"} <= labels(out.strengths)
    assert labels(out.opportunities) == {"EPS Growth Trend", "Analyst Upside", "Improving Earnings Outlook"}
    assert labels(out.threats) == {"High Volatility"}
    assert not out.weaknesses
    bad = fund_cmd.swot_from_metrics("X", {"roe": 0.01, "revenue_growth": -0.1, "debt_to_equity": 150,
                                           "free_cash_flow": -1e9})
    assert labels(bad.weaknesses) == {"Low ROE", "Revenue Decline", "High Debt/Equity", "Negative FCF"}
    assert labels(bad.threats) == {"Leverage Risk"}


def test_revenue_segments_yoy(auth_client, fake_qe):
    client, _ = auth_client
    row = {"symbol": "AAPL", "product": {"segments": ["iPhone", "Mac"], "history": [
        {"date": "2024", "iPhone": 200.0, "Mac": None}, {"date": "2025", "iPhone": 220.0, "Mac": 30.0}]},
        "geo": None}
    fake_qe["handler"] = lambda p, m, params: [row]
    out = client.get("/api/stock/revenue-segments/aapl", params={"provider": "x"}).json()["results"][0]
    assert fake_qe["calls"][0][2] == {"symbol": "AAPL", "limit": 8}
    assert out["product"]["yoy"] == {"iPhone": 10.0, "Mac": None}


def test_social_classifies_reddit_and_aggregates(auth_client, fake_qe):
    client, _ = auth_client
    fake_qe["handler"] = lambda p, m, params: [{
        "symbol": "TSLA",
        "stocktwits_messages": [{"sentiment": "bullish"}, {"sentiment": "bearish"}, {"sentiment": "neutral"}],
        "reddit_posts": [{"title": "Time to BUY, it will surge"}, {"title": "crash incoming"}, {"title": "hm"},
                         {"title": "bull case"}],
    }]
    out = client.get("/api/stock/reddit/tsla").json()["results"][0]
    assert fake_qe["calls"][0][:2] == ("social", "sentiment")
    assert [p["sentiment"] for p in out["reddit_posts"]] == ["positive", "negative", "neutral", "positive"]
    assert out["aggregate"] == {"bullish_pct": 42.9, "bearish_pct": 28.6, "neutral_pct": 28.6, "message_volume": 7}
    assert sent_cmd.aggregate([])["bullish_pct"] == 0


def test_fund_performance_cumulative_from_first_shown_quarter():
    rows = [{"period": "2026-06-30", "return_pct": 10.0, "cumulative_return_pct": 99.0},
            {"period": "2026-03-31", "return_pct": None},
            {"period": "2025-12-31", "return_pct": -50.0}]          # 최신 먼저 (적재 순)
    out = pf_cmd.rebase_cumulative(rows)
    assert [r["period"] for r in out] == [r["period"] for r in rows]   # 순서 유지
    assert [r["cumulative_return_pct"] for r in out] == [-45.0, None, -50.0]
    assert rows[0]["cumulative_return_pct"] == 99.0                    # 입력은 그대로


# ── 백테스트 파생 계열 · 종목 요약 (#114 5단계 — 위젯 transform 에서 옮김) ──────────

from app.backend.commands.strategies import views as bt_cmd  # noqa: E402


def _equity(n=40):
    from datetime import timedelta
    d0 = date(2023, 1, 31)
    vals = [1.0 * (1.01 if i % 3 else 0.98) ** i for i in range(n)]
    return [{"date": (d0 + timedelta(days=30 * i)).isoformat(), "strategy": v, "benchmark": 1 + i * 0.01}
            for i, v in enumerate(vals)]


def test_backtest_equity_view_window_rebases_and_drawdown():
    eq = _equity()
    full = bt_cmd.equity_view(eq, 0)
    assert full[0]["strategy"] == 0 and full[0]["benchmark"] == 0
    assert all(p["drawdown"] <= 0 for p in full)
    last12 = bt_cmd.equity_view(eq, 12)
    assert 12 <= len(last12) <= 14 and last12[0]["strategy"] == 0          # 기간 시작점이 0
    assert bt_cmd.equity_view(eq[:1], 0) == []


def test_backtest_monthly_and_rolling():
    eq = _equity()
    m = bt_cmd.monthly_returns(eq)
    assert m[0]["value"] == 0 and m[1]["value"] == pytest.approx((eq[1]["strategy"] / eq[0]["strategy"] - 1) * 100)
    rows, win = bt_cmd.rolling_sharpe(eq)
    assert win.endswith("개월") and rows and all("sharpe" in r for r in rows)
    assert bt_cmd.rolling_sharpe(eq[:10]) == ([], None)
    out = bt_cmd.with_views({"equity": eq}, 12)
    assert {"equity_view", "monthly", "rolling", "rolling_window"} <= set(out)
    cmp = bt_cmd.with_cumulative({"equity": eq})["equity"]
    assert cmp[0]["strategy_pct"] == 0 and cmp[-1]["benchmark_pct"] == pytest.approx(39.0)


def test_stock_summary_from_inputs():
    closes = [100 * (1.01 if i % 2 else 0.99) for i in range(30)]
    data = {
        "metrics": [{"beta": 1.2, "market_cap": 3e12}],
        "quote": [{"name": "Apple", "last_price": 101.0, "change_percent": 1.0, "currency": "USD"}],
        "history": [{"date": f"2026-01-{i + 1:02d}", "close": c} for i, c in enumerate(closes)],
        "dividends": [{"date": "2026-02-01", "dividend": 0.25}, {"date": "2026-05-01", "dividend": 0.26}],
    }
    out = stock_cmd.summary_from("AAPL", data)
    assert out["price"] == 101.0 and out["name"] == "Apple" and out["last_dividend"] == 0.26
    assert out["week_52_high"] == max(closes) and out["week_52_low"] == min(closes)     # 지표에 없으면 1년 종가
    assert out["volatility"] > 0
    assert stock_cmd.annual_volatility(closes[:10]) is None

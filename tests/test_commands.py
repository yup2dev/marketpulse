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
# ── 재무 분석 · 감성 · 포트폴리오 (#104 — fetcher 에서 옮김) ──────────────────

from app.backend.commands import fundamentals as fund_cmd, portfolio as pf_cmd, sentiment as sent_cmd  # noqa: E402


def _year(y, ni, eq, rev=100.0):
    return {"date": date(y, 12, 31), "revenue": rev, "gross_profit": 40.0, "operating_income": 20.0,
            "net_income": ni, "stockholders_equity": eq, "total_debt": 50.0,
            "operating_cash_flow": 30.0, "capital_expenditure": -10.0}


def test_moat_counts_high_roe_years_whatever_the_order(fake_qe):
    years = [_year(2016 + i, 20.0, 100.0) for i in range(8)]          # ROE 20% × 8년 → Wide
    fake_qe["handler"] = lambda p, m, params: list(reversed(years))
    out = _run(fund_cmd.moat("AAPL", Source("x", "financials")))[0]
    assert fake_qe["calls"] == [("x", "financials", {"symbol": "AAPL", "period": "annual"})]
    assert out.moat_type == "Wide" and out.moat_score == 100
    assert [h.year for h in out.history][:2] == ["2016", "2017"]
    h = out.history[0]
    assert (h.roe, h.roic, h.gross_margin, h.op_margin, h.fcf_margin) == (20.0, 13.3, 40.0, 20.0, 20.0)

    narrow = [_year(2016 + i, 20.0 if i < 4 else 1.0, 100.0) for i in range(8)]
    assert fund_cmd.moat_from_rows("X", narrow).moat_type == "Narrow"
    assert fund_cmd.moat_from_rows("X", []).moat_type == "No Moat"


def test_quarterly_pnl_margins_and_yoy(fake_qe):
    qs = [{"date": date(2025, 3 * i + 3, 28) if i < 3 else date(2026, 3 * (i - 3) + 3, 28),
           "revenue": (100 + 10 * i) * 1e9, "gross_profit": 50e9, "operating_income": 25e9,
           "net_income": None, "cost_of_revenue": 50e9}
          for i in range(5)]
    fake_qe["handler"] = lambda p, m, params: qs
    out = _run(fund_cmd.quarterly_pnl("AAPL", Source("x", "financials"), limit=12))[0]
    assert fake_qe["calls"][0][2]["period"] == "quarterly"
    assert out.history[0].revenue == 100.0 and out.history[0].gross_margin == 50.0
    assert out.history[0].net_margin is None
    assert out.yoy_revenue == {out.history[4].date: 40.0}          # 140 vs 100
    assert out.latest["revenue"] == 140.0
    assert len(fund_cmd.quarterly_pnl_from_rows("X", qs, 2).history) == 2


_METRICS = {"roe": 0.30, "roa": 0.12, "operating_margin": 0.30, "net_margin": 0.20,
            "revenue_growth": 0.25, "earnings_growth": 0.30, "earnings_quarterly_growth": 0.25,
            "pe_ratio": 15.0, "pb_ratio": 2.5, "ev_ebitda": 10.0, "forward_pe": 12.0,
            "current_price": 100.0, "target_mean_price": 130.0, "recommendation_mean": 1.0,
            "ma_50_day": 90.0, "ma_200_day": 80.0, "free_cash_flow": 5e9, "debt_to_equity": 20.0,
            "beta": 1.6, "market_cap": 200e9}


def test_scorecard_from_key_metrics(fake_qe):
    fake_qe["handler"] = lambda p, m, params: [_METRICS]
    out = _run(fund_cmd.scorecard("AAPL", Source("x", "key_metrics")))[0]
    assert fake_qe["calls"] == [("x", "key_metrics", {"symbol": "AAPL"})]
    c = out.categories
    assert (c["fundamentals"]["score"], c["growth"]["score"], c["technical"]["score"]) == (100, 100, 100)
    assert c["valuation"]["score"] == 50                   # 50·0.4 + 50·0.3 + 50·0.3
    assert c["sentiment"]["score"] == 100                  # 추천 1.0 + 상승 여력 30%
    assert out.overall_score == 90 and out.investment_grade == "Strong Buy"
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


def test_revenue_segments_yoy(fake_qe):
    row = {"symbol": "AAPL", "product": {"segments": ["iPhone", "Mac"], "history": [
        {"date": "2024", "iPhone": 200.0, "Mac": None}, {"date": "2025", "iPhone": 220.0, "Mac": 30.0}]},
        "geo": None}
    fake_qe["handler"] = lambda p, m, params: [row]
    out = _run(fund_cmd.revenue_segments("AAPL", Source("x", "revenue_segments"), 8))[0]
    assert fake_qe["calls"][0][2] == {"symbol": "AAPL", "limit": 8}
    assert out["product"]["yoy"] == {"iPhone": 10.0, "Mac": None}


def test_social_classifies_reddit_and_aggregates(fake_qe):
    fake_qe["handler"] = lambda p, m, params: [{
        "symbol": "TSLA",
        "stocktwits_messages": [{"sentiment": "bullish"}, {"sentiment": "bearish"}, {"sentiment": "neutral"}],
        "reddit_posts": [{"title": "Time to BUY, it will surge"}, {"title": "crash incoming"}, {"title": "hm"},
                         {"title": "bull case"}],
    }]
    out = _run(sent_cmd.social("TSLA", Source("x", "sentiment")))[0]
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

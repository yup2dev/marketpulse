"""db provider fetcher — 서비스가 배치 테이블을 직접 읽지 않고 fetcher(표준 모델)로 읽는다.

conftest 의 db_session 이 DbFetcher 도 같은 테스트 DB 를 읽게 한다. 네트워크 없음.
"""
import asyncio
import json
from datetime import date, datetime
from decimal import Decimal

import pytest

from app.backend.models.orm import (
    MBS_IN_ARTICLE, MBS_IN_FINANCIAL_METRICS, MBS_IN_QUANT_SNAPSHOT, MBS_IN_SECTOR_PERF, MBS_IN_STBD_MST,
    MBS_IN_STK_PERIOD_RTN, MBS_IN_STK_PROFILE, MBS_IN_STK_RELATIONS, MBS_IN_STK_STBD, MBS_PROC_ARTICLE,
)
from app.backend.core.execution import rows_blocking as rows_sync
from app.backend.platform.obbject import OBBject
from app.backend.core.execution import fetch_blocking


def _seed(db):
    db.add_all([
        MBS_IN_STBD_MST(ticker_cd="AAPL", ticker_nm="Apple", asset_type="stock", country="US",
                        sector="Technology", industry="Consumer Electronics", exchange="NASDAQ", curr="USD",
                        is_active=True),
        MBS_IN_STBD_MST(ticker_cd="MSFT", ticker_nm="Microsoft", asset_type="stock", country="US",
                        sector="Technology", industry="Software", exchange="NASDAQ", curr="USD", is_active=True),
        MBS_IN_STBD_MST(ticker_cd="005930", ticker_nm="삼성전자", asset_type="stock", country="KR",
                        sector="반도체", exchange="KOSPI", curr="KRW", is_active=True),
        MBS_IN_STBD_MST(ticker_cd="OLD", ticker_nm="Delisted", asset_type="stock", country="US",
                        sector="Technology", curr="USD", is_active=False),
        MBS_IN_STK_STBD(stk_cd="AAPL", stk_nm="Apple", close_price=Decimal("190"), change_rate=Decimal("1.5"),
                        base_ymd=date(2026, 11, 20)),
        MBS_IN_STK_STBD(stk_cd="AAPL", stk_nm="Apple", close_price=Decimal("200"), change_rate=Decimal("-2.5"),
                        volume=1000, base_ymd=date(2026, 11, 21)),
        MBS_IN_STK_PROFILE(stk_cd="AAPL", stk_nm="Apple Inc.", sector="Technology", industry="Consumer Electronics",
                           market_cap=Decimal("3000000000000"), price=Decimal("200"), beta=Decimal("1.2"),
                           currency="USD", exchange="NASDAQ", in_sp500=True),
        MBS_IN_STK_PROFILE(stk_cd="MSFT", stk_nm="Microsoft Corp.", sector="Technology", industry="Software",
                           market_cap=Decimal("2500000000000"), currency="USD", exchange="NASDAQ", in_sp500=True),
        MBS_IN_FINANCIAL_METRICS(stk_cd="AAPL", pe_ratio=Decimal("30"), roe=Decimal("0.15"),
                                 base_ymd=date(2025, 12, 31), fiscal_period="FY"),
        MBS_IN_FINANCIAL_METRICS(stk_cd="AAPL", pe_ratio=Decimal("28"), roe=Decimal("0.32"),
                                 base_ymd=date(2026, 9, 30), fiscal_period="Q3"),
        MBS_IN_FINANCIAL_METRICS(stk_cd="MSFT", pe_ratio=Decimal("35"), roe=Decimal("0.30"),
                                 base_ymd=date(2026, 9, 30), fiscal_period="Q3"),
    ])
    db.commit()


def _build_stats(db):
    """로컬 배치(build_market_stats)가 하는 계산을 같은 DB 에 — 서버 fetcher 는 그 결과만 읽는다."""
    from index_analyzer import market_stats

    db.bulk_insert_mappings(MBS_IN_STK_PERIOD_RTN, market_stats.period_returns(db))
    db.bulk_insert_mappings(MBS_IN_SECTOR_PERF, market_stats.sector_performance(db))
    db.commit()


# ── 종목 마스터 · 시세 ────────────────────────────────────────────────────────

def test_stock_list_filters(db_session):
    _seed(db_session)
    assert {r.ticker_cd for r in rows_sync("db", "stock_list", symbols="aapl,005930")} == {"AAPL", "005930"}
    us_tech = rows_sync("db", "stock_list", country="US", sector="Technology")
    assert {r.ticker_cd for r in us_tech} == {"AAPL", "MSFT"}       # 비활성 제외
    assert us_tech[0].country == "US"
    every = rows_sync("db", "stock_list", country="US", active_only=False)
    assert {r.ticker_cd: r.is_active for r in every}["OLD"] is False


def test_quote_is_last_loaded_row_per_symbol(db_session):
    _seed(db_session)
    [q] = rows_sync("db", "quote", symbol="AAPL,NONE")
    assert q.last_price == 200.0 and q.change_percent == -2.5 and q.date == date(2026, 11, 21)
    assert q.volume == 1000


def test_alert_check_uses_db_quote(db_session):
    from app.backend.models.orm import Alert, User
    from app.backend.services.alert_service import AlertService

    _seed(db_session)
    db_session.add(User(user_id="u1", email="u1@example.com", username="u1", hashed_password="x"))
    db_session.add_all([
        Alert(alert_id="a1", user_id="u1", alert_type="price", ticker_cd="AAPL",
              condition_type="above", threshold_value=Decimal("150"), is_active=True, trigger_count=0),
        Alert(alert_id="a2", user_id="u1", alert_type="price", ticker_cd="AAPL",
              condition_type="percent_change", threshold_value=Decimal("5"), is_active=True, trigger_count=0),
        Alert(alert_id="a3", user_id="u1", alert_type="price", ticker_cd="NONE",
              condition_type="above", threshold_value=Decimal("1"), is_active=True, trigger_count=0),
    ])
    db_session.commit()
    fired = AlertService.check_price_alerts(db_session)
    assert [f["alert"]["alert_id"] for f in fired] == ["a1"]
    assert fired[0]["current_price"] == 200.0


def test_watchlist_items_get_names_from_stock_list(db_session):
    from app.backend.models.orm import User, Watchlist, WatchlistItem
    from app.backend.services.watchlist_service import WatchlistService

    _seed(db_session)
    db_session.add(User(user_id="u1", email="u1@example.com", username="u1", hashed_password="x"))
    db_session.add(Watchlist(watchlist_id="w1", user_id="u1", name="w"))
    db_session.add_all([WatchlistItem(item_id="i1", watchlist_id="w1", ticker_cd="AAPL", sort_order=0),
                        WatchlistItem(item_id="i2", watchlist_id="w1", ticker_cd="ZZZ", sort_order=1)])
    db_session.commit()
    items = WatchlistService.get_watchlist_items(db_session, "w1", "u1")
    assert [(i["ticker_name"], i["sector"]) for i in items] == [("Apple", "Technology"), ("ZZZ", None)]


# ── 프로필 · 관계 · 섹터 ──────────────────────────────────────────────────────

def test_company_profile_and_relations(db_session):
    from app.backend.commands.stock.relations import get_company_relations

    _seed(db_session)
    db_session.add(MBS_IN_STK_RELATIONS(stk_cd="AAPL", related_cd="TSM", related_nm="TSMC",
                                        relation_type="supplier", data_source="fmp"))   # confidence 기본 1.0
    db_session.commit()
    profiles = rows_sync("db", "company_profile", symbol="AAPL,MSFT")
    assert {p.symbol: p.market_cap for p in profiles} == {"AAPL": 3e12, "MSFT": 2.5e12}

    out = asyncio.run(get_company_relations("aapl"))
    assert out["found"] and out["name"] == "Apple Inc." and out["sector"] == "Technology"
    assert out["nodes"] == [{"symbol": "TSM", "name": "TSMC", "type": "supplier", "detail": "",
                             "confidence": 1.0, "data_source": "fmp"}]


def test_sector_performance_groups_profiles(db_session):
    _seed(db_session)
    assert rows_sync("db", "sector_performance") == []   # 배치가 아직 안 돌았으면 비어 있다 (서버는 계산하지 않는다)
    _build_stats(db_session)
    [tech] = rows_sync("db", "sector_performance")       # S&P 500 편입이 50개 미만 → 프로필 전체
    assert tech.sector == "Technology" and tech.count == 2
    assert tech.total_market_cap == 5.5e12
    assert [s.symbol for s in tech.stocks] == ["AAPL", "MSFT"]


# ── 뉴스 이벤트 · 퀀트 스냅샷 ─────────────────────────────────────────────────

def test_news_events_join_article(db_session):
    db_session.add(MBS_IN_ARTICLE(news_id="n1", base_ymd=date(2026, 11, 3), source_cd="rss",
                                  title="Apple beats", url="http://x", publish_dt=datetime(2026, 11, 3, 9)))
    db_session.add(MBS_PROC_ARTICLE(proc_id="p1", news_id="n1", stk_cd="AAPL", summary_text="s",
                                    sentiment_score=Decimal("0.7"), base_ymd=date(2026, 11, 3)))
    db_session.commit()
    [e] = rows_sync("db", "news_events", symbol="aapl", start_date="2026-11-01")
    assert e.title == "Apple beats" and e.sentiment_score == 0.7 and e.source == "rss"
    assert rows_sync("db", "news_events", symbol="AAPL", start_date="2026-11-04") == []


def test_quant_snapshot_rows_and_metadata(db_session):
    raw = fetch_blocking("db", "quant_snapshot", {"dataset": "factors"})
    assert OBBject.unwrap(raw) == [] and OBBject.metadata_of(raw)["loaded"] is False

    db_session.add(MBS_IN_QUANT_SNAPSHOT(universe="sp500", dataset="factors", base_ymd=date(2026, 10, 31),
                                         payload=json.dumps([{"id": "mom_12_1", "ic": 0.03}]),
                                         meta=json.dumps({"months": 120})))
    db_session.commit()
    raw = fetch_blocking("db", "quant_snapshot", {"dataset": "factors"})
    assert OBBject.from_result(raw, "db").results == [{"id": "mom_12_1", "ic": 0.03}]
    assert OBBject.metadata_of(raw) == {"universe": "sp500", "loaded": True, "months": 120, "as_of": "2026-10-31"}


# ── 스크리너 ──────────────────────────────────────────────────────────────────

def test_equity_screener_filters_and_percent(db_session):
    _seed(db_session)
    rows = rows_sync("db", "equity_screener", roe_min=31)
    assert [r.symbol for r in rows] == ["AAPL"]
    assert rows[0].roe == pytest.approx(32.0) and rows[0].pe_ratio == 28.0     # 최신 재무 행, % 로
    assert {r.symbol for r in rows_sync("db", "equity_screener", sector="technology,반도체")} == {"AAPL", "MSFT", "005930"}
    assert [r.symbol for r in rows_sync("db", "equity_screener", market="domestic")] == ["005930"]
    assert rows_sync("db", "equity_screener", pe_ratio_max=10) == []


def test_screen_stocks_merges_prices_then_price_filters(db_session, monkeypatch):
    from app.backend.commands.screener import screens as svc

    _seed(db_session)

    async def fake_quotes(symbols_key):
        return {"AAPL": {"close_price": 200.0, "change_rate": 2.0, "volume": 10, "trade_value": 2000.0}}

    monkeypatch.setattr(svc, "_yf_screener_quotes", fake_quotes)
    rows = asyncio.run(svc.ScreenerService.screen_stocks({"sector": ["Technology"]}))
    assert {r["stk_cd"]: r["close_price"] for r in rows} == {"AAPL": 200.0, "MSFT": None}
    # 가격 조건은 시세를 붙인 뒤에 건다 — 시세 없는 종목은 빠진다
    rows = asyncio.run(svc.ScreenerService.screen_stocks({"sector": ["Technology"], "change_pct_min": 1}))
    assert [r["stk_cd"] for r in rows] == ["AAPL"]


# ── 기간 랭킹 ─────────────────────────────────────────────────────────────────

def test_stock_ranking_market_sort_limit(db_session):
    for cd, curr, chg in (("AAA", "USD", 3.0), ("BBB", "USD", -1.0), ("CCC", "KRW", 5.0), ("DDD", "USD", 1.0)):
        db_session.add(MBS_IN_STK_STBD(stk_cd=cd, stk_nm=cd, curr=curr, close_price=Decimal("10"),
                                       change_rate=Decimal(str(chg)), base_ymd=date(2026, 11, 21)))
    db_session.commit()
    _build_stats(db_session)
    gainers = rows_sync("db", "stock_ranking", period="1d", sort_by="gainers")
    assert [r.stk_cd for r in gainers] == ["CCC", "AAA", "DDD"]          # 내린 종목은 빠진다
    us = rows_sync("db", "stock_ranking", period="1d", market="overseas", sort_by="gainers", limit=1)
    assert [r.stk_cd for r in us] == ["AAA"]
    assert [r.stk_cd for r in rows_sync("db", "stock_ranking", period="1d", sort_by="losers")] == ["BBB"]


def test_stock_ranking_periods_from_batch_table(db_session):
    """1w ~ 1y 는 배치가 계산한 값 — 자기 최신일 - N일 이하의 가장 최근 종가, 없으면 첫 거래일 종가."""
    for d, close in ((date(2026, 10, 1), "100"), (date(2026, 11, 13), "150"), (date(2026, 11, 21), "165")):
        db_session.add(MBS_IN_STK_STBD(stk_cd="AAA", stk_nm="A", curr="USD", close_price=Decimal(close),
                                       change_rate=Decimal("1"), base_ymd=d))
    db_session.add(MBS_IN_STK_STBD(stk_cd="NEW", stk_nm="N", curr="USD", close_price=Decimal("10"),
                                   change_rate=Decimal("0"), base_ymd=date(2026, 11, 21)))    # 하루치뿐
    db_session.commit()
    _build_stats(db_session)

    def chg(period):
        return {r.stk_cd: r.change_rate for r in rows_sync("db", "stock_ranking", period=period)}

    assert chg("1w")["AAA"] == pytest.approx(10.0)       # 165 vs 11-13 의 150
    assert chg("1mo")["AAA"] == pytest.approx(65.0)      # 11-21 - 30일 이하 → 10-01 의 100
    assert chg("1y")["AAA"] == pytest.approx(65.0)       # 1년 전이 없으면 첫 거래일
    assert chg("1w")["NEW"] is None and chg("1d")["NEW"] == 0.0
    ref = db_session.query(MBS_IN_STK_PERIOD_RTN).filter_by(stk_cd="AAA", period="1w").one()
    assert ref.ref_ymd == date(2026, 11, 13)

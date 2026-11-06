"""위젯 기간·기준일 파라미터 — 이벤트 목록 기간 필터 + FRED 스냅샷 기준일(as-of)."""
import asyncio
from datetime import date, timedelta

import pytest

import data_fetcher.providers_init  # noqa: F401
from app.backend.api.deps import filter_dated_rows, period_start, resolve_date_range
from data_fetcher.providers.fred.models import (
    financial_conditions, inflation_decomposition, labor_dashboard, sentiment_composite, yield_curve,
)
from data_fetcher.providers.fred.utils.helpers import FredSeriesHelper


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


def test_stock_dividends_period_filters_and_skips_default_limit(monkeypatch):
    from app.backend.api.routes import stock

    today = date.today()
    rows = [{"date": (today - timedelta(days=90 * i)).isoformat(), "amount": 0.25} for i in range(60)]
    seen = {}

    async def fake_fetch(provider, model, params):
        seen.update(params)
        return rows

    monkeypatch.setattr(stock.QueryExecutor, "fetch", fake_fetch)
    obb = asyncio.run(stock.get_dividends.__wrapped__("aapl", period="10y"))
    # 10년 ≈ 40건 — 예전 기본 20건 제한에 잘리지 않는다
    assert 39 <= len(obb.results) <= 41
    assert seen["start_date"] == period_start("10y")
    obb = asyncio.run(stock.get_dividends.__wrapped__("aapl"))
    assert len(obb.results) == 20


# ── FRED 스냅샷 기준일 ────────────────────────────────────────────────────────

@pytest.mark.parametrize("fetcher_cls,qp_cls", [
    (yield_curve.FREDYieldCurveFetcher, yield_curve.FREDYieldCurveQueryParams),
    (labor_dashboard.FREDLaborDashboardFetcher, labor_dashboard.DashboardQueryParams),
    (financial_conditions.FREDFinancialConditionsFetcher, financial_conditions.DashboardQueryParams),
    (sentiment_composite.FREDSentimentCompositeFetcher, sentiment_composite.DashboardQueryParams),
    (inflation_decomposition.FREDInflationDecompositionFetcher, inflation_decomposition.InflationDecompositionQueryParams),
])
def test_as_of_date_caps_every_fred_request(monkeypatch, fetcher_cls, qp_cls):
    ends = []

    async def fake_series(*args, end_date=None, **kwargs):
        ends.append(end_date)
        return [{"date": "2020-03-13", "value": "1.0"}]

    monkeypatch.setattr(FredSeriesHelper, "fetch_series", staticmethod(fake_series))
    monkeypatch.setenv("FRED_API_KEY", "test")
    asyncio.run(fetcher_cls.aextract_data(qp_cls(date="2020-03-16"), credentials={"fred_api_key": "test"}))
    assert ends and all(e == date(2020, 3, 16) for e in ends)

    ends.clear()
    asyncio.run(fetcher_cls.aextract_data(qp_cls(), credentials={"fred_api_key": "test"}))
    assert ends and all(e is None for e in ends)

"""거시 분석 command — 레짐 · 연준 기조 · 필립스 · 인플레이션 · 노동 · 금융 여건 · 심리 (#105, fred fetcher 에서 옮김).

계산은 순수 함수로 보고, 라우트는 FRED 시리즈를 어떤 파라미터(series_id · units · 기준일)로 부르는지 본다.
"""
import asyncio
from datetime import date

import pytest

from app.backend.commands import (
    inflation as infl, labor, market_conditions as mc, regime,
)
from app.backend.commands._base import Source
from data_fetcher.query_executor import QueryExecutor
from data_fetcher.utils.registry import FetcherRegistry


def _monthly(values_newest_first, start=(2026, 9)):
    y, m = start
    out = []
    for v in values_newest_first:
        out.append({"date": f"{y}-{m:02d}-01", "value": v})
        m -= 1
        if m == 0:
            y, m = y - 1, 12
    return out


def test_fred_analysis_models_are_gone():
    import data_fetcher.providers_init  # noqa: F401
    for model in ("regime_current", "fed_policy_stance", "inflation_decomposition", "labor_dashboard",
                  "sentiment_composite", "inflation_sector"):
        assert FetcherRegistry.list_providers(model) == []


# ── 현재 레짐 ──────────────────────────────────────────────────────────────────

def test_regime_uses_latest_gdp_even_when_input_is_ascending():
    gdp = [{"date": "1947-04-01", "value": -1.0}, {"date": "2026-04-01", "value": 3.8},
           {"date": "2026-07-01", "value": 3.4}]
    cpi_yoy = _monthly([4.0, 3.9, 3.8, 3.5])                 # FRED pc1
    out = regime.compute_regime(gdp, [], [], cpi_yoy)

    assert out.cmp_gdp_growth == 3.4 and out.gdp_date == "2026-07-01"
    assert out.growth_momentum == pytest.approx(-0.4)
    assert out.cmp_cpi_yoy == 4.0 and out.cpi_date == "2026-09-01"
    assert out.inflation_momentum == pytest.approx(0.5)     # 2026-09 4.0 vs 2026-06 3.5
    assert out.regime == "reflation"


def test_regime_momentum_is_zero_when_3m_ago_missing():
    out = regime.compute_regime([{"date": "2026-07-01", "value": 1.0}], [], [], _monthly([2.0, 2.1]))
    assert out.inflation_momentum == 0.0 and out.regime == "goldilocks"


@pytest.mark.parametrize("growth,cpi,expected", [
    (10, 2.0, "goldilocks"), (10, 3.5, "reflation"),
    (-10, 3.5, "stagflation"), (-10, 2.0, "deflation"), (0, 3.0, "deflation"),
])
def test_classify_regime(growth, cpi, expected):
    assert regime.classify_regime(growth, cpi) == expected


def test_regime_history_and_transitions():
    gdp = [{"date": "2025-01-01", "value": 2.0}, {"date": "2025-04-01", "value": -1.0},
           {"date": "2025-07-01", "value": 3.0}]
    cpi = [{"date": "2025-01-01", "value": 2.0}, {"date": "2025-04-01", "value": 3.0},
           {"date": "2025-07-01", "value": 2.4}]
    hist, trans = regime.regime_history_from(gdp, cpi)
    assert [h.regime for h in hist] == ["goldilocks", "stagflation", "goldilocks"]
    assert trans == [{"date": "2025-04-01", "from": "goldilocks", "to": "stagflation"},
                     {"date": "2025-07-01", "from": "stagflation", "to": "goldilocks"}]
    hist, _ = regime.regime_history_from(gdp, cpi, start=date(2025, 4, 1))
    assert [h.date for h in hist] == ["2025-04-01", "2025-07-01"]


def test_phillips_pairs_nearest_cpi_month():
    u = [{"date": "2026-08-01", "value": 4.12}, {"date": "2026-09-01", "value": 4.3}]
    cpi = [{"date": "2026-08-01", "value": 2.94}]
    out = regime.phillips_from(u, cpi)
    assert [(p.date, p.unemployment, p.inflation) for p in out] == [("2026-08-01", 4.1, 2.9), ("2026-09-01", 4.3, 2.9)]
    assert regime.phillips_from(u, []) == []


# ── 연준 기조 ──────────────────────────────────────────────────────────────────

def test_stance_hawkish_after_hikes():
    today = date(2026, 11, 1)
    rates = [{"date": f"2026-{m:02d}-01", "rate": r} for m, r in [(10, 5.5), (9, 5.25), (8, 5.0), (7, 5.0)]]
    rates += [{"date": "2020-01-01", "rate": 0.1}, {"date": "2007-01-01", "rate": 6.5}]
    rows = {r.metric: r.value for r in regime.compute_stance(rates, today)}

    assert rows["Stance"] == "hawkish"
    assert rows["Fed Funds Rate"] == 5.5
    assert rows["Rate Changes 12M"] == 2
    assert rows["Peak Rate"] == 6.5 and rows["Trough Rate"] == 0.1
    assert (rows["Hike Prob"], rows["Hold Prob"], rows["Cut Prob"]) == (65, 30, 5)
    assert rows["Last Updated"] == "2026-10-01"


def test_stance_needs_data():
    with pytest.raises(ValueError):
        regime.compute_stance([{"date": "2026-10-01", "rate": 4.0}])


# ── 인플레이션 ─────────────────────────────────────────────────────────────────

def test_index_stats_missing_prior_month_gives_no_mom():
    st = infl.index_stats(_monthly([110.0, ".", 109.0] + [100.0] * 12))   # 전월 결측
    assert st["current"] == 110.0 and st["yoy"] == pytest.approx(10.0) and st["mom"] is None


# 실제 FRED CPIAUCSL — 2025-10 은 셧다운으로 '.'(결측)
_REAL_CPI = [("2026-09", "336.298"), ("2026-08", "334.131"), ("2026-07", "332.813"),
             ("2026-06", "332.568"), ("2026-05", "333.979"), ("2026-04", "332.407"),
             ("2026-03", "330.293"), ("2026-02", "327.460"), ("2026-01", "326.588"),
             ("2025-12", "326.031"), ("2025-11", "325.063"), ("2025-10", "."),
             ("2025-09", "324.245"), ("2025-08", "323.291"), ("2025-07", "322.169")]


def test_yoy_is_date_matched_across_fred_gap():
    obs = [{"date": f"{d}-01", "value": v} for d, v in _REAL_CPI]
    # 위치 기준(결측 제거 후 12칸 뒤)이면 2025-08 대비 4.02% — 13개월 변화로 틀린 값
    assert infl.index_stats(obs)["yoy"] == pytest.approx(3.72, abs=0.01)
    by = {p.date: p for p in infl.momentum_from(obs)}
    assert by["2026-09-01"].yoy_12m == pytest.approx(3.72, abs=0.01)
    assert "2026-10-01" not in by


def test_momentum_annualizes_6m_and_3m():
    rows = [{"date": f"2025-{m:02d}-01", "value": 100.0} for m in range(1, 13)]
    rows += [{"date": "2026-01-01", "value": 103.0}]
    p = infl.momentum_from(rows)[-1]
    assert p.yoy_12m == 3.0
    assert p.yoy_6m == pytest.approx(6.09, abs=0.01)       # 1.03^2 - 1
    assert p.yoy_3m == pytest.approx(12.55, abs=0.01)      # 1.03^4 - 1
    assert infl.momentum_from(rows, start=date(2026, 2, 1)) == []


def test_build_rows_contribution_and_weights():
    assert sum(w for _, _, w in infl.COMPONENTS) == pytest.approx(100.0)
    obs = {sid: _monthly([105.0] + [100.0] * 12) for _, sid, _ in infl.COMPONENTS}   # 모두 YoY 5%
    obs[infl.COMPONENTS[1][1]] = []                                                    # Energy 결측
    rows = infl.build_rows(obs)
    assert rows[0].yoy_change == 5.0
    assert rows[0].contribution == pytest.approx(rows[0].weight * 0.05, abs=0.01)
    assert rows[1].yoy_change is None and rows[1].contribution is None
    assert [r.category for r in rows] == [c for c, _, _ in infl.COMPONENTS]


def test_sector_pivots_pc1_rows_on_headline_dates():
    rows = [{"date": "2026-08-01", "value": 2.9, "series_id": "CPIAUCSL"},
            {"date": "2026-09-01", "value": 3.0, "series_id": "CPIAUCSL"},
            {"date": "2026-09-01", "value": 4.123, "series_id": "CUSR0000SAH1"},
            {"date": "2026-07-01", "value": 9.9, "series_id": "CPIENGSL"}]     # 헤드라인에 없는 날짜
    out = infl.sector_from(rows)
    assert [(p.date, p.headline, p.shelter, p.energy) for p in out] == [
        ("2026-08-01", 2.9, None, None), ("2026-09-01", 3.0, 4.12, None)]


# ── 노동 ───────────────────────────────────────────────────────────────────────

def test_labor_rows_and_heat():
    data = {
        "u3": _monthly([4.0, 4.3]), "payroll": _monthly([159000.0, 158800.0]),
        "quits": _monthly([2.0]), "claims": [{"date": "2026-09-20", "value": 220000.0}],
        "earnings": _monthly([36.0] + [35.0] * 11 + [34.0]),
    }
    rows = {r.metric: r for r in labor.labor_rows(data)}
    assert rows["U3 Rate"].status == "improving"
    assert rows["Payroll Change MoM"].value == 200
    assert rows["Earnings YoY"].value == pytest.approx(5.88, abs=0.01)
    assert rows["Labor Market Heat"].value == pytest.approx((20 + 80 + 90) / 3, abs=0.1)
    assert "U6 Rate" not in rows


def test_jobs_from_is_change_since_first_common_month():
    out = labor.jobs_from(_monthly([110.0, 100.0]), _monthly([22.0, 20.0, 19.0]))
    assert [(p.date, p.private, p.government) for p in out] == [("2026-08-01", 0, 0), ("2026-09-01", 10, 2)]


# ── 금융 여건 · 심리 ───────────────────────────────────────────────────────────

def test_conditions_rows():
    data = {"nfci": _monthly([-0.6]), "hy": _monthly([600.0]), "aaa": _monthly([0.5]),
            "credit_total": _monthly([110.0] + [100.0] * 12)}
    rows = {r.metric: r for r in mc.conditions_rows(data)}
    assert rows["Chicago Fed NFCI"].status == "loose"
    assert rows["High Yield OAS"].percentile == 50.0
    assert rows["Investment Grade (AAA)"].value == 50
    assert rows["Credit Growth YoY"].value == 10.0


def test_sentiment_rows_index_first():
    data = {"vix": _monthly([15.0]), "hy": _monthly([300.0]), "dgs10": _monthly([4.0, 4.0])}
    rows = mc.sentiment_rows(data)
    assert rows[0].metric == "Index" and rows[0].value == pytest.approx((70 + 80 + 50) / 3, abs=0.1)
    assert rows[0].status == "greed"                     # 66.7
    assert mc.sentiment_rows({}) == []


def test_sentiment_history_scores_each_day():
    out = mc.sentiment_history_from([{"date": "2026-09-01", "value": 15.0}],
                                    [{"date": "2026-09-01", "value": 300.0}, {"date": "2026-09-02", "value": 500.0}])
    assert [(p.date, p.fear_greed_score) for p in out] == [("2026-09-01", 75.0), ("2026-09-02", 30.0)]


# ── 라우트 → FRED 시리즈 호출 ─────────────────────────────────────────────────

@pytest.fixture
def series_calls(monkeypatch):
    calls = []

    async def fetch(provider, model, params, *a, **k):
        calls.append((provider, model, dict(params)))
        return []

    monkeypatch.setattr(QueryExecutor, "fetch", fetch)
    return calls


def test_snapshot_routes_pass_as_of_date(auth_client, series_calls):
    client, _ = auth_client
    for path in ("/api/macro/labor/dashboard", "/api/macro/financial-conditions", "/api/macro/sentiment/composite"):
        series_calls.clear()
        res = client.get(path, params={"date": "2025-06-30"})
        assert res.status_code == 200, (path, res.text)
        assert series_calls and all(m == "series" and p["end_date"] == date(2025, 6, 30) for _, m, p in series_calls)


def test_yoy_series_are_requested_with_fred_units(auth_client, series_calls):
    client, _ = auth_client
    client.get("/api/macro/inflation/sector-history", params={"period": "1y"})
    assert len(series_calls) == 1 and series_calls[0][2]["units"] == "pc1"
    assert "CPIAUCSL" in series_calls[0][2]["series_id"]

    series_calls.clear()
    client.get("/api/macro/labor/history", params={"period": "1y"})
    units = {p["series_id"]: p.get("units") for _, _, p in series_calls}
    assert units == {"UNRATE": None, "CPIAUCSL": "pc1"}


def test_decomposition_route_needs_component_series(auth_client, series_calls):
    client, _ = auth_client
    res = client.get("/api/macro/inflation/decomposition")
    assert res.status_code >= 400                         # 구성요소가 하나도 없으면 오류


def test_regime_current_needs_gdp_and_cpi(monkeypatch):
    async def fetch(provider, model, params, *a, **k):
        if params["series_id"] == "CPIAUCSL":
            raise RuntimeError("down")
        return []

    monkeypatch.setattr(QueryExecutor, "fetch", fetch)
    with pytest.raises(RuntimeError):
        asyncio.run(regime.regime_current(Source("x", "series")))

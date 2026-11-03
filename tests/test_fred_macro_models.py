"""macro_service에서 FRED 모델로 옮긴 계산 — regime_current / fed_policy_stance / inflation_decomposition."""
from datetime import date

import pytest

import data_fetcher.providers_init  # noqa: F401
from data_fetcher.providers.fred.models.fed_policy_stance import compute_stance
from data_fetcher.providers.fred.models.inflation_decomposition import (
    _COMPONENTS,
    build_rows,
    index_stats,
)
from data_fetcher.providers.fred.models.regime_current import classify_regime, compute_regime
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


def test_models_registered():
    for model in ("regime_current", "fed_policy_stance", "inflation_decomposition"):
        assert FetcherRegistry.list_providers(model) == ["fred"]


# ── regime_current ──────────────────────────────────────────────────────────

def test_regime_uses_latest_gdp_even_when_input_is_ascending():
    # FRED gdp 모델은 오름차순으로 준다 — 예전 코드는 [0](1947년)을 '최신'으로 썼다.
    gdp = [{"date": "1947-04-01", "value": -1.0}, {"date": "2026-04-01", "value": 3.8},
           {"date": "2026-07-01", "value": 3.4}]
    cpi = _monthly([104.0] + [101.0] * 11 + [100.0] + [100.0] * 3)   # YoY 4.0%
    out = compute_regime(gdp, [], [], cpi)

    assert out["cmp_gdp_growth"] == 3.4 and out["gdp_date"] == "2026-07-01"
    assert out["growth_momentum"] == pytest.approx(-0.4)
    assert out["cmp_cpi_yoy"] == pytest.approx(4.0)
    assert out["regime"] == "reflation"          # 성장 + CPI > 3%


@pytest.mark.parametrize("growth,cpi,expected", [
    (10, 2.0, "goldilocks"), (10, 3.5, "reflation"),
    (-10, 3.5, "stagflation"), (-10, 2.0, "deflation"), (0, 3.0, "deflation"),
])
def test_classify_regime(growth, cpi, expected):
    assert classify_regime(growth, cpi) == expected


# ── fed_policy_stance ───────────────────────────────────────────────────────

def test_stance_hawkish_after_hikes():
    today = date(2026, 11, 1)
    rates = [{"date": f"2026-{m:02d}-01", "rate": r}
             for m, r in [(10, 5.5), (9, 5.25), (8, 5.0), (7, 5.0)]]
    rates += [{"date": "2020-01-01", "rate": 0.1}, {"date": "2007-01-01", "rate": 6.5}]
    rows = {r["metric"]: r["value"] for r in compute_stance(rates, today)}

    assert rows["Stance"] == "hawkish"
    assert rows["Fed Funds Rate"] == 5.5
    assert rows["Rate Changes 12M"] == 2
    assert rows["Peak Rate"] == 6.5 and rows["Trough Rate"] == 0.1
    assert (rows["Hike Prob"], rows["Hold Prob"], rows["Cut Prob"]) == (65, 30, 5)
    assert rows["Last Updated"] == "2026-10-01"


def test_stance_needs_data():
    with pytest.raises(ValueError):
        compute_stance([{"date": "2026-10-01", "rate": 4.0}])


# ── inflation_decomposition ─────────────────────────────────────────────────

def test_index_stats_missing_prior_month_gives_no_mom():
    obs = _monthly([110.0, ".", 109.0] + [100.0] * 12)   # 전월 결측
    st = index_stats(obs)
    assert st["current"] == 110.0
    assert st["yoy"] == pytest.approx(10.0)
    assert st["mom"] is None


# 실제 FRED CPIAUCSL — 2025-10 은 셧다운으로 '.'(결측)
_REAL_CPI = [("2026-09", "336.298"), ("2026-08", "334.131"), ("2026-07", "332.813"),
             ("2026-06", "332.568"), ("2026-05", "333.979"), ("2026-04", "332.407"),
             ("2026-03", "330.293"), ("2026-02", "327.460"), ("2026-01", "326.588"),
             ("2025-12", "326.031"), ("2025-11", "325.063"), ("2025-10", "."),
             ("2025-09", "324.245"), ("2025-08", "323.291"), ("2025-07", "322.169")]


def test_yoy_is_date_matched_across_fred_gap():
    obs = [{"date": f"{d}-01", "value": v} for d, v in _REAL_CPI]
    # 위치 기준(결측 제거 후 12칸 뒤)이면 2025-08 대비 4.02% — 13개월 변화로 틀린 값
    assert index_stats(obs)["yoy"] == pytest.approx(336.298 / 324.245 * 100 - 100, abs=0.01)  # 3.72

    cpi = [{"date": f"{d}-01", "value": float(v)} for d, v in _REAL_CPI if v != "."]
    out = compute_regime([{"date": "2026-07-01", "value": 3.4}], [], [], cpi)
    assert out["cmp_cpi_yoy"] == pytest.approx(3.72, abs=0.01)


def test_build_rows_contribution_and_weights():
    assert sum(w for _, _, w in _COMPONENTS) == pytest.approx(100.0)
    obs = {sid: _monthly([105.0] + [100.0] * 12) for _, sid, _ in _COMPONENTS}   # 모두 YoY 5%
    obs[_COMPONENTS[1][1]] = []                                                    # Energy 결측
    rows = build_rows(obs)

    food = rows[0]
    assert food["yoy_change"] == 5.0
    assert food["contribution"] == pytest.approx(food["weight"] * 0.05, abs=0.01)
    assert rows[1]["yoy_change"] is None and rows[1]["contribution"] is None
    assert [r["category"] for r in rows] == [c for c, _, _ in _COMPONENTS]

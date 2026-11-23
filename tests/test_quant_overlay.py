"""포트폴리오 매크로 조건 — 조건이 켜진 달만 보유하고 꺼진 달은 현금.

매크로 지표는 배치(quant/panel.index_rows)가 패널에 '^' 행으로 넣는 모양 그대로 /api/ingest 로 넣는다 (네트워크 없음).
"""
import numpy as np
import pandas as pd
import pytest

from tests.test_quant_strategies import admin, built, loaded  # noqa: F401  (pytest 픽스처)

RULES = {"mode": "all", "rules": [
    {"series": "^TNX", "transform": "chg_3m", "op": "<", "value": 0},
    {"series": "^HG", "transform": "ma12_gap", "op": ">", "value": 0},
]}


def _macro(close):
    """일별 합성 지표 — 금리는 출렁이는 수준(%), 구리는 가격. 패널보다 2년 앞부터."""
    days = pd.bdate_range(close.index[0] - pd.DateOffset(years=2), close.index[-1])
    t = np.arange(len(days))
    tnx = pd.Series(3 + np.sin(t / 90) + 0.3 * np.sin(t / 17), index=days, name="^TNX")
    hg = pd.Series(4 * np.exp(0.15 * np.sin(t / 120) + 0.0001 * t), index=days, name="^HG")
    return [tnx, hg]


@pytest.fixture
def with_macro(loaded, admin, built):  # noqa: F811
    from index_analyzer.quant.panel import index_rows

    client = loaded
    close = built[0]
    series = _macro(close)
    rows = [r for s in series for r in index_rows(s, "sp500")]
    rows = [{**r, "base_ymd": r["base_ymd"].isoformat()} for r in rows]
    r = client.post("/api/ingest/mbs_in_quant_panel", headers=admin, json={"rows": rows})
    assert r.status_code == 200, r.text
    return client, series


def test_macro_ids_match_the_batch():
    from index_analyzer.quant.macro import MACRO_IDS
    from app.backend.services.quant_strategy_service import MACRO_IDS as SERVER

    assert SERVER == MACRO_IDS and all(m.startswith("^") for m in MACRO_IDS)


def _expected_states(series):
    """조건을 따로 계산 — 그 달 말 값까지만 (월말 마지막 값)."""
    tnx, hg = (s.groupby(s.index.to_period("M")).last() for s in series)
    rate_ok = tnx.diff(3) < 0
    copper_ok = (hg / hg.rolling(12).mean() - 1) * 100 > 0
    return rate_ok & copper_ok


def test_overlay_holds_only_when_the_rules_are_on(with_macro):
    client, series = with_macro
    uni = client.get("/api/quant-portfolios/universe").json()
    assert set(uni["metadata"]["macro"]) == {"^TNX", "^HG"}
    syms = [r["symbol"] for r in uni["results"]][:10]

    base = {"name": "반도체 흉내", "weighting": "equal", "rebalance": "Q", "cost_bps": 10,
            "items": [{"symbol": s} for s in syms]}
    plain = client.post("/api/quant-portfolios", json=base).json()["results"][0]
    timed = client.post("/api/quant-portfolios", json={**base, "name": "매크로 조건", "overlay": RULES}).json()["results"][0]
    assert timed["overlay"]["rules"][0]["series"] == "^TNX" and plain["overlay"] is None

    run = client.get("/api/strategies/result", params={"strategy": timed["strategy_id"]}).json()["results"][0]
    m = run["metrics"]
    assert 0 < m["timeInMarket"] < 100 and m["switches"] == len(run["switches"]) >= 2
    assert run["config"]["rules"] == ["미국 10년물 금리 3개월 변화 < 0", "구리 선물 12개월 평균 대비 % > 0"]
    assert run["overlayNow"]["state"] in ("in", "out")

    # 달마다의 보유 여부 = 따로 계산한 조건 (equity 의 exposure 는 그 점에서 시작하는 달의 주식 비중)
    want = _expected_states(series)
    for row in run["equity"][:-1]:
        month = pd.Period(row["date"], "M")
        if month in want.index and not pd.isna(want[month]):
            assert (row["exposure"] > 0) == bool(want[month]), row["date"]
    # 꺼진 달의 수익은 0 (전환 비용만)
    eq = run["equity"]
    for a, b in zip(eq, eq[1:]):
        if a["exposure"] == 0:
            assert b["strategy"] <= a["strategy"] + 1e-9

    # 첫 전환 기록에는 그때의 지표 값이 남는다
    first = run["switches"][0]
    assert set(first["values"]) == {"미국 10년물 금리 3개월 변화 < 0", "구리 선물 12개월 평균 대비 % > 0"}

    full = client.get("/api/strategies/result", params={"strategy": plain["strategy_id"]}).json()["results"][0]
    assert full["metrics"]["timeInMarket"] is None and full["switches"] == []
    assert m["exposure"] < full["metrics"]["exposure"]


@pytest.mark.parametrize("overlay,needle", [
    ({"rules": [{"series": "^NOPE", "transform": "level", "op": ">", "value": 0}]}, "모르는 매크로 지표"),
    ({"rules": [{"series": "^TNX", "transform": "weird", "op": ">", "value": 0}]}, "모르는 변환"),
    ({"rules": [{"series": "^TNX", "transform": "level", "op": "!=", "value": 0}]}, "모르는 비교"),
    ({"mode": "xor", "rules": [{"series": "^TNX"}]}, "all(모두)"),
])
def test_invalid_overlays_are_rejected(loaded, overlay, needle):
    r = loaded.post("/api/quant-portfolios", json={"name": "x", "overlay": overlay})
    assert r.status_code == 400 and needle in r.text


def test_missing_macro_series_explains_how_to_load_it(loaded):
    client = loaded
    uni = client.get("/api/quant-portfolios/universe").json()
    sym = uni["results"][0]["symbol"]
    p = client.post("/api/quant-portfolios", json={
        "name": "VIX 조건", "items": [{"symbol": sym}],
        "overlay": {"rules": [{"series": "^VIX", "transform": "level", "op": "<", "value": 20}]},
    }).json()["results"][0]
    r = client.get("/api/strategies/result", params={"strategy": p["strategy_id"]})
    assert r.status_code == 400 and "--macro-only" in r.text

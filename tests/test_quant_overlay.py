"""전략의 매크로 조건 · 대상 종목 묶음 — 조건이 켜진 달만 보유하고 꺼진 달은 현금.

전략 = 대상 종목(유니버스 전체 또는 내 포트폴리오 묶음) · 점수(팩터 · ML · 대상 전부 보유) · 매크로 조건.
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
LABELS = ["미국 10년물 금리 3개월 변화 < 0", "구리 선물 12개월 평균 대비 % > 0"]


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
    series = _macro(built[0])
    rows = [{**r, "base_ymd": r["base_ymd"].isoformat()} for s in series for r in index_rows(s, "sp500")]
    r = client.post("/api/ingest/mbs_in_quant_panel", headers=admin, json={"rows": rows})
    assert r.status_code == 200, r.text
    return client, series


def _basket(client, n=10, name="반도체 흉내"):
    syms = [r["symbol"] for r in client.get("/api/quant-portfolios/universe").json()["results"]][:n]
    body = {"name": name, "weighting": "equal", "rebalance": "Q", "cost_bps": 10, "items": [{"symbol": s} for s in syms]}
    return client.post("/api/quant-portfolios", json=body).json()["results"][0], syms


def _expected_states(series):
    """조건을 따로 계산 — 그 달 말 값까지만 (월말 마지막 값)."""
    tnx, hg = (s.groupby(s.index.to_period("M")).last() for s in series)
    return (tnx.diff(3) < 0) & ((hg / hg.rolling(12).mean() - 1) * 100 > 0)


def _check_states(run, series):
    want = _expected_states(series)
    for row in run["equity"][:-1]:
        month = pd.Period(row["date"], "M")
        if month in want.index and not pd.isna(want[month]):
            assert (row["exposure"] > 0) == bool(want[month]), row["date"]
    eq = run["equity"]
    for a, b in zip(eq, eq[1:]):          # 꺼진 달의 수익은 0 (전환 비용만)
        if a["exposure"] == 0:
            assert b["strategy"] <= a["strategy"] + 1e-9


def test_macro_ids_match_the_batch():
    from index_analyzer.quant.macro import MACRO_IDS
    from app.backend.services.quant_overlay import MACRO_IDS as SERVER

    assert SERVER == MACRO_IDS and all(m.startswith("^") for m in MACRO_IDS)


def test_hold_whole_basket_matches_the_portfolio_backtest(with_macro):
    """'대상 전부 보유' 전략(조건 없음) = 그 포트폴리오 백테스트 — 옮겨도 숫자가 같다."""
    client, _ = with_macro
    basket, syms = _basket(client)
    s = client.post("/api/strategies", json={"name": "묶음 전부", "score_kind": "none", "rebalance": "Q",
                                              "basket_id": basket["portfolio_id"]})
    assert s.status_code == 200, s.text
    s = s.json()["results"][0]
    assert s["basket"]["name"] == "반도체 흉내" and s["overlay"] is None

    a = client.get("/api/strategies/result", params={"strategy": s["strategy_id"]}).json()["results"][0]
    b = client.get("/api/strategies/result", params={"strategy": basket["strategy_id"]}).json()["results"][0]
    assert a["strategy_id"] == s["strategy_id"] and a["name"] == "묶음 전부"
    assert a["metrics"]["totalReturn"] == pytest.approx(b["metrics"]["totalReturn"])
    assert a["metrics"]["maxDrawdown"] == pytest.approx(b["metrics"]["maxDrawdown"])
    assert {t["symbol"] for t in a["trades"]} == set(syms) and a["config"]["score_kind"] == "none"


def test_basket_strategy_with_macro_rules(with_macro):
    client, series = with_macro
    basket, _ = _basket(client)
    s = client.post("/api/strategies", json={"name": "매크로 조건", "score_kind": "none", "rebalance": "Q",
                                              "basket_id": basket["portfolio_id"], "overlay": RULES}).json()["results"][0]
    assert s["overlay"]["rules"][0]["series"] == "^TNX"

    run = client.get("/api/strategies/result", params={"strategy": s["strategy_id"]}).json()["results"][0]
    m = run["metrics"]
    assert 0 < m["timeInMarket"] < 100 and m["switches"] == len(run["switches"]) >= 2
    assert run["config"]["rules"] == LABELS and run["overlayNow"]["state"] in ("in", "out")
    assert set(run["switches"][0]["values"]) == set(LABELS)
    _check_states(run, series)


def test_factor_strategy_with_macro_rules_goes_to_cash(with_macro):
    """유니버스 전체 팩터 전략에도 조건이 붙는다 — 꺼진 달은 다 팔고 현금."""
    client, series = with_macro
    s = client.post("/api/strategies", json={"name": "추세 + 매크로", "score_kind": "factor", "top_n": 10,
                                              "factors": [{"factor_id": "trend"}], "overlay": RULES}).json()["results"][0]
    run = client.get("/api/strategies/result", params={"strategy": s["strategy_id"]}).json()["results"][0]
    assert 0 < run["metrics"]["timeInMarket"] < 100
    _check_states(run, series)
    # 꺼진 달에는 판 거래가 있고, 들고 있는 종목은 10개 이하
    outs = {sw["date"] for sw in run["switches"] if sw["state"] == "out"}
    assert any(t["exitDate"] in outs for t in run["trades"] if not t["open"])
    assert len(run["holdings"]) <= 10

    # 순위: 이번 달 조건이 꺼져 있으면 매수 표시가 없다
    rank = client.get("/api/quant/ranking", params={"strategy": s["strategy_id"]}).json()
    if run["overlayNow"]["state"] == "out" and rank["metadata"]["as_of"] == run["overlayNow"]["date"]:
        assert not any(r["buy"] for r in rank["results"]) and "현금" in rank["metadata"]["note"]


def test_factor_strategy_limited_to_a_basket(with_macro):
    client, _ = with_macro
    basket, syms = _basket(client, n=12)
    s = client.post("/api/strategies", json={"name": "묶음 안 모멘텀", "score_kind": "factor", "top_n": 5,
                                              "factors": [{"factor_id": "mom_12_1"}],
                                              "basket_id": basket["portfolio_id"]}).json()["results"][0]
    run = client.get("/api/strategies/result", params={"strategy": s["strategy_id"]}).json()["results"][0]
    assert {t["symbol"] for t in run["trades"]} <= set(syms) and len(run["holdings"]) == 5
    rank = client.get("/api/quant/ranking", params={"strategy": s["strategy_id"]}).json()["results"]
    assert {r["symbol"] for r in rank} <= set(syms) and sum(r["buy"] for r in rank) == 5
    # 종목이 30개 미만이면 메인의 팩터 성과는 적재값 그대로 + 안내
    view = client.get("/api/quant/factors", params={"strategy": s["strategy_id"]}).json()
    assert "30개 이상" in view["metadata"].get("note", "") or view["results"] == []

    # 전략이 쓰는 묶음은 지울 수 없다
    r = client.delete(f"/api/quant-portfolios/{basket['portfolio_id']}")
    assert r.status_code == 400 and "묶음 안 모멘텀" in r.text


@pytest.mark.parametrize("body,needle", [
    ({"score_kind": "none"}, "대상 종목 묶음"),
    ({"score_kind": "none", "basket_id": "nope"}, "찾을 수 없어요"),
    ({"score_kind": "factor", "factors": [{"factor_id": "trend"}],
      "overlay": {"rules": [{"series": "^NOPE"}]}}, "모르는 매크로 지표"),
    ({"score_kind": "factor", "factors": [{"factor_id": "trend"}],
      "overlay": {"rules": [{"series": "^TNX", "transform": "weird"}]}}, "모르는 변환"),
    ({"score_kind": "factor", "factors": [{"factor_id": "trend"}],
      "overlay": {"rules": [{"series": "^TNX", "op": "!="}]}}, "모르는 비교"),
    ({"score_kind": "factor", "factors": [{"factor_id": "trend"}],
      "overlay": {"mode": "xor", "rules": [{"series": "^TNX"}]}}, "all(모두)"),
])
def test_invalid_strategies_are_rejected(loaded, body, needle):
    r = loaded.post("/api/strategies", json={"name": "x", **body})
    assert r.status_code == 400 and needle in r.text


def test_missing_macro_series_explains_how_to_load_it(loaded):
    s = loaded.post("/api/strategies", json={
        "name": "VIX 조건", "score_kind": "factor", "factors": [{"factor_id": "trend"}],
        "overlay": {"rules": [{"series": "^VIX", "transform": "level", "op": "<", "value": 20}]},
    }).json()["results"][0]
    r = loaded.get("/api/strategies/result", params={"strategy": s["strategy_id"]})
    assert r.status_code == 400 and "--macro-only" in r.text


def test_portfolios_are_baskets_only(loaded):
    """포트폴리오는 종목 묶음 · 비중만 — 매크로 조건은 받지 않는다."""
    p = loaded.post("/api/quant-portfolios", json={"name": "묶음", "overlay": RULES}).json()["results"][0]
    assert "overlay" not in p

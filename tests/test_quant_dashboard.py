"""퀀트 메인(대시보드) · 포트폴리오 — 고른 전략으로 팩터 표 · 성과 · 순위가 바뀌고, 직접 고른 포트폴리오를 백테스트한다.

패널 · 스냅샷은 배치(build_all)가 합성 가격으로 만들어 /api/ingest 로 넣는다 (네트워크 없음).
"""
import json

import pytest

from tests.test_quant_strategies import admin, built, loaded  # noqa: F401  (pytest 픽스처)


@pytest.fixture
def dashboard(loaded, admin, built):  # noqa: F811
    client = loaded
    _, snapshots, _ = built
    # build_quant.py 와 같은 모양 — 데이터셋마다 한 행
    end = snapshots["factors"]["meta"]["end"]
    rows = [{"universe": "sp500", "dataset": k, "base_ymd": end,
             "payload": json.dumps(v["rows"], ensure_ascii=False), "meta": json.dumps(v["meta"], ensure_ascii=False)}
            for k, v in snapshots.items()]
    r = client.post("/api/ingest/mbs_in_quant_snapshot", headers=admin, json={"rows": rows})
    assert r.status_code == 200, r.text
    return client


def test_factor_table_follows_the_picked_strategy(dashboard):
    client = dashboard
    plain = client.get("/api/quant/factors").json()
    comp = next(r for r in plain["results"] if r["composite"])
    assert "weights" not in plain["metadata"]

    body = client.get("/api/quant/factors", params={"strategy": "builtin-momentum"}).json()
    md = body["metadata"]
    assert md["strategy"] == "모멘텀 단일" and md["weights"] == {"mom_12_1": 100.0}
    singles = {r["id"]: r for r in body["results"] if not r.get("composite")}
    assert singles["mom_12_1"]["weight"] == 100.0 and singles["lowvol"]["weight"] is None
    mine = next(r for r in body["results"] if r.get("composite"))
    assert mine["name"] == "전략 합성" and mine["ic"] != comp["ic"]
    # 한 팩터만 쓰는 전략의 합성 = 그 팩터와 같은 순위 → 같은 IC
    assert mine["ic"] == pytest.approx(singles["mom_12_1"]["ic"], abs=1e-3)

    q = client.get("/api/quant/quantiles", params={"strategy": "builtin-multifactor"}).json()
    assert [r["q"][:2] for r in q["results"]] == ["Q1", "Q2", "Q3", "Q4", "Q5"] and "spread" in q["metadata"]

    curve = client.get("/api/quant/factor_returns", params={"strategy": "builtin-momentum"}).json()
    assert curve["metadata"]["composite_name"] == "전략 합성"
    assert any(r.get("composite") is not None for r in curve["results"])

    # 모르는 전략은 적재값 그대로 (오류가 아니다)
    same = client.get("/api/quant/factors", params={"strategy": "nope"}).json()
    assert same["results"] == plain["results"]


def test_ranking_marks_the_top_n_to_buy(dashboard):
    client = dashboard
    mine = client.post("/api/strategies", json={"name": "저변동", "score_kind": "factor", "top_n": 12,
                                                "factors": [{"factor_id": "lowvol", "weight": 1}]}).json()["results"][0]
    body = client.get("/api/quant/ranking", params={"strategy": mine["strategy_id"]}).json()
    rows, md = body["results"], body["metadata"]
    assert md["top_n"] == 12 and md["strategy"] == "저변동" and md["as_of"]
    assert [r["rank"] for r in rows] == list(range(1, len(rows) + 1)) and len(rows) == 22
    assert sum(r["buy"] for r in rows) == 12 and rows[0]["buy"] and not rows[-1]["buy"]
    assert all(a["score"] >= b["score"] for a, b in zip(rows, rows[1:]))
    # 이번 달은 다음 달 수익률을 아직 모른다
    assert md["latest"] and md["last"] == md["as_of"] and "fwd_buy" not in md
    assert all(r["fwd"] is None for r in rows)


def test_ranking_for_a_past_month_shows_the_next_month(dashboard):
    """기준월을 고르면 그날 이전 마지막 달 점수로 줄 세우고, 실제 다음 달 수익률(매수 평균 · 전체 평균)을 붙인다."""
    client = dashboard
    sid = client.post("/api/strategies", json={"name": "모멘텀", "score_kind": "factor", "top_n": 10,
                                               "factors": [{"factor_id": "mom_12_1", "weight": 1}]}).json()["results"][0]["strategy_id"]
    now = client.get("/api/quant/ranking", params={"strategy": sid, "as_of": ""}).json()["metadata"]
    assert now["latest"]   # 빈 값 = 이번 달

    import pandas as pd
    pick = (pd.Timestamp(now["last"]) - pd.DateOffset(months=12)).date()
    body = client.get("/api/quant/ranking", params={"strategy": sid, "as_of": pick.isoformat()}).json()
    rows, md = body["results"], body["metadata"]
    assert not md["latest"] and md["as_of"] <= pick.isoformat() and md["as_of"] > (pick - pd.DateOffset(months=1)).date().isoformat()
    assert md["first"] <= md["as_of"] < md["last"]
    assert all(r["fwd"] is not None for r in rows)
    buys = [r["fwd"] for r in rows if r["buy"]]
    assert len(buys) == 10 and abs(md["fwd_buy"] - sum(buys) / 10) < 1e-9
    assert md["fwd_all"] is not None

    # 점수가 있기 전 날짜는 안내만 (오류 아님)
    early = client.get("/api/quant/ranking", params={"strategy": sid, "as_of": "1990-01-31"}).json()
    assert early["results"] == [] and "이전에는" in early["metadata"]["note"]
    # 잘못된 날짜는 이번 달로
    bad = client.get("/api/quant/ranking", params={"strategy": sid, "as_of": "nope"}).json()["metadata"]
    assert bad["latest"]


def test_portfolio_lifecycle_and_backtest(dashboard):
    client = dashboard
    uni = client.get("/api/quant-portfolios/universe").json()
    syms = [r["symbol"] for r in uni["results"]]
    assert uni["metadata"]["loaded"] and len(syms) >= 40
    assert all(r["vol"] is None or r["vol"] > 0 for r in uni["results"])

    r = client.post("/api/quant-portfolios", json={
        "name": "직접 고른 다섯", "weighting": "manual", "rebalance": "Y", "cost_bps": 5,
        "items": [{"symbol": s, "weight": 15} for s in syms[:5]],
    })
    assert r.status_code == 200, r.text
    p = r.json()["results"][0]
    assert p["strategy_id"] == f"pf:{p['portfolio_id']}" and len(p["items"]) == 5

    run = client.get("/api/strategies/result", params={"strategy": p["strategy_id"]}).json()["results"][0]
    m = run["metrics"]
    assert run["config"]["kind"] == "portfolio" and run["config"]["cost_bps"] == 5
    assert m["exposure"] == pytest.approx(75.0) and len(run["equity"]) == m["months"] + 1
    assert {t["symbol"] for t in run["trades"]} == set(syms[:5])

    # 비중 합계 100% 초과는 거절
    bad = client.put(f"/api/quant-portfolios/{p['portfolio_id']}", json={
        "name": "x", "weighting": "manual", "items": [{"symbol": s, "weight": 60} for s in syms[:2]],
    })
    assert bad.status_code == 400

    # 동일 비중 + 현금 10% → 노출 90%
    r = client.put(f"/api/quant-portfolios/{p['portfolio_id']}", json={
        "name": "동일 비중", "weighting": "equal", "cash_pct": 10, "rebalance": "M",
        "items": [{"symbol": s} for s in syms[:8]],
    })
    assert r.status_code == 200, r.text
    run = client.get("/api/strategies/result", params={"strategy": p["strategy_id"]}).json()["results"][0]
    assert run["metrics"]["exposure"] == pytest.approx(90.0) and run["name"] == "동일 비중"

    assert [x["portfolio_id"] for x in client.get("/api/quant-portfolios").json()["results"]] == [p["portfolio_id"]]
    assert client.delete(f"/api/quant-portfolios/{p['portfolio_id']}").status_code == 200
    assert client.get("/api/strategies/result", params={"strategy": p["strategy_id"]}).status_code == 404


def test_other_users_portfolio_is_invisible(dashboard, db_session):
    import uuid

    from app.backend.models.orm import UserQuantPortfolio

    other = UserQuantPortfolio(portfolio_id=str(uuid.uuid4()), user_id=str(uuid.uuid4()), name="남의 것")
    db_session.add(other)
    db_session.commit()
    client = dashboard
    assert client.get("/api/strategies/result", params={"strategy": f"pf:{other.portfolio_id}"}).status_code == 404
    assert client.put(f"/api/quant-portfolios/{other.portfolio_id}", json={"name": "x"}).status_code == 404
    assert json.dumps(client.get("/api/quant-portfolios").json()["results"]) == "[]"

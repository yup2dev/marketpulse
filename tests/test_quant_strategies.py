"""포트폴리오 전략 — 웹에서 만든 전략을 서버가 월별 패널로 바로 백테스트한다 (네트워크 없음).

배치(build_all → panel_rows)가 합성 가격으로 패널을 만들고, /api/ingest 로 서버에 넣은 뒤
/api/strategies 로 만들고 · 고치고 · 계산하고 · 지우는 흐름을 본다.
"""
import uuid
from datetime import date

import numpy as np
import pandas as pd
import pytest

from app.backend.core.auth.security import create_access_token
from app.backend.models.orm import User


def _prices(symbols=80, years=7, seed=11):
    rng = np.random.default_rng(seed)
    days = pd.bdate_range("2018-01-01", periods=252 * years)
    drift = rng.normal(0.0004, 0.0006, symbols)
    rets = rng.normal(0, 0.015, (len(days), symbols)) + drift
    close = 100 * np.exp(np.cumsum(rets, axis=0))
    return pd.DataFrame(close, index=days, columns=[f"S{i:03d}" for i in range(symbols)])


@pytest.fixture(scope="module")
def built():
    from index_analyzer.quant import build_all

    close = _prices()
    bench = close.mean(axis=1).rename("^GSPC")
    snapshots, panel = build_all(close, {}, "sp500", bench)
    return close, snapshots, panel


@pytest.fixture
def admin(db_session):
    admin_id = str(uuid.uuid4())
    db_session.add(User(user_id=admin_id, email="admin@example.com", username="admin",
                        hashed_password="x", is_active=True, role="admin"))
    db_session.commit()
    return {"Authorization": f"Bearer {create_access_token({'sub': admin_id})}"}


@pytest.fixture
def loaded(auth_client, admin, built):
    """패널을 ingest 로 넣는다 (sync_db_to_cloud 와 같은 경로)."""
    client, _ = auth_client
    _, _, panel = built
    rows = [{**r, "base_ymd": r["base_ymd"].isoformat()} for r in panel]
    for i in range(0, len(rows), 2000):
        r = client.post("/api/ingest/mbs_in_quant_panel", headers=admin, json={"rows": rows[i:i + 2000]})
        assert r.status_code == 200, r.text
    return client


def test_factor_ids_match_the_batch():
    """서버의 팩터 목록은 배치의 FACTORS 와 같아야 한다 (두 폴더는 서로 import 하지 않는다)."""
    from index_analyzer.quant.factors import FACTORS
    from index_analyzer.quant.panel import PROB_COLS
    from app.backend.services.quant_strategy_service import FACTORS as SERVER_FACTORS, MODEL_IDS

    assert [f[:2] for f in SERVER_FACTORS] == [f[:2] for f in FACTORS]
    assert sorted(MODEL_IDS) == sorted(PROB_COLS)


def test_panel_rows_have_scores_probabilities_and_benchmark(built):
    from index_analyzer.quant.factors import FACTOR_IDS

    _, _, panel = built
    stocks = [r for r in panel if not r["stk_cd"].startswith("^")]
    bench = [r for r in panel if r["stk_cd"] == "^GSPC"]
    assert stocks and bench
    assert set(FACTOR_IDS) | {"p_stack", "p_avg", "fwd_ret", "close"} <= set(stocks[0])
    assert any(r["p_stack"] is not None for r in stocks)            # 표본 밖 구간에만 있다
    assert all(r[f] is None for r in bench for f in FACTOR_IDS)     # 지수 행에는 점수가 없다
    assert all(isinstance(r["base_ymd"], date) for r in panel)


def test_result_is_empty_until_the_panel_is_loaded(auth_client):
    client, _ = auth_client
    body = client.get("/api/strategies/result").json()
    assert body["results"] == [] and body["metadata"]["panel"]["loaded"] is False


def test_builtin_strategies_run_and_cannot_be_edited(loaded):
    client = loaded
    body = client.get("/api/strategies").json()
    ids = [s["strategy_id"] for s in body["results"]]
    assert ids[:3] == ["builtin-ml-stack", "builtin-multifactor", "builtin-momentum"]
    assert body["metadata"]["panel"]["loaded"] is True
    assert {f["id"] for f in body["metadata"]["factors"]} >= {"mom_12_1", "lowvol"}

    for sid in ids[:3]:
        run = client.get("/api/strategies/result", params={"strategy": sid}).json()["results"][0]
        m = run["metrics"]
        assert run["equity"][0]["strategy"] == 1.0 and len(run["equity"]) == m["months"] + 1
        assert m["benchmark"]["name"] == "S&P 500" and m["cagr"] is not None
        assert all(t["returnPct"] is not None for t in run["trades"])

    r = client.put("/api/strategies/builtin-momentum", json={"name": "x", "score_kind": "factor",
                                                             "factors": [{"factor_id": "trend"}]})
    assert r.status_code == 403


def test_my_strategy_lifecycle(loaded):
    client = loaded
    r = client.post("/api/strategies", json={
        "name": "저변동 + 추세", "score_kind": "factor", "top_n": 10, "rebalance": "Q",
        "factors": [{"factor_id": "lowvol", "weight": 2}, {"factor_id": "trend", "weight": 1}],
    })
    assert r.status_code == 200, r.text
    mine = r.json()["results"][0]
    assert mine["editable"] and not mine["builtin"]

    run = client.get("/api/strategies/result", params={
        "strategy": mine["strategy_id"], "benchmark": "equal", "cost": 5, "start": "2020-01-01",
    }).json()["results"][0]
    assert run["config"]["rebalance"] == "Q" and run["config"]["cost_bps"] == 5
    assert run["metrics"]["start"] >= "2020-01-01" and run["metrics"]["benchmark"]["name"] == "동일 비중"
    assert len(run["holdings"]) == 10

    # 비용을 올리면 수익이 줄어든다
    cheap = client.get("/api/strategies/result", params={"strategy": mine["strategy_id"], "cost": 0}).json()
    dear = client.get("/api/strategies/result", params={"strategy": mine["strategy_id"], "cost": 50}).json()
    assert cheap["results"][0]["metrics"]["totalReturn"] > dear["results"][0]["metrics"]["totalReturn"]

    r = client.put(f"/api/strategies/{mine['strategy_id']}", json={
        "name": "ML 평균", "score_kind": "ml", "model": "avg", "top_n": 15, "rebalance": "M",
    })
    assert r.status_code == 200 and r.json()["results"][0]["factors"] == []

    assert client.delete(f"/api/strategies/{mine['strategy_id']}").status_code == 200
    assert client.get("/api/strategies/result", params={"strategy": mine["strategy_id"]}).status_code == 404


def test_compare_runs_every_strategy_under_the_same_conditions(loaded):
    client = loaded
    mine = client.post("/api/strategies", json={"name": "추세만", "score_kind": "factor",
                                                "factors": [{"factor_id": "trend"}]}).json()["results"][0]
    body = client.get("/api/strategies/compare", params={"cost": 25, "benchmark": "equal"}).json()
    rows = body["results"]
    ids = [r["strategy_id"] for r in rows]
    assert ids[:3] == ["builtin-ml-stack", "builtin-multifactor", "builtin-momentum"] and mine["strategy_id"] in ids
    for r in rows:
        assert r["equity"][0]["strategy"] == 1.0 and "trades" not in r
        assert r["metrics"]["benchmark"]["name"] == "동일 비중"
    # 같은 조건의 단건 실행과 값이 같다
    one = client.get("/api/strategies/result", params={"strategy": mine["strategy_id"], "cost": 25,
                                                      "benchmark": "equal"}).json()["results"][0]
    got = next(r for r in rows if r["strategy_id"] == mine["strategy_id"])
    assert got["metrics"]["totalReturn"] == one["metrics"]["totalReturn"]


def test_compare_is_empty_until_the_panel_is_loaded(auth_client):
    client, _ = auth_client
    body = client.get("/api/strategies/compare").json()
    assert body["results"] == [] and body["metadata"]["panel"]["loaded"] is False


@pytest.mark.parametrize("body, needle", [
    ({"name": "x", "score_kind": "factor", "factors": []}, "팩터"),
    ({"name": "x", "score_kind": "factor", "factors": [{"factor_id": "nope"}]}, "모르는 팩터"),
    ({"name": "x", "score_kind": "ml", "model": "lstm"}, "모르는 모델"),
    ({"name": "x", "score_kind": "factor", "factors": [{"factor_id": "trend"}], "top_n": 1}, "보유 종목 수"),
])
def test_invalid_strategies_are_rejected(auth_client, body, needle):
    client, _ = auth_client
    r = client.post("/api/strategies", json=body)
    assert r.status_code == 400 and needle in r.json()["detail"]


def test_other_users_strategy_is_invisible(loaded, db_session):
    client = loaded
    sid = client.post("/api/strategies", json={"name": "mine", "score_kind": "factor",
                                               "factors": [{"factor_id": "trend"}]}).json()["results"][0]["strategy_id"]
    other = str(uuid.uuid4())
    db_session.add(User(user_id=other, email="o@example.com", username="o", hashed_password="x",
                        is_active=True, role="user"))
    db_session.commit()
    headers = {"Authorization": f"Bearer {create_access_token({'sub': other})}"}
    assert client.get("/api/strategies/result", params={"strategy": sid}, headers=headers).status_code == 404
    assert sid not in [s["strategy_id"] for s in client.get("/api/strategies", headers=headers).json()["results"]]


def test_concurrent_requests_read_the_panel_once(monkeypatch):
    """백테스트 화면은 요청을 한꺼번에 보낸다 — 캐시가 비어 있어도 패널은 한 번만 읽어야 한다
    (스레드마다 따로 읽으면 작은 운영 서버가 메모리 부족으로 멈춘다, 2026-11-22 장애)."""
    import threading
    import time

    from app.backend.services import quant_strategy_service as svc

    reads = []

    def slow_read(db, universe, version):
        reads.append(universe)
        time.sleep(0.2)                       # 읽는 동안 다른 요청이 들어온다
        return {"version": version}

    monkeypatch.setattr(svc, "_panel_version", lambda db, u: (100, "t", None))
    monkeypatch.setattr(svc, "_read_panel", slow_read)
    monkeypatch.setattr(svc, "_PANEL_CACHE", {})

    got = []
    threads = [threading.Thread(target=lambda: got.append(svc.load_panel(None, "sp500"))) for _ in range(7)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()

    assert reads == ["sp500"]
    assert len(got) == 7 and all(g is got[0] for g in got)

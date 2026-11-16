"""퀀트 배치 산출물 — 합성 가격으로 계산 규칙을 확인한다 (네트워크 없음).

배치가 계산해 적재하고(mbs_in_quant_snapshot) 서버는 읽기만 한다 (/api/quant/{dataset}).
"""
import json
import uuid
from datetime import date

import numpy as np
import pandas as pd
import pytest

from app.backend.core.auth.security import create_access_token
from app.backend.models.orm import User


@pytest.fixture
def admin(auth_client, db_session):
    """관리자 계정의 Authorization 헤더 — /api/ingest 는 관리자만 쓴다."""
    admin_id = str(uuid.uuid4())
    db_session.add(User(user_id=admin_id, email="admin@example.com", username="admin",
                        hashed_password="x", is_active=True, role="admin"))
    db_session.commit()
    return {"Authorization": f"Bearer {create_access_token({'sub': admin_id})}"}


def _prices(symbols=80, years=7, seed=7):
    """모멘텀이 있는 합성 가격 — 종목마다 다른 추세(drift) + 잡음."""
    rng = np.random.default_rng(seed)
    days = pd.bdate_range("2019-01-01", periods=252 * years)
    drift = rng.normal(0.0004, 0.0006, symbols)
    rets = rng.normal(0, 0.015, (len(days), symbols)) + drift
    close = 100 * np.exp(np.cumsum(rets, axis=0))
    return pd.DataFrame(close, index=days, columns=[f"S{i:03d}" for i in range(symbols)])


@pytest.fixture(scope="module")
def snapshots():
    from index_analyzer.quant import build_snapshots

    close = _prices()
    return close, build_snapshots(close, {"S000": {"name": "Zero Corp", "sector": "Tech"}})


def test_factor_scores_use_only_past_prices():
    """t 월말의 팩터 점수는 그 뒤의 가격을 바꿔도 달라지지 않는다 (look-ahead 없음)."""
    from index_analyzer.quant.factors import FACTOR_IDS, build_factors

    close = _prices(symbols=40, years=3)
    cut = close.index[400]
    changed = close.copy()
    changed.loc[changed.index > cut] *= 1.5
    a, b = build_factors(close), build_factors(changed)
    past = [d for d in a["mom_12_1"].index if d <= cut][:-1]
    for fid in FACTOR_IDS:
        pd.testing.assert_frame_equal(a[fid].loc[past], b[fid].loc[past])
    # 맞추려는 값은 다음 달 수익률이다
    month_close = close.loc[a["ret"].index]
    assert a["fwd"].iloc[5, 0] == pytest.approx(month_close.iloc[6, 0] / month_close.iloc[5, 0] - 1)


def test_hmm_orders_states_by_mean_and_recovers_regimes():
    from index_analyzer.quant.regime import fit_hmm

    rng = np.random.default_rng(0)
    x = np.concatenate([rng.normal(-0.05, 0.01, 60), rng.normal(0.0, 0.01, 60), rng.normal(0.05, 0.01, 60)])
    hmm = fit_hmm(x)
    assert list(hmm["mean"]) == sorted(hmm["mean"])
    state = hmm["gamma"].argmax(axis=1)
    assert (state[:60] == 0).mean() > 0.9 and (state[60:120] == 1).mean() > 0.9 and (state[120:] == 2).mean() > 0.9
    assert np.allclose(hmm["trans"].sum(axis=1), 1) and np.allclose(hmm["gamma"].sum(axis=1), 1)


def test_snapshots_have_the_rows_each_widget_draws(snapshots):
    from index_analyzer.quant import DATASETS
    from index_analyzer.quant.factors import FACTOR_IDS

    close, snaps = snapshots
    assert list(snaps) == DATASETS
    json.dumps(snaps)   # NaN · numpy 값 없이 JSON 으로 나간다

    factors = snaps["factors"]["rows"]
    assert [f["id"] for f in factors] == FACTOR_IDS + ["composite"] and factors[-1]["composite"] is True
    assert all(-1 <= f["ic"] <= 1 and f["months"] > 40 for f in factors)

    curves = snaps["factor_returns"]["rows"]
    assert len(curves) <= 60 and set(curves[0]) == {"date", *FACTOR_IDS, "composite"}
    assert [r["q"] for r in snaps["quantiles"]["rows"]] == ["Q1 하위", "Q2", "Q3", "Q4", "Q5 상위"]

    models = {m["id"]: m for m in snaps["models"]["rows"]}
    assert set(models) == {"gbt", "mlp", "logit", "avg", "stack"}
    assert sum(models[m]["weight"] for m in ("gbt", "mlp", "logit")) == pytest.approx(100, abs=0.01)
    assert all(0 <= m["auc"] <= 1 and 0 <= m["accuracy"] <= 100 for m in models.values())
    # 워크포워드: 첫 36개월은 학습에만 쓰고, 그 뒤 달은 모두 표본 밖에서 예측한다
    meta = snaps["models"]["meta"]
    assert meta["oos_months"] == meta["train_months"] - 36

    signals = snaps["signals"]["rows"]
    assert len(signals) == close.shape[1] and signals[0]["name"] == "Zero Corp"
    assert all(0 <= s[k] <= 1 for s in signals for k in ("gbt", "mlp", "logit", "avg", "stack"))
    # 시그널은 마지막 거래일의 것이다
    assert snaps["signals"]["meta"]["signal_date"] == close.index[-1].strftime("%Y-%m-%d")

    regimes = snaps["regimes"]["rows"]
    assert {r["state"] for r in regimes} <= {"bear", "side", "bull"} and snaps["regimes"]["meta"]["current"] == regimes[-1]["state"]


def test_quant_api_serves_the_loaded_snapshot(auth_client, db_session):
    """서버는 적재된 행을 읽어 그대로 내보낸다 — 적재 전에는 빈 결과(오류 아님)."""
    from app.backend.models.orm import MBS_IN_QUANT_SNAPSHOT

    client, _ = auth_client
    body = client.get("/api/quant/factors").json()
    assert body["results"] == [] and body["metadata"]["loaded"] is False

    db_session.add(MBS_IN_QUANT_SNAPSHOT(
        universe="sp500", dataset="factors", base_ymd=date(2026, 10, 30),
        payload=json.dumps([{"id": "mom_12_1", "ic": 0.04}]), meta=json.dumps({"members": 500}),
    ))
    db_session.commit()
    body = client.get("/api/quant/factors").json()
    assert body["provider"] == "db" and body["results"] == [{"id": "mom_12_1", "ic": 0.04}]
    assert body["metadata"] == {"members": 500, "universe": "sp500", "as_of": "2026-10-30", "loaded": True}
    assert client.get("/api/quant/unknown").status_code == 422


def test_quant_snapshot_goes_through_ingest(auth_client, db_session, admin):
    """배치 → /api/ingest: (universe, dataset) 가 같으면 덮어쓴다."""
    from app.backend.models.orm import MBS_IN_QUANT_SNAPSHOT

    client, _ = auth_client
    for payload in ("[1]", "[2]"):
        r = client.post("/api/ingest/mbs_in_quant_snapshot", headers=admin, json={"rows": [
            {"universe": "sp500", "dataset": "signals", "base_ymd": "2026-10-30", "payload": payload, "meta": "{}"},
        ]})
        assert r.status_code == 200, r.text
    rows = db_session.query(MBS_IN_QUANT_SNAPSHOT).all()
    assert len(rows) == 1 and rows[0].payload == "[2]"

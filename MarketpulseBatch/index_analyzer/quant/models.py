"""예측 모델 — '다음 달 수익률이 그 달 종목들의 중앙값을 넘는가' 를 맞춘다 (워크포워드).

    gbt     그래디언트 부스팅 트리 (xgboost 가 깔려 있으면 XGBoost, 아니면 scikit-learn)
    mlp     신경망 — 최근 12개월 수익률 시퀀스 + 팩터 점수
    logit   로지스틱 회귀 — 팩터 점수만 쓰는 선형 기준선

검증은 워크포워드다: 12개월 묶음마다 그 앞의 달만으로 학습해 그 묶음을 예측한다. 성과 지표는 전부 이 표본 밖 예측으로 낸다.
융합: avg = 세 확률의 평균, stack = 앞 묶음들의 표본 밖 예측으로 맞춘 로지스틱 회귀(메타 모델).
LSTM · GRU 는 없다 — 배치 환경에 딥러닝 프레임워크가 없어서다. 여기에 모델을 더하면 화면에 그대로 나온다.
"""
from __future__ import annotations

import logging
from typing import Dict, List

import numpy as np
import pandas as pd
from sklearn.ensemble import HistGradientBoostingClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import roc_auc_score
from sklearn.neural_network import MLPClassifier

from .evaluate import long_short, sharpe
from .factors import FACTOR_IDS, zscore

log = logging.getLogger(__name__)

SEQ = 12                                  # 시퀀스 길이 (개월)
SEQ_COLS = [f"r{k}" for k in range(SEQ)]  # r0 = 이번 달, r1 = 지난달 …
MIN_TRAIN = 36                            # 첫 학습에 필요한 달 수
BLOCK = 12                                # 한 번 학습으로 예측하는 달 수
FUSIONS = ["avg", "stack"]


def _gbt():
    try:
        from xgboost import XGBClassifier
        return "XGBoost", XGBClassifier(
            n_estimators=200, max_depth=3, learning_rate=0.05, subsample=0.8, random_state=0, verbosity=0,
        )
    except ImportError:
        return "Gradient Boosting", HistGradientBoostingClassifier(
            max_depth=3, max_iter=150, learning_rate=0.05, random_state=0,
        )


def model_specs() -> List[dict]:
    gbt_name, gbt = _gbt()
    return [
        {"id": "gbt", "name": gbt_name, "kind": "그래디언트 부스팅 트리 · 팩터 + 시퀀스",
         "cols": FACTOR_IDS + SEQ_COLS, "model": gbt},
        {"id": "mlp", "name": "MLP", "kind": f"신경망 · {SEQ}개월 수익률 시퀀스 + 팩터",
         "cols": FACTOR_IDS + SEQ_COLS,
         "model": MLPClassifier(hidden_layer_sizes=(32, 16), alpha=1e-3, early_stopping=True, max_iter=200, random_state=0)},
        {"id": "logit", "name": "로지스틱 회귀", "kind": "선형 기준선 · 팩터 점수",
         "cols": FACTOR_IDS, "model": LogisticRegression(C=1.0, max_iter=500)},
    ]


def build_panel(scores: Dict[str, pd.DataFrame]) -> pd.DataFrame:
    """(월말, 종목) 한 줄 — 팩터 점수 · 수익률 시퀀스 · 다음 달 수익률(fwd) · 정답(y). 빈 값은 0(= 평균)."""
    zret = zscore(scores["ret"])
    cols = {f: scores[f].stack(future_stack=True) for f in FACTOR_IDS}
    for k, name in enumerate(SEQ_COLS):
        cols[name] = zret.shift(k).stack(future_stack=True)
    panel = pd.DataFrame(cols)
    panel["fwd"] = scores["fwd"].stack(future_stack=True)
    panel.index.names = ["date", "symbol"]
    panel = panel[panel[FACTOR_IDS].notna().sum(axis=1) >= len(FACTOR_IDS) / 2].copy()
    features = FACTOR_IDS + SEQ_COLS
    panel[features] = panel[features].fillna(0.0)
    median = panel.groupby(level="date")["fwd"].transform("median")
    panel["y"] = np.where(panel["fwd"].notna(), (panel["fwd"] > median).astype(float), np.nan)
    return panel


def _meta_fit(preds: pd.DataFrame, y: pd.Series, ids: List[str]):
    meta = LogisticRegression(C=1.0, max_iter=500)
    meta.fit(preds[ids].to_numpy(), y.to_numpy())
    return meta


def _weights(meta, ids: List[str]) -> Dict[str, float]:
    """메타 모델 계수 → 비중 (음수는 0, 합 1). 전부 0 이하면 같은 비중."""
    coef = np.clip(meta.coef_[0], 0, None)
    if coef.sum() <= 0:
        return {i: 1 / len(ids) for i in ids}
    return {i: float(c / coef.sum()) for i, c in zip(ids, coef)}


def run_models(scores: Dict[str, pd.DataFrame]) -> dict:
    """워크포워드 검증 + 마지막 달 예측.

    돌려주는 값: { models: [{ id, name, kind, accuracy, auc, sharpe, weight }], fusions: { avg, stack: 지표 },
                  latest: DataFrame(종목 × [모델 · avg · stack]), oos: DataFrame((월말, 종목) × 같은 열 — 표본 밖 확률),
                  oos_months, train_months }
    """
    specs = model_specs()
    ids = [s["id"] for s in specs]
    panel = build_panel(scores)
    labelled = panel[panel["y"].notna()]
    months = labelled.index.get_level_values("date").unique().sort_values()
    if len(months) < MIN_TRAIN + BLOCK:
        raise ValueError(f"학습할 달이 모자랍니다 ({len(months)}개월 — 최소 {MIN_TRAIN + BLOCK}개월)")
    date_of = labelled.index.get_level_values("date")

    blocks = []
    for start in range(MIN_TRAIN, len(months), BLOCK):
        test_months = months[start:start + BLOCK]
        train = labelled[date_of < test_months[0]]
        test = labelled[date_of.isin(test_months)]
        out = pd.DataFrame(index=test.index)
        for s in specs:
            s["model"].fit(train[s["cols"]].to_numpy(), train["y"].to_numpy())
            out[s["id"]] = s["model"].predict_proba(test[s["cols"]].to_numpy())[:, 1]
        out["avg"] = out[ids].mean(axis=1)
        if blocks:   # 메타 모델은 앞 묶음들의 표본 밖 예측으로만 맞춘다
            seen = pd.concat(blocks)
            out["stack"] = _meta_fit(seen, labelled.loc[seen.index, "y"], ids).predict_proba(out[ids].to_numpy())[:, 1]
        else:
            out["stack"] = out["avg"]
        blocks.append(out)
        log.info("워크포워드 %s ~ %s (학습 %d행)", test_months[0].date(), test_months[-1].date(), len(train))

    oos = pd.concat(blocks)
    y = labelled.loc[oos.index, "y"]
    fwd = labelled.loc[oos.index, "fwd"].unstack("symbol")

    def metrics(col: str) -> dict:
        p = oos[col]
        return {
            "accuracy": float(((p > 0.5) == (y > 0.5)).mean() * 100),
            "auc": float(roc_auc_score(y, p)),
            "sharpe": sharpe(long_short(p.unstack("symbol"), fwd)),
        }

    meta = _meta_fit(oos, y, ids)
    weights = _weights(meta, ids)

    # 마지막 달(정답이 아직 없는 달) — 정답이 있는 모든 달로 다시 학습해 예측한다
    last = panel.index.get_level_values("date").max()
    now = panel.xs(last, level="date")
    latest = pd.DataFrame(index=now.index)
    for s in specs:
        s["model"].fit(labelled[s["cols"]].to_numpy(), labelled["y"].to_numpy())
        latest[s["id"]] = s["model"].predict_proba(now[s["cols"]].to_numpy())[:, 1]
    latest["avg"] = latest[ids].mean(axis=1)
    latest["stack"] = meta.predict_proba(latest[ids].to_numpy())[:, 1]

    return {
        "models": [
            {"id": s["id"], "name": s["name"], "kind": s["kind"], **metrics(s["id"]), "weight": weights[s["id"]] * 100}
            for s in specs
        ],
        "fusions": {f: metrics(f) for f in FUSIONS},
        "latest": latest,
        "oos": oos,
        "as_of": last,
        "oos_months": int(oos.index.get_level_values("date").nunique()),
        "train_months": int(len(months)),
    }

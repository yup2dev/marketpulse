"""일별 종가 → 화면이 그릴 산출물. dataset 마다 { rows: [...], meta: {...} }.

    factors          팩터 한 줄씩 — IC · ICIR · 적중률 · 연 롱숏 (+ 합성)
    factor_returns   최근 CHART_MONTHS 개월의 롱숏 누적 수익(%) — 팩터마다 한 열
    quantiles        합성 점수 5분위의 연환산 수익률
    models           예측 모델 · 융합의 표본 밖 지표
    regimes          최근 CHART_MONTHS 개월의 시장 국면
    signals          마지막 달의 종목별 확률 (모델 · avg · stack)
"""
from __future__ import annotations

import logging
from typing import Dict, List, Optional, Tuple

import numpy as np
import pandas as pd

from .evaluate import annualized, cumulative, long_short, monthly_ic, quantile_returns, sharpe
from .factors import FACTORS, FACTOR_IDS, build_factors, composite
from .models import run_models
from .panel import panel_rows
from .regime import STATES, fit_hmm

log = logging.getLogger(__name__)

DATASETS = ["factors", "factor_returns", "quantiles", "models", "regimes", "signals"]
CHART_MONTHS = 60
MIN_HISTORY_DAYS = 300   # 이보다 짧은 종목은 뺀다


def _num(v, digits: int = 4) -> Optional[float]:
    """JSON 에 넣을 수 — NaN · inf 는 None."""
    if v is None or not np.isfinite(v):
        return None
    return round(float(v), digits)


def _day(ts) -> str:
    return pd.Timestamp(ts).strftime("%Y-%m-%d")


def build_snapshots(close: pd.DataFrame, names: Optional[Dict[str, dict]] = None) -> Dict[str, dict]:
    """close: 일별 수정 종가(날짜 × 종목). names: { 종목: { name, sector } }."""
    return build_all(close, names)[0]


def build_all(close: pd.DataFrame, names: Optional[Dict[str, dict]] = None, universe: str = "sp500",
              benchmark: Optional[pd.Series] = None) -> Tuple[Dict[str, dict], List[dict]]:
    """(화면 산출물 dataset → rows · meta, 월별 패널 행). 패널은 웹의 포트폴리오 전략 백테스트 재료."""
    names = names or {}
    close = close.sort_index().dropna(axis=1, thresh=MIN_HISTORY_DAYS)
    scores = build_factors(close)
    fwd = scores["fwd"]
    # 마지막 줄이 아직 끝나지 않은 달이면, 그 앞 달의 '다음 달 수익률'은 한 달치가 아니다 — 정답에서 뺀다
    last_day = close.index[-1]
    if pd.offsets.BMonthEnd().rollforward(last_day) != last_day and len(fwd) > 1:
        fwd.iloc[-2] = np.nan
    scores["composite"] = composite(scores)
    as_of = _day(last_day)

    # ── 팩터 성과 ──
    recent = fwd.index[fwd.notna().sum(axis=1) > 0][-CHART_MONTHS:]
    factor_rows, curves = [], {}
    labels = FACTORS + [("composite", "합성", f"{len(FACTOR_IDS)}개 팩터 동일 비중")]
    for fid, name, desc in labels:
        ic = monthly_ic(scores[fid], fwd)
        ls = long_short(scores[fid], fwd)
        factor_rows.append({
            "id": fid, "name": name, "desc": desc, "composite": fid == "composite",
            "ic": _num(ic.mean()),
            "icir": _num(ic.mean() / ic.std() * np.sqrt(12) if ic.std() else np.nan, 2),
            "hit": _num((ic > 0).mean() * 100, 1),
            "ls_ann": _num(annualized(ls), 2),
            "ls_sharpe": _num(sharpe(ls), 2),
            "months": int(len(ic)),
        })
        curves[fid] = ls.reindex(recent)
    curve_rows = [{"date": _day(d)} for d in recent]
    for fid, ls in curves.items():
        for row, v in zip(curve_rows, cumulative(ls)):
            row[fid] = _num(v, 2)

    q = quantile_returns(scores["composite"], fwd)
    quant_rows = [
        {"q": f"Q{k + 1}" + (" 하위" if k == 0 else " 상위" if k == len(q.columns) - 1 else ""), "value": _num(annualized(q[c]), 2)}
        for k, c in enumerate(sorted(q.columns))
    ]
    spread = (quant_rows[-1]["value"] or 0) - (quant_rows[0]["value"] or 0) if quant_rows else None

    universe_meta = {
        "members": int(close.shape[1]),
        "start": _day(fwd.index[0]), "end": as_of,
        "note": "현재 구성종목 기준(생존 편향) · 거래비용 없음 · 가격 팩터만",
    }

    # ── 예측 모델 · 융합 ──
    ml = run_models(scores)
    model_rows = [{**m, **{k: _num(m[k], 3) for k in ("accuracy", "auc", "sharpe", "weight")}} for m in ml["models"]]
    fusion_names = {"avg": ("단순 평균", "세 모델 확률의 평균"), "stack": ("스태킹", "표본 밖 예측으로 맞춘 로지스틱 메타 모델")}
    for fid, m in ml["fusions"].items():
        model_rows.append({
            "id": fid, "name": fusion_names[fid][0], "kind": fusion_names[fid][1], "fusion": True,
            **{k: _num(v, 3) for k, v in m.items()}, "weight": None,
        })

    latest = ml["latest"]
    signal_rows = [
        {
            "symbol": sym, "name": names.get(sym, {}).get("name") or sym, "sector": names.get(sym, {}).get("sector"),
            **{c: _num(latest.at[sym, c]) for c in latest.columns},
        }
        for sym in latest.index
    ]

    # ── 시장 국면 ──
    market = scores["ret"].mean(axis=1).dropna()
    hmm = fit_hmm(market.to_numpy())
    state = hmm["gamma"].argmax(axis=1)
    regime_rows = [
        {"date": _day(d), "state": STATES[s], "p": _num(p, 3), "ret": _num(r * 100, 2)}
        for d, s, p, r in zip(market.index, state, hmm["gamma"].max(axis=1), market.to_numpy())
    ][-CHART_MONTHS:]
    now = int(state[-1])
    regime_meta = {
        "current": STATES[now],
        "probability": _num(hmm["gamma"][-1, now], 3),
        "persistence": _num(hmm["trans"][now, now], 3),
        "means": [_num(m * 100, 2) for m in hmm["mean"]],
        "note": "유니버스 동일 비중 월 수익률 · 가우시안 HMM(상태 3개) · 전체 구간 추정",
    }

    ml_meta = {
        "signal_date": _day(ml["as_of"]), "oos_months": ml["oos_months"], "train_months": ml["train_months"],
        "target": "다음 달 수익률 > 그 달 종목 중앙값",
        "note": "워크포워드(12개월 묶음) 표본 밖 지표",
    }
    log.info("퀀트 산출 완료 — 종목 %d, 팩터 %d, 표본 밖 %d개월", close.shape[1], len(FACTOR_IDS), ml["oos_months"])
    snapshots = {
        "factors": {"rows": factor_rows, "meta": universe_meta},
        "factor_returns": {"rows": curve_rows, "meta": universe_meta},
        "quantiles": {"rows": quant_rows, "meta": {**universe_meta, "spread": _num(spread, 2)}},
        "models": {"rows": model_rows, "meta": {**ml_meta, **{f"regime_{k}": v for k, v in regime_meta.items() if k != "means"}}},
        "regimes": {"rows": regime_rows, "meta": regime_meta},
        "signals": {"rows": signal_rows, "meta": ml_meta},
    }
    return snapshots, panel_rows(close, scores, ml["oos"], universe, benchmark)

"""월별 패널 — (월말, 종목) 한 줄: 종가 · 다음 달 수익률 · 팩터 z-점수 · 표본 밖 ML 확률.

웹에서 사용자가 만든 포트폴리오 전략(팩터 가중치 · 모델 · 상위 N · 리밸런싱)을 서버가 학습 없이 바로
백테스트할 수 있게 적재한다 (mbs_in_quant_panel). 서버는 이 값을 더하고 줄 세우기만 한다.
"""
from __future__ import annotations

from typing import Dict, List, Optional

import numpy as np
import pandas as pd

from .factors import FACTOR_IDS, month_end

PROB_COLS = ["gbt", "mlp", "logit", "avg", "stack"]   # models.run_models 의 oos 열


def _clean(frame: pd.DataFrame) -> List[dict]:
    """NaN · inf → None, 소수 6자리."""
    frame = frame.replace([np.inf, -np.inf], np.nan).round(6)
    return [{k: (None if isinstance(v, float) and np.isnan(v) else v) for k, v in r.items()}
            for r in frame.to_dict("records")]


def index_rows(series: pd.Series, universe: str, start=None, months=None) -> List[dict]:
    """지수 · 매크로 지표 하나 → 월말 '^' 행 (close = 월말 값, fwd_ret = 다음 달 변화율, 팩터 · 확률은 비움).
    months: 종목 쪽에서 정답(다음 달 수익률)이 있는 달 — 그 밖의 달은 fwd_ret 를 지워 같은 달끼리 견준다."""
    b = month_end(series.dropna().sort_index().to_frame()).iloc[:, 0]
    if start is not None:
        b = b[b.index >= start]
    frame = pd.DataFrame({"close": b, "fwd_ret": b.pct_change(fill_method=None).shift(-1)})
    if months is not None:
        frame.loc[[d.to_period("M") not in months for d in frame.index], "fwd_ret"] = np.nan
    for col in FACTOR_IDS + [f"p_{c}" for c in PROB_COLS]:
        frame[col] = np.nan
    frame["base_ymd"] = [pd.Timestamp(d).date() for d in frame.index]
    frame["stk_cd"] = str(series.name)
    frame["universe"] = universe
    return _clean(frame.reset_index(drop=True))


def panel_rows(close: pd.DataFrame, scores: Dict[str, pd.DataFrame], oos: Optional[pd.DataFrame],
               universe: str, benchmark: Optional[pd.Series] = None,
               extra: Optional[List[pd.Series]] = None) -> List[dict]:
    """close: 일별 수정 종가. scores: factors.build_factors 결과. oos: run_models 의 표본 밖 확률((월말, 종목) × 열).
    benchmark: 지수의 일별 종가 (이름 = 지수 코드, 예: '^GSPC'). extra: 매크로 지표 일별 값 (이름 = 패널 코드, macro.py)."""
    fwd = scores["fwd"]
    m_close = month_end(close.sort_index()).reindex(index=fwd.index, columns=fwd.columns)
    cols = {"close": m_close, "fwd_ret": fwd, **{f: scores[f] for f in FACTOR_IDS}}
    frame = pd.DataFrame({k: v.stack(future_stack=True) for k, v in cols.items()})
    frame.index.names = ["date", "symbol"]
    frame = frame[frame[FACTOR_IDS].notna().any(axis=1)]   # 점수가 하나도 없는 줄은 뺀다
    for c in PROB_COLS:
        frame[f"p_{c}"] = oos[c].reindex(frame.index) if oos is not None and c in oos else np.nan
    frame = frame.reset_index()
    frame["base_ymd"] = pd.to_datetime(frame.pop("date")).dt.date
    frame["stk_cd"] = frame.pop("symbol")
    frame["universe"] = universe
    rows = _clean(frame)

    ok = set(fwd.index[fwd.notna().any(axis=1)].to_period("M"))
    if benchmark is not None and len(benchmark.dropna()):
        rows += index_rows(benchmark, universe, start=fwd.index[0], months=ok)
    # 매크로 지표는 패널 첫 달보다 15개월 앞부터 — 12개월 평균 같은 조건을 첫 달부터 계산할 수 있게
    for series in extra or []:
        if series is not None and len(series.dropna()):
            rows += index_rows(series, universe, start=fwd.index[0] - pd.DateOffset(months=15), months=ok)
    return rows

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


def panel_rows(close: pd.DataFrame, scores: Dict[str, pd.DataFrame], oos: Optional[pd.DataFrame],
               universe: str, benchmark: Optional[pd.Series] = None) -> List[dict]:
    """close: 일별 수정 종가. scores: factors.build_factors 결과. oos: run_models 의 표본 밖 확률((월말, 종목) × 열).
    benchmark: 지수의 일별 종가 (이름 = 지수 코드, 예: '^GSPC')."""
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

    if benchmark is not None and len(benchmark.dropna()):
        b = month_end(benchmark.dropna().sort_index().to_frame()).iloc[:, 0]
        b = b[b.index >= fwd.index[0]]
        bench = pd.DataFrame({"close": b, "fwd_ret": b.pct_change(fill_method=None).shift(-1)})
        # 종목 쪽에서 정답을 지운 달(끝나지 않은 달 직전 등)은 지수도 지운다 — 같은 달끼리 견준다
        ok = set(fwd.index[fwd.notna().any(axis=1)].to_period("M"))
        bench.loc[[d.to_period("M") not in ok for d in bench.index], "fwd_ret"] = np.nan
        for col in FACTOR_IDS + [f"p_{c}" for c in PROB_COLS]:
            bench[col] = np.nan
        bench["base_ymd"] = [pd.Timestamp(d).date() for d in bench.index]
        bench["stk_cd"] = str(benchmark.name)
        bench["universe"] = universe
        rows += _clean(bench.reset_index(drop=True))
    return rows

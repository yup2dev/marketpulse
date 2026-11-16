"""팩터 · 예측 점수의 성과 — 달마다 점수로 줄을 세워 다음 달 수익률과 견준다."""
from __future__ import annotations

from typing import List

import numpy as np
import pandas as pd

MIN_NAMES = 30


def monthly_ic(score: pd.DataFrame, fwd: pd.DataFrame) -> pd.Series:
    """달마다 점수와 다음 달 수익률의 순위 상관(Spearman). 종목이 모자란 달은 뺀다."""
    out = {}
    for date in score.index:
        s, f = score.loc[date], fwd.loc[date]
        ok = s.notna() & f.notna()
        if ok.sum() >= MIN_NAMES:
            out[date] = s[ok].rank().corr(f[ok].rank())
    return pd.Series(out, dtype=float)


def quantile_returns(score: pd.DataFrame, fwd: pd.DataFrame, buckets: int = 5) -> pd.DataFrame:
    """달마다 점수 순으로 buckets 등분한 묶음의 다음 달 평균 수익률 (열 0 = 점수 최하위)."""
    rows = {}
    for date in score.index:
        s, f = score.loc[date], fwd.loc[date]
        ok = s.notna() & f.notna()
        if ok.sum() < MIN_NAMES:
            continue
        group = pd.qcut(s[ok].rank(method="first"), buckets, labels=False)
        rows[date] = f[ok].groupby(group).mean()
    return pd.DataFrame(rows).T.sort_index()


def long_short(score: pd.DataFrame, fwd: pd.DataFrame) -> pd.Series:
    """상위 20% 롱 · 하위 20% 숏의 월 수익률 (비용 없음)."""
    q = quantile_returns(score, fwd)
    return (q[q.columns.max()] - q[q.columns.min()]) if len(q) else pd.Series(dtype=float)


def annualized(monthly: pd.Series) -> float:
    """월 수익률 → 연환산 수익률(%)."""
    r = monthly.dropna()
    if not len(r):
        return float("nan")
    return float(((1 + r).prod() ** (12 / len(r)) - 1) * 100)


def sharpe(monthly: pd.Series) -> float:
    r = monthly.dropna()
    if len(r) < 3 or r.std() == 0:
        return float("nan")
    return float(r.mean() / r.std() * np.sqrt(12))


def cumulative(monthly: pd.Series) -> List[float]:
    """월 수익률 → 누적 수익률(%) 목록 (첫 값 0 은 넣지 않는다 — 달마다 한 값)."""
    return list((((1 + monthly.fillna(0)).cumprod()) - 1) * 100)

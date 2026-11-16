"""팩터 점수 — 일별 종가(날짜 × 종목)에서 월말 팩터를 만든다.

가격만 쓴다. 재무 팩터(밸류 · 퀄리티 · 이익 수정)는 넣지 않는다 — 적재된 재무 지표는 '그 시점에 알려진 값'
(point-in-time)이 아니라서 과거 구간 검증에 쓰면 미래 정보가 섞인다.

t 월말의 점수는 t 월말까지의 가격만 쓰고, 맞추려는 값은 t+1 월의 수익률이다 (look-ahead 없음).
"""
from __future__ import annotations

from typing import Dict

import numpy as np
import pandas as pd

# (id, 이름, 설명) — 점수가 높을수록 '다음 달이 좋을 것'이라는 방향으로 부호를 맞춘다
FACTORS = [
    ("mom_12_1", "모멘텀 12-1", "12개월 수익률 · 최근 1개월 제외"),
    ("mom_6_1", "모멘텀 6-1", "6개월 수익률 · 최근 1개월 제외"),
    ("rev_1m", "단기 반전", "최근 1개월 수익률의 반대"),
    ("lowvol", "저변동성", "60일 실현 변동성 역순"),
    ("high52", "52주 고가 근접", "현재가 ÷ 52주 최고가"),
    ("trend", "추세", "현재가 ÷ 200일 이동평균"),
]
FACTOR_IDS = [f[0] for f in FACTORS]

MIN_NAMES = 30   # 한 달에 점수가 있는 종목이 이보다 적으면 그 달은 쓰지 않는다


def month_end(daily: pd.DataFrame) -> pd.DataFrame:
    """월의 마지막 거래일 값. 인덱스는 그 거래일 날짜."""
    key = daily.index.to_period("M")
    last_day = pd.Series(daily.index, index=daily.index).groupby(key).max()
    return daily.loc[last_day.values]


def zscore(frame: pd.DataFrame) -> pd.DataFrame:
    """달마다 종목 간 표준화 (±3 에서 자른다). 종목이 모자란 달은 전부 NaN."""
    mean = frame.mean(axis=1)
    std = frame.std(axis=1).replace(0, np.nan)
    z = frame.sub(mean, axis=0).div(std, axis=0).clip(-3, 3)
    z[frame.notna().sum(axis=1) < MIN_NAMES] = np.nan
    return z


def build_factors(close: pd.DataFrame) -> Dict[str, pd.DataFrame]:
    """일별 종가 → { 팩터 id: 월말 z-점수(월말 × 종목) } + 'fwd'(다음 달 수익률) + 'ret'(그 달 수익률)."""
    close = close.sort_index()
    daily_ret = close.pct_change(fill_method=None)
    m = month_end(close)
    ret = m.pct_change(fill_method=None)

    raw = {
        "mom_12_1": m.shift(1) / m.shift(12) - 1,
        "mom_6_1": m.shift(1) / m.shift(6) - 1,
        "rev_1m": -ret,
        "lowvol": -month_end(daily_ret.rolling(60, min_periods=40).std()),
        "high52": m / month_end(close.rolling(252, min_periods=200).max()),
        "trend": m / month_end(close.rolling(200, min_periods=150).mean()) - 1,
    }
    out = {name: zscore(frame) for name, frame in raw.items()}
    out["ret"] = ret
    out["fwd"] = ret.shift(-1)
    return out


def composite(scores: Dict[str, pd.DataFrame]) -> pd.DataFrame:
    """합성 점수 — 팩터 z-점수의 동일 비중 평균 (팩터가 절반 이상 있는 종목만)."""
    stack = np.stack([scores[f].to_numpy() for f in FACTOR_IDS])
    have = np.sum(~np.isnan(stack), axis=0)
    mean = np.nanmean(np.where(have >= len(FACTOR_IDS) / 2, stack, np.nan), axis=0)
    first = scores[FACTOR_IDS[0]]
    return pd.DataFrame(mean, index=first.index, columns=first.columns)

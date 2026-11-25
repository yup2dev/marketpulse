"""매크로 조건 — "언제 보유하고 언제 빠질지" 규칙 (전략에 붙는다).

    overlay = {"mode": "all" | "any", "rules": [{series, transform, op, value}]}

매달 말 그때까지의 지표 값으로 판단해 켜지면 보유, 꺼지면 전부 현금. 지표는 월별 패널의 '^' 행
(로컬 배치 MarketpulseBatch/index_analyzer/quant/macro.py 가 적재)이라 새 테이블이 없다.
전략 백테스트(quant_strategy_service.run_backtest)와 종목 묶음 백테스트(quant_portfolio_service.run_backtest)가
같이 쓴다.
"""
from __future__ import annotations

from typing import List, Optional, Tuple

import pandas as pd

# 매크로 시장 지표 — 패널의 '^' 행 (배치 quant/macro.py 와 같은 코드 · tests 가 맞춰 본다)
# (코드, 이름, 종류: rate = 금리 · 포인트 → 변화는 차이 / price = 가격 → 변화는 %)
MACRO_SERIES: List[Tuple[str, str, str]] = [
    ("^TNX", "미국 10년물 금리", "rate"),
    ("^IRX", "미국 3개월물 금리", "rate"),
    ("^DXY", "달러 지수", "price"),
    ("^HG", "구리 선물", "price"),
    ("^VIX", "VIX 변동성", "rate"),
    ("^SOX", "필라델피아 반도체 지수", "price"),
]
MACRO_IDS = [m[0] for m in MACRO_SERIES]
_NAMES = {m[0]: m[1] for m in MACRO_SERIES}
_KINDS = {m[0]: m[2] for m in MACRO_SERIES}

TRANSFORMS = {
    "level": "값",
    "chg_3m": "3개월 변화",       # rate = 차이(%p · 포인트), price = %
    "chg_1m": "1개월 변화",
    "ma12_gap": "12개월 평균 대비 %",
    "yoy": "1년 전 대비 %",
}
OPS = {">": lambda a, b: a > b, ">=": lambda a, b: a >= b, "<": lambda a, b: a < b, "<=": lambda a, b: a <= b}
MAX_RULES = 5
NOTE = "매크로 조건은 매달 말 그때까지의 지표 값으로 판단 · 꺼진 달은 전부 현금(수익률 0)"


class OverlayError(ValueError):
    """잘못된 매크로 조건 · 적재 안 된 지표 (route_handler 가 400 으로 바꾼다)."""


def validate(raw) -> Optional[dict]:
    """매크로 조건 정리 — 규칙이 없으면 None (늘 보유)."""
    if not raw or not raw.get("rules"):
        return None
    mode = raw.get("mode") or "all"
    if mode not in ("all", "any"):
        raise OverlayError("조건 묶음은 all(모두) 또는 any(하나라도)예요")
    rules = []
    for r in raw["rules"]:
        series, transform, op = r.get("series"), r.get("transform") or "level", r.get("op") or ">"
        if series not in MACRO_IDS:
            raise OverlayError(f"모르는 매크로 지표예요: {series}")
        if transform not in TRANSFORMS:
            raise OverlayError(f"모르는 변환이에요: {transform}")
        if op not in OPS:
            raise OverlayError(f"모르는 비교예요: {op}")
        try:
            value = float(r.get("value") if r.get("value") is not None else 0)
        except (TypeError, ValueError):
            raise OverlayError(f"{series} 조건의 기준값은 숫자여야 해요")
        rules.append({"series": series, "transform": transform, "op": op, "value": value})
    if len(rules) > MAX_RULES:
        raise OverlayError(f"조건은 {MAX_RULES}개까지예요")
    return {"mode": mode, "rules": rules}


def _monthly(panel: dict, code: str) -> pd.Series:
    """'^' 지표의 월말 값 — 달(Period) 인덱스."""
    s = panel["bench_close"].get(code)
    if s is None or not s.notna().any():
        raise OverlayError(f"매크로 지표 {_NAMES.get(code, code)}({code}) 가 아직 적재되지 않았어요 — "
                           "로컬에서 build_quant.py --macro-only 를 실행해 주세요")
    s = s.dropna()
    return pd.Series(s.values, index=s.index.to_period("M")).groupby(level=0).last()


def _transformed(series: pd.Series, transform: str, kind: str) -> pd.Series:
    if transform == "level":
        return series
    if transform in ("chg_3m", "chg_1m"):
        n = 3 if transform == "chg_3m" else 1
        return series.diff(n) if kind == "rate" else (series / series.shift(n) - 1) * 100
    if transform == "ma12_gap":
        return (series / series.rolling(12).mean() - 1) * 100
    return (series / series.shift(12) - 1) * 100   # yoy


def rule_label(r: dict) -> str:
    return f"{_NAMES.get(r['series'], r['series'])} {TRANSFORMS[r['transform']]} {r['op']} {r['value']:g}"


def states(overlay: Optional[dict], panel: dict, months: pd.DatetimeIndex) -> Tuple[pd.Series, pd.DataFrame]:
    """달마다 (보유 여부 True/False · 값이 모자라면 None, 규칙별 지표 값 표). 조건이 없으면 전부 True.
    값은 그 달 말 지표 값까지만 쓴다 — 그 달 말에 판단해 다음 달 수익률을 먹는다."""
    if not overlay:
        return pd.Series(True, index=months, dtype=object), pd.DataFrame(index=months)
    per = months.to_period("M")
    values, checks = {}, {}
    for i, r in enumerate(overlay["rules"]):
        v = _transformed(_monthly(panel, r["series"]), r["transform"], _KINDS[r["series"]]).reindex(per)
        v.index = months
        values[rule_label(r)] = v
        checks[i] = [None if pd.isna(x) else OPS[r["op"]](x, r["value"]) for x in v.values]
    table = pd.DataFrame(checks, index=months)
    known = table.notna().all(axis=1)
    hit = table.astype(bool).all(axis=1) if overlay["mode"] == "all" else table.astype(bool).any(axis=1)
    out = pd.Series([bool(h) if k else None for h, k in zip(hit, known)], index=months, dtype=object)
    return out, pd.DataFrame(values, index=months)


def evaluable(st: pd.Series, months: pd.DatetimeIndex) -> pd.DatetimeIndex:
    """지표 값이 모자란 앞쪽 달을 뺀 달들."""
    return months[[st[d] is not None for d in months]]


def switch(d: pd.Timestamp, on: bool, values: pd.DataFrame, clean) -> dict:
    """전환 기록 한 줄 — 날짜 · 보유/현금 · 그때 지표 값."""
    return {"date": d.date().isoformat(), "state": "in" if on else "out",
            "values": {k: clean(float(v)) for k, v in values.loc[d].items()}}


def catalog() -> dict:
    return {
        "macro": [{"id": i, "name": n, "kind": k} for i, n, k in MACRO_SERIES],
        "transforms": [{"id": k, "name": v} for k, v in TRANSFORMS.items()],
        "ops": list(OPS),
    }

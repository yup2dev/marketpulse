"""백테스트 결과에서 파생 계열 — 월별 수익률 · 롤링 샤프 · 낙폭 · 누적 수익률 (순수 함수).

입력은 백테스트 실행 결과의 자산 곡선 equity = [{date, strategy, benchmark}, …] (시작 1.0 기준 가치).
예전에는 위젯 transform(브라우저)이 계산했다 — 서버가 응답에 실어 보내고 화면은 그리기만 한다.
"""
import math
from datetime import date
from typing import Any, Dict, List, Optional, Tuple

Point = Dict[str, Any]


def window(equity: List[Point], months: int) -> List[Point]:
    """마지막 점에서 months 개월 안의 점만 (0 = 전부). 남는 점이 2개 미만이면 전부."""
    if not months or not equity:
        return equity
    last = date.fromisoformat(str(equity[-1]["date"])[:10])
    y, m = divmod(last.year * 12 + last.month - 1 - months, 12)
    since = last.replace(year=y, month=m + 1, day=min(last.day, 28)).isoformat()
    out = [p for p in equity if str(p["date"])[:10] >= since]
    return out if len(out) >= 2 else equity


def equity_view(equity: List[Point], months: int = 0) -> List[Dict[str, Any]]:
    """고른 기간의 누적 수익(%) · 벤치마크(%) · 낙폭(%) — 기간 시작점을 0 으로, 낙폭은 기간 안 최고점 대비."""
    pts = window(equity, months)
    if len(pts) < 2:
        return []
    s0, b0 = pts[0]["strategy"] or 1, pts[0].get("benchmark") or 1
    peak, out = -math.inf, []
    for p in pts:
        s = p["strategy"] / s0
        peak = max(peak, s)
        bench = p.get("benchmark")
        out.append({"date": str(p["date"]), "strategy": (s - 1) * 100,
                    "benchmark": (bench / b0 - 1) * 100 if bench is not None else None,
                    "drawdown": (s / peak - 1) * 100})
    return out


def cumulative_pct(equity: List[Point], key: str = "strategy") -> List[Optional[float]]:
    """첫 점을 0 으로 한 누적 수익률(%)."""
    base = next((p[key] for p in equity if p.get(key)), None)
    return [(p[key] / base - 1) * 100 if base and p.get(key) is not None else None for p in equity]


def monthly_returns(equity: List[Point]) -> List[Dict[str, Any]]:
    """월말 자산을 앞 달 월말과 비교 (첫 달은 시작점 대비) → [{year, month, value(%)}]."""
    ends: List[Tuple[str, float]] = []
    for p in equity:
        key = str(p["date"])[:7]
        if ends and ends[-1][0] == key:
            ends[-1] = (key, p["strategy"])
        else:
            ends.append((key, p["strategy"]))
    prev = equity[0]["strategy"] if equity else None
    out = []
    for key, value in ends:
        out.append({"year": key[:4], "month": int(key[5:7]), "value": (value / prev - 1) * 100 if prev else None})
        prev = value
    return out


def rolling_sharpe(equity: List[Point]) -> Tuple[List[Dict[str, Any]], Optional[str]]:
    """롤링 샤프 — 창은 1년(자료가 짧으면 전체의 1/3), 연환산. (행, 창 길이 표기)."""
    n = len(equity)
    if n < 30:
        return [], None
    first, last = date.fromisoformat(str(equity[0]["date"])[:10]), date.fromisoformat(str(equity[-1]["date"])[:10])
    years = (last - first).days / 365.25
    ppy = (n - 1) / years if years > 0 else 252           # 1년에 점이 몇 개 (월별 실행이면 12)
    win = max(10, min(round(ppy), n // 3))
    rets = [0.0] + [equity[i]["strategy"] / equity[i - 1]["strategy"] - 1 for i in range(1, n)]
    out = []
    for i in range(win, n):
        w = rets[i - win + 1:i + 1]
        mean = sum(w) / len(w)
        sd = math.sqrt(sum((x - mean) ** 2 for x in w) / (len(w) - 1))
        out.append({"date": str(equity[i]["date"]), "sharpe": mean / sd * math.sqrt(ppy) if sd > 0 else None})
    return out, (f"{win}개월" if ppy <= 13 else f"{win}봉")


def with_views(result: Dict[str, Any], months: int = 0) -> Dict[str, Any]:
    """실행 결과에 파생 계열을 붙인다 — equity_view(고른 기간) · monthly · rolling · rolling_window."""
    if not result or not result.get("equity"):
        return result
    eq = result["equity"]
    rolling, win = rolling_sharpe(eq)
    return {**result, "equity_view": equity_view(eq, months), "monthly": monthly_returns(eq),
            "rolling": rolling, "rolling_window": win}


def with_cumulative(row: Dict[str, Any]) -> Dict[str, Any]:
    """전략별 손익 비교 행 — equity 점마다 자기 첫 점 기준 누적 수익률(strategy_pct · benchmark_pct)."""
    eq = row.get("equity") or []
    s, b = cumulative_pct(eq, "strategy"), cumulative_pct(eq, "benchmark")
    return {**row, "equity": [{**p, "strategy_pct": sp, "benchmark_pct": bp} for p, sp, bp in zip(eq, s, b)]}

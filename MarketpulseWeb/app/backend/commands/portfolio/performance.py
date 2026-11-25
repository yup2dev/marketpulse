"""기관 포트폴리오 — 13F 추정 분기 수익률을 조회 구간 기준 누적으로.

배치가 적재한 cumulative_return_pct 는 배치가 계산한 구간 기준이라, 화면이 고른 기간(1y · 3y …)의
첫 분기부터 다시 복리로 쌓는다.
"""
from typing import Any, Dict, List

from app.backend.commands._base import Rows


def rebase_cumulative(rows: Rows, period_key: str = "period") -> Rows:
    """분기 수익률(return_pct)을 오래된 분기부터 복리로 누적 → cumulative_return_pct. 행 순서는 그대로."""
    growth = 1.0
    out: List[Dict[str, Any]] = [dict(r) for r in rows]
    for r in sorted(out, key=lambda r: str(r.get(period_key) or "")):
        if r.get("return_pct") is None:
            r["cumulative_return_pct"] = None
            continue
        growth = growth * (1 + r["return_pct"] / 100)
        r["cumulative_return_pct"] = round((growth - 1) * 100, 2)
    return out

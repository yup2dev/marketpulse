"""시계열 command 공용 — 행 → (날짜, 값) 점 · 날짜 기준 변화율 · 대시보드 행.

조회는 하지 않는다 — command 의 inputs 를 CommandRunner 가 받아 온다 (data_fetcher.core.command_runner).
"""
from typing import Any, Dict, List, Mapping, Optional, Tuple

from pydantic import BaseModel

from app.backend.commands._base import Rows

Point = Tuple[str, float]



def points(rows: Rows, newest_first: bool = False) -> List[Point]:
    """행 → [(YYYY-MM-DD, 값)] 날짜순. 값이 없거나 숫자가 아니면('.') 뺀다."""
    out = []
    for r in rows or []:
        d, v = r.get("date"), r.get("value")
        if d is None or v in (None, ".", ""):
            continue
        try:
            out.append((str(d)[:10], float(v)))
        except (TypeError, ValueError):
            continue
    return sorted(out, reverse=newest_first)


def latest(rows: Rows) -> Optional[float]:
    pts = points(rows)
    return pts[-1][1] if pts else None


def shift_month(ymd: str, months: int) -> str:
    """'YYYY-MM-DD' 를 months 개월 이동 (일자는 유지 — FRED 월간은 항상 01)."""
    y, m = int(ymd[:4]), int(ymd[5:7]) + months
    y, m = y + (m - 1) // 12, (m - 1) % 12 + 1
    return f"{y:04d}-{m:02d}{ymd[7:10]}"


def pct_change_at(by_date: Mapping[str, float], ymd: str, months_back: int = 12) -> Optional[float]:
    """by_date[ymd] 의 months_back 개월 전 대비 변화율(%) — 비교 시점은 위치가 아니라 날짜로 찾는다.

    FRED 는 미발표 월을 '.' 로 준다(예: 2025-10 CPI, 셧다운). 결측을 걸러낸 목록에서 "12칸 뒤"를 쓰면
    결측월을 지나는 구간이 13개월 변화가 된다. 어느 한쪽이 없거나 0 이면 None.
    """
    cur = by_date.get(ymd)
    ago = by_date.get(shift_month(ymd, -months_back))
    if cur is None or not ago:
        return None
    return (cur - ago) / ago * 100


def yoy_at(by_date: Mapping[str, float], ymd: str) -> Optional[float]:
    return pct_change_at(by_date, ymd, 12)


def nearest(pts: List[Point], ymd: str) -> Optional[Point]:
    """ymd 와 날짜가 가장 가까운 점 (같으면 먼저 나온 쪽)."""
    from datetime import date
    target = date.fromisoformat(ymd[:10])
    return min(pts, key=lambda p: abs((date.fromisoformat(p[0]) - target).days)) if pts else None


def in_range(ymd: str, start: Optional[Any], end: Optional[Any]) -> bool:
    return (start is None or ymd >= str(start)) and (end is None or ymd <= str(end))


class DashboardRow(BaseModel):
    """스냅샷 대시보드 한 줄 — 섹션별 지표 1건 (percentile · score 는 쓰는 대시보드만)."""

    section: str
    metric: str
    value: Optional[float] = None
    unit: Optional[str] = ""
    status: Optional[str] = None
    percentile: Optional[float] = None
    score: Optional[float] = None

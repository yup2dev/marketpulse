"""날짜 기준 전년동기比 — FRED 결측월에 안전한 YoY.

FRED는 미발표 월을 '.' 로 준다(예: 2025-10 CPI, 셧다운). '.' 을 걸러낸 리스트에서
"12칸 뒤"를 전년동월로 쓰면, 결측월을 지나는 구간은 13개월 변화가 된다
(CPIAUCSL 2026-09: 4.02% ← 실제 3.72%). 비교 시점은 항상 날짜로 찾는다.
"""
from typing import Mapping, Optional


def shift_month(ymd: str, months: int) -> str:
    """'YYYY-MM-DD' 를 months 개월 이동 (일자는 유지 — FRED 월간은 항상 01)."""
    y, m = int(ymd[:4]), int(ymd[5:7]) + months
    y, m = y + (m - 1) // 12, (m - 1) % 12 + 1
    return f"{y:04d}-{m:02d}{ymd[7:10]}"


def pct_change_at(by_date: Mapping[str, float], ymd: str, months_back: int = 12) -> Optional[float]:
    """by_date[ymd] 의 months_back 개월 전 대비 변화율(%). 어느 한쪽이 없거나 0이면 None."""
    cur = by_date.get(ymd)
    ago = by_date.get(shift_month(ymd, -months_back))
    if cur is None or not ago:
        return None
    return (cur - ago) / ago * 100


def yoy_at(by_date: Mapping[str, float], ymd: str) -> Optional[float]:
    return pct_change_at(by_date, ymd, 12)

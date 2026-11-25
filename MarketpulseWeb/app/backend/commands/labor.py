"""노동시장 — 스냅샷 대시보드 · 민간/정부 고용 변화."""
from datetime import date
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field

from app.backend.commands._base import Rows, Source
from app.backend.commands._series import DashboardRow, fetch_keyed, points, yoy_at

# (키, 시리즈, 받을 관측 수) — 최신 기준. 실업률 · 고용은 직전 대비용 2개, 임금은 전년 대비를 날짜로 찾으려고 14개.
LABOR_SERIES = [
    ("u3",       "UNRATE",        2),
    ("u6",       "U6RATE",        1),
    ("lfpr",     "CIVPART",       1),
    ("payroll",  "PAYEMS",        2),
    ("jolts",    "JTSJOL",        1),
    ("quits",    "JTSQUR",        1),
    ("claims",   "ICSA",          1),
    ("cont",     "CCSA",          1),
    ("earnings", "CES0500000003", 14),
    ("ulc",      "ULCNFB",        1),
    ("prod",     "OPHNFB",        1),
]


def _clamp100(x: float) -> float:
    return max(0.0, min(100.0, x))


def _r(v: Optional[float], digits: int) -> Optional[float]:
    return round(v, digits) if v is not None else None


def _int(v: Optional[float]) -> Optional[int]:
    return int(v) if v is not None else None


def labor_rows(data: Dict[str, Rows]) -> List[DashboardRow]:
    """시리즈별 최신값 → 대시보드 행 + 실업률 · 이직률 · 신규 청구로 만든 노동시장 열기(0~100)."""
    pts = {k: points(v, newest_first=True) for k, v in data.items()}
    last = {k: (p[0][1] if p else None) for k, p in pts.items()}
    rows: List[DashboardRow] = []
    heat: List[float] = []

    def add(section: str, metric: str, value: Optional[float], unit: str, **extra: Any) -> None:
        if value is not None:
            rows.append(DashboardRow(section=section, metric=metric, value=value, unit=unit, **extra))

    u3 = last.get("u3")
    if u3 is not None:
        trend = "stable"
        if len(pts["u3"]) >= 2:
            prev = pts["u3"][1][1]
            trend = "improving" if u3 < prev - 0.1 else "deteriorating" if u3 > prev + 0.1 else "stable"
        add("Unemployment", "U3 Rate", round(u3, 1), "%", status=trend)
        heat.append(_clamp100(100 - u3 * 20))
    add("Unemployment", "U6 Rate", _r(last.get("u6"), 1), "%")
    add("Unemployment", "Participation Rate", _r(last.get("lfpr"), 1), "%")

    payroll = pts.get("payroll", [])
    if len(payroll) >= 2:
        add("Job Market", "Nonfarm Payrolls", int(payroll[0][1]), "K")
        add("Job Market", "Payroll Change MoM", int(payroll[0][1] - payroll[1][1]), "K")
    add("Job Market", "JOLTS Openings", _int(last.get("jolts")), "K")
    quits = last.get("quits")
    if quits is not None:
        add("Job Market", "Quits Rate", round(quits, 1), "%")
        heat.append(min(100.0, quits * 40))
    claims = last.get("claims")
    if claims is not None:
        add("Job Market", "Initial Claims", int(claims), "")
        heat.append(_clamp100(100 - (claims - 200_000) / 2000))
    add("Job Market", "Continuing Claims", _int(last.get("cont")), "")

    earnings = pts.get("earnings", [])
    if earnings:
        add("Wages", "Hourly Earnings", round(earnings[0][1], 2), "$/hr")
        add("Wages", "Earnings YoY", _r(yoy_at(dict(earnings), earnings[0][0]), 2), "%")
    add("Wages", "Unit Labor Cost", _r(last.get("ulc"), 1), "")
    add("Wages", "Productivity", _r(last.get("prod"), 1), "")

    if heat:
        add("Heat Index", "Labor Market Heat", round(sum(heat) / len(heat), 1), "/100")
    return rows


async def labor_dashboard(series: Source, as_of: Optional[date] = None) -> List[DashboardRow]:
    """as_of: 이 날짜 이전 마지막 관측값으로 (비우면 최신)."""
    data = await fetch_keyed(series, {
        key: {"series_id": sid, "limit": n, "sort_order": "desc", "end_date": as_of}
        for key, sid, n in LABOR_SERIES
    }, "labor_dashboard")
    return labor_rows(data)


# ── 민간 · 정부 고용 ───────────────────────────────────────────────────────────

class JobsPoint(BaseModel):
    date: str
    private: Optional[float] = Field(default=None, description="기간 첫 달 대비 민간 고용 변화 (천 명)")
    government: Optional[float] = Field(default=None, description="기간 첫 달 대비 정부 고용 변화 (천 명)")
    private_level: Optional[float] = None
    government_level: Optional[float] = None


def jobs_from(private: Rows, government: Rows) -> List[JobsPoint]:
    p, g = dict(points(private)), dict(points(government))
    dates = sorted(set(p) & set(g))
    if not dates:
        return []
    base_p, base_g = p[dates[0]], g[dates[0]]
    return [JobsPoint(date=d, private=round(p[d] - base_p, 0), government=round(g[d] - base_g, 0),
                      private_level=round(p[d], 0), government_level=round(g[d], 0)) for d in dates]


async def jobs_breakdown(series: Source, start: Optional[date] = None, end: Optional[date] = None) -> List[JobsPoint]:
    rng = {"start_date": start, "end_date": end, "sort_order": "asc"}
    data = await fetch_keyed(series, {"private": {"series_id": "USPRIV", **rng},
                                      "government": {"series_id": "USGOVT", **rng}}, "jobs_breakdown")
    return jobs_from(data["private"], data["government"])

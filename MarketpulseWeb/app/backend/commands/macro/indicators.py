"""거시 지표 분석 — 최신값 · 직전 대비 변화율, 두 시리즈의 비율(%).

순수 함수다 — 행을 받아 계산만 한다. 어느 provider · model 을 받을지는 라우터의 command inputs 가 정하고
조회는 CommandRunner 가 한다.
"""
from dataclasses import dataclass
from datetime import date as dateType
from typing import Any, Dict, List, Mapping, Optional, Sequence

from pydantic import BaseModel, ConfigDict, Field

from app.backend.commands._base import Rows, latest_two, pct_change


# ── 지표 여러 개의 최신값 ────────────────────────────────────────────────────────

class IndicatorOverviewData(BaseModel):
    """지표 행의 최신 칸을 그대로 두고 indicator · unit · change 를 붙인다."""

    model_config = ConfigDict(extra="allow")
    indicator: str = Field(description="지표 키")
    unit: str = Field(description="단위")
    change: Optional[float] = Field(default=None, description="직전 관측 대비 (%)")


def indicator_overview(data: Mapping[str, Rows], units: Mapping[str, str]) -> List[IndicatorOverviewData]:
    """{지표 키: 행} → 지표마다 최신값과 직전 관측 대비 변화율. 행이 없는(실패한) 지표는 빠진다."""
    out = []
    for key, rows in data.items():
        latest, prev = latest_two(rows)
        if latest is None:
            continue
        change = pct_change(latest.get("value"), prev.get("value")) if prev else None
        out.append(IndicatorOverviewData(**{**latest, "indicator": key, "unit": units.get(key, ""), "change": change}))
    return out


# ── 여러 시리즈의 최신값 (한 번에 받은 행을 시리즈별로) ──────────────────────────────

@dataclass(frozen=True)
class SeriesSpec:
    key: str
    series_id: str
    name: str
    category: str
    unit: str


class SeriesOverviewData(BaseModel):
    key: str = Field(description="시리즈 키")
    name: str = Field(description="이름")
    category: str = Field(description="분류")
    value: Optional[float] = Field(default=None, description="최신값")
    unit: str = Field(description="단위")
    date: Optional[dateType] = Field(default=None, description="관측일")
    change: Optional[float] = Field(default=None, description="직전 관측 대비 (%)")


def series_overview(rows: Rows, catalog: Sequence[SeriesSpec]) -> List[SeriesOverviewData]:
    """여러 시리즈의 최근 관측(행마다 series_id) → 시리즈별 최신값 · 변화율. 관측이 없는 시리즈는 빠진다."""
    by_id: Dict[str, List[Dict[str, Any]]] = {}
    for r in rows:
        by_id.setdefault(r.get("series_id"), []).append(r)
    out = []
    for spec in catalog:
        latest, prev = latest_two(by_id.get(spec.series_id, []))
        if latest is None:
            continue
        out.append(SeriesOverviewData(
            key=spec.key, name=spec.name, category=spec.category, unit=spec.unit,
            value=latest.get("value"), date=latest["date"],
            change=pct_change(latest.get("value"), prev.get("value") if prev else None),
        ))
    return out


# ── 시계열 그대로 ───────────────────────────────────────────────────────────────

class DatedValue(BaseModel):
    date: dateType = Field(description="관측일")
    value: Optional[float] = Field(default=None, description="값")


def dated_values(rows: Rows, digits: Optional[int] = None) -> List[Dict[str, Any]]:
    """행 → {date, value} (화면이 쓰는 두 칸만). digits 를 주면 반올림하고 값 없는 날은 뺀다."""
    return [{"date": r["date"], "value": round(r["value"], digits) if digits is not None else r["value"]}
            for r in rows if r.get("date") and (digits is None or r.get("value") is not None)]


# ── 두 시리즈의 비율 ─────────────────────────────────────────────────────────────

def ratio_pct_from(rows: Rows, numerator: str, denominator: str) -> List[DatedValue]:
    """같은 날짜의 numerator ÷ denominator × 100 (소수 둘째 자리). 분모가 없는 날짜는 빠진다 (행마다 series_id)."""
    den = {r["date"]: r["value"] for r in rows if r.get("series_id") == denominator and r.get("value")}
    return [
        DatedValue(date=r["date"], value=round(r["value"] / den[r["date"]] * 100, 2))
        for r in sorted(rows, key=lambda r: str(r["date"]))
        if r.get("series_id") == numerator and r.get("value") is not None and den.get(r["date"])
    ]

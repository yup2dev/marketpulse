"""거시 지표 분석 — 최신값 · 직전 대비 변화율, 두 시리즈의 비율(%).

입력은 라우트가 넘긴 Source(어느 provider 의 어떤 모델) — 여기서는 받은 행으로 계산만 한다.
"""
from dataclasses import dataclass
from datetime import date as dateType
from typing import Any, Dict, List, Optional, Sequence

from pydantic import BaseModel, ConfigDict, Field

from app.backend.commands._base import (
    Source, fetch_many, fetch_rows, latest_two, pct_change, raise_if_all_failed,
)


# ── 지표 여러 개의 최신값 ────────────────────────────────────────────────────────

@dataclass(frozen=True)
class IndicatorSpec:
    key: str
    source: Source
    unit: str


class IndicatorOverviewData(BaseModel):
    """지표 행의 최신 칸을 그대로 두고 indicator · unit · change 를 붙인다."""

    model_config = ConfigDict(extra="allow")
    indicator: str = Field(description="지표 키")
    unit: str = Field(description="단위")
    change: Optional[float] = Field(default=None, description="직전 관측 대비 (%)")


async def indicator_overview(specs: Sequence[IndicatorSpec]) -> List[IndicatorOverviewData]:
    """지표마다 출처를 병렬로 불러 최신값과 직전 관측 대비 변화율. 실패한 지표만 빠진다."""
    found = await fetch_many([s.source for s in specs])
    raise_if_all_failed(found, "indicator_overview")
    out = []
    for spec, rows in zip(specs, found):
        if isinstance(rows, BaseException):
            continue
        latest, prev = latest_two(rows)
        if latest is None:
            continue
        change = pct_change(latest.get("value"), prev.get("value")) if prev else None
        out.append(IndicatorOverviewData(**{**latest, "indicator": spec.key, "unit": spec.unit, "change": change}))
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


async def series_overview(source: Source, catalog: Sequence[SeriesSpec]) -> List[SeriesOverviewData]:
    """출처 하나가 여러 시리즈의 최근 관측을 돌려준다 (행마다 series_id) — 시리즈별 최신값 · 변화율.

    관측이 없는 시리즈는 빠진다.
    """
    by_id: Dict[str, List[Dict[str, Any]]] = {}
    for r in await fetch_rows(source):
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


# ── 두 시리즈의 비율 ─────────────────────────────────────────────────────────────

class DatedValue(BaseModel):
    date: dateType = Field(description="관측일")
    value: Optional[float] = Field(default=None, description="값")


async def ratio_pct(source: Source, numerator: str, denominator: str) -> List[DatedValue]:
    """같은 날짜의 numerator ÷ denominator × 100 (소수 둘째 자리). 분모가 없는 날짜는 빠진다.

    source 는 두 시리즈를 함께 돌려준다 (행마다 series_id).
    """
    rows = await fetch_rows(source)
    den = {r["date"]: r["value"] for r in rows if r.get("series_id") == denominator and r.get("value")}
    return [
        DatedValue(date=r["date"], value=round(r["value"] / den[r["date"]] * 100, 2))
        for r in sorted(rows, key=lambda r: str(r["date"]))
        if r.get("series_id") == numerator and r.get("value") is not None and den.get(r["date"])
    ]

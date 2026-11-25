"""환율 분석 — 통화쌍 여러 개의 최신 일봉 + 전일 대비 변화율 (순수 함수)."""
from datetime import date as dateType
from typing import List, Mapping, Optional

from pydantic import BaseModel, Field

from app.backend.commands._base import Rows, latest_two, pct_change


class ForexRateData(BaseModel):
    pair: str = Field(description="통화쌍 (EUR/USD)")
    name: str = Field(description="이름")
    rate: Optional[float] = Field(default=None, description="최신 종가")
    date: Optional[dateType] = Field(default=None, description="기준일")
    change: Optional[float] = Field(default=None, description="전일 대비 (%)")
    high: Optional[float] = Field(default=None, description="고가")
    low: Optional[float] = Field(default=None, description="저가")


def latest_rates(data: Mapping[str, Rows], names: Mapping[str, str]) -> List[ForexRateData]:
    """{쌍: 일봉 행} → 쌍마다 최신 종가 · 전일 대비. 행이 없는(실패한) 쌍은 빠진다."""
    out = []
    for pair, rows in data.items():
        latest, prev = latest_two(rows)
        if latest is None:
            continue
        out.append(ForexRateData(
            pair=pair, name=names.get(pair, pair), rate=latest.get("close"), date=latest["date"],
            change=pct_change(latest.get("close"), prev.get("close") if prev else None),
            high=latest.get("high"), low=latest.get("low"),
        ))
    return out

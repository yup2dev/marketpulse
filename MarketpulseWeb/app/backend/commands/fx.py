"""환율 분석 — 통화쌍 여러 개의 최신 일봉 + 전일 대비 변화율."""
from dataclasses import dataclass
from datetime import date as dateType
from typing import List, Optional, Sequence

from pydantic import BaseModel, Field

from app.backend.commands._base import Source, fetch_many, latest_two, pct_change, raise_if_all_failed


@dataclass(frozen=True)
class PairSpec:
    pair: str            # "EUR/USD"
    name: str
    source: Source       # 그 쌍의 일봉 (date · close · high · low)


class ForexRateData(BaseModel):
    pair: str = Field(description="통화쌍 (EUR/USD)")
    name: str = Field(description="이름")
    rate: Optional[float] = Field(default=None, description="최신 종가")
    date: Optional[dateType] = Field(default=None, description="기준일")
    change: Optional[float] = Field(default=None, description="전일 대비 (%)")
    high: Optional[float] = Field(default=None, description="고가")
    low: Optional[float] = Field(default=None, description="저가")


async def latest_rates(pairs: Sequence[PairSpec]) -> List[ForexRateData]:
    """쌍마다 일봉을 병렬로 불러 최신 종가 · 전일 대비. 실패한 쌍만 빠지고, 전부 실패면 오류를 올린다."""
    found = await fetch_many([p.source for p in pairs])
    raise_if_all_failed(found, "forex_rates")
    out = []
    for spec, rows in zip(pairs, found):
        if isinstance(rows, BaseException):
            continue
        latest, prev = latest_two(rows)
        if latest is None:
            continue
        out.append(ForexRateData(
            pair=spec.pair, name=spec.name, rate=latest.get("close"), date=latest["date"],
            change=pct_change(latest.get("close"), prev.get("close") if prev else None),
            high=latest.get("high"), low=latest.get("low"),
        ))
    return out

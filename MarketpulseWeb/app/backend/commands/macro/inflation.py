"""인플레이션 — CPI 구성요소 기여도 · 모멘텀(12/6/3개월) · 섹터별 YoY.

섹터별 YoY 는 FRED units=pc1 로 받아 날짜로 맞추기만 한다. 구성요소 분해는 최신 지수 · MoM 도 필요하고
전년동월이 결측(2025-10 셧다운)이면 YoY 가 나오는 달로 물러나야 해서 지수로 받아 날짜 기준으로 계산한다.
모멘텀의 6 · 3개월 연율화는 FRED units 에 없다.
"""
from typing import Any, Dict, List, Optional, Tuple

from pydantic import BaseModel, Field

from app.backend.commands._base import Rows
from app.backend.commands.macro.series import pct_change_at, points, yoy_at

# ── CPI 구성요소 분해 ──────────────────────────────────────────────────────────
#
# 기여도(%p) = 가중치(%) × YoY(%) / 100. 가중치는 FRED 에 없는 BLS CPI relative importance 라 상수로 둔다.
# BLS 는 매년 1월에 갱신하므로 연 1회 값을 바꿔야 한다. 구성요소 5개는 서로 겹치지 않게 나눴고,
# '서비스(주거 제외)'는 FRED 대체 지수 'Services less rent of shelter'(에너지 서비스 일부 포함)를 프록시로 쓴다.

WEIGHTS_VINTAGE = "BLS CPI-U relative importance, Dec 2023 (approx.)"
COMPONENTS = [
    # (category, FRED series, weight %) — 합계 100
    ("Food",                    "CPIUFDSL",        13.6),
    ("Energy",                  "CPIENGSL",         6.7),
    ("Goods (ex-food, energy)", "CUSR0000SACL1E",  19.0),
    ("Shelter",                 "CUSR0000SAH1",    36.2),
    ("Services (ex-shelter)",   "CUSR0000SASL2RS", 24.5),
]
INDEX_SERIES = {"headline": "CPIAUCSL", "core": "CPILFESL"}
RATE_SERIES = {                      # 이미 비율(%)인 시리즈 — 최신값만
    "sticky_core_cpi_yoy": "CORESTICKM159SFRBATL",
    "flexible_core_cpi_yoy": "COREFLEXCPIM159SFRBATL",
    "breakeven_5y": "T5YIE",
    "breakeven_10y": "T10YIE",
}


class DecompositionRow(BaseModel):
    category: str
    weight: float = Field(description="CPI 바스켓 가중치 (%)")
    yoy_change: Optional[float] = Field(default=None, description="전년동월比 (%)")
    contribution: Optional[float] = Field(default=None, description="헤드라인 YoY 기여도 (%p)")
    series_id: str
    date: Optional[str] = Field(default=None, description="기준월")


def index_stats(rows: Rows) -> Optional[Dict[str, Any]]:
    """월간 지수 → 최신값 · YoY · MoM.

    최신월의 전년동월이 결측이면(2026-10 ↔ 2025-10) YoY 가 나오는 가장 가까운 달로 물러난다(최대 2개월) —
    그 달이 date 로 나가므로 화면은 어느 달 값인지 그대로 보여 준다. 전월이 결측이면 MoM 은 None.
    """
    pts = points(rows, newest_first=True)
    by_date = dict(pts)
    for d0, cur in pts[:3]:
        yoy = yoy_at(by_date, d0)
        if yoy is None:
            continue
        mom = pct_change_at(by_date, d0, 1)
        return {"date": d0, "current": round(cur, 3), "yoy": round(yoy, 2),
                "mom": round(mom, 2) if mom is not None else None}
    return None


def decomposition_from(data: Dict[str, Rows]) -> Tuple[List["DecompositionRow"], Dict[str, Any]]:
    """{시리즈 id: 행} → (구성요소 행, 헤드라인 · 근원 · 기대인플레이션 메타데이터)."""
    if not any(data.get(sid) for _, sid, _ in COMPONENTS):
        raise ValueError("CPI component series unavailable")
    rows = build_rows(data)
    contribs = [r.contribution for r in rows if r.contribution is not None]
    rates = {}
    for key, sid in RATE_SERIES.items():
        pts = points(data.get(sid, []), newest_first=True)
        rates[key] = round(pts[0][1], 2) if pts else None
    meta = {
        "headline": index_stats(data.get(INDEX_SERIES["headline"], [])),
        "core": index_stats(data.get(INDEX_SERIES["core"], [])),
        **rates,
        "sum_of_contributions": round(sum(contribs), 2) if contribs else None,
        "weights_vintage": WEIGHTS_VINTAGE,
    }
    return rows, meta


def build_rows(index_rows: Dict[str, Rows]) -> List[DecompositionRow]:
    out = []
    for category, sid, weight in COMPONENTS:
        st = index_stats(index_rows.get(sid, []))
        yoy = st["yoy"] if st else None
        out.append(DecompositionRow(
            category=category, weight=weight, yoy_change=yoy,
            contribution=round(weight * yoy / 100, 2) if yoy is not None else None,
            series_id=sid, date=st["date"] if st else None,
        ))
    return out



# ── 모멘텀 ─────────────────────────────────────────────────────────────────────

class MomentumPoint(BaseModel):
    date: str
    yoy_12m: Optional[float] = Field(default=None, description="12개월 YoY (%)")
    yoy_6m: Optional[float] = Field(default=None, description="6개월 연율화 (%)")
    yoy_3m: Optional[float] = Field(default=None, description="3개월 연율화 (%)")


def momentum_from(rows: Rows, start: Optional[Any] = None) -> List[MomentumPoint]:
    """CPI 지수 → 12개월 변화율 + 6 · 3개월 변화의 연율화. 비교 시점은 날짜로 찾는다."""
    pts = points(rows)
    by_date = dict(pts)

    def annualized(d: str, months: int) -> Optional[float]:
        ch = pct_change_at(by_date, d, months)
        return round(((1 + ch / 100) ** (12 / months) - 1) * 100, 2) if ch is not None else None

    out = []
    for d, _ in pts:
        y12 = yoy_at(by_date, d)
        if y12 is None or (start is not None and d < str(start)):
            continue
        out.append(MomentumPoint(date=d, yoy_12m=round(y12, 2), yoy_6m=annualized(d, 6), yoy_3m=annualized(d, 3)))
    return out



# ── 섹터별 YoY ─────────────────────────────────────────────────────────────────

SECTOR_SERIES: Dict[str, str] = {
    "headline": "CPIAUCSL",
    "core":     "CPILFESL",
    "food":     "CPIUFDSL",
    "energy":   "CPIENGSL",
    "shelter":  "CUSR0000SAH1",
    "medical":  "CPIMEDSL",
    "apparel":  "CPIAPPSL",
    "vehicles": "CUSR0000SETA01",
}


class SectorPoint(BaseModel):
    date: str
    headline: Optional[float] = None
    core: Optional[float] = None
    food: Optional[float] = None
    energy: Optional[float] = None
    shelter: Optional[float] = None
    medical: Optional[float] = None
    apparel: Optional[float] = None
    vehicles: Optional[float] = None


def sector_from(rows: Rows) -> List[SectorPoint]:
    """series_id 가 붙은 pc1 행 → 헤드라인 날짜 기준 한 줄에 섹터별 YoY."""
    key_of = {sid: key for key, sid in SECTOR_SERIES.items()}
    by_key: Dict[str, Dict[str, float]] = {}
    for r in rows:
        key = key_of.get(r.get("series_id"))
        if key:
            by_key.setdefault(key, {}).update(points([r]))
    out = []
    for d in sorted(by_key.get("headline", {})):
        fields = {k: round(v[d], 2) for k, v in by_key.items() if d in v}
        out.append(SectorPoint(date=d, **fields))
    return out

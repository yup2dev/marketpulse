"""데이터 개념 조회 — 고른 구현(provider · model)으로 Query 를 실행하고 개념 단위로 정규화한다.

정의 · 구현 고르기(CONCEPTS · choose_impl)는 fetcher 패키지(data_fetcher.concepts)에 있다 — provider 매핑이라서.
조회와 정규화(scale · 전년비)는 provider 와 무관한 가공이라 command 쪽에 둔다 (아키텍처 가이드 v9.1 A7 · B5).
"""
from datetime import date, timedelta
from typing import Any, Callable, Dict, List, Optional

from data_fetcher.concepts import COUNTRY_LABELS, CONCEPTS, ConceptError, ConceptImpl, candidates, choose_impl

from app.backend.core.command.query import Query

__all__ = ["fetch_concept", "normalize", "ConceptError"]


# ── 정규화 ────────────────────────────────────────────────────────────────────

def _row_get(row: Any, key: str) -> Any:
    return row.get(key) if isinstance(row, dict) else getattr(row, key, None)


def _as_date(v: Any) -> Optional[date]:
    if v is None:
        return None
    if isinstance(v, date):
        return v
    try:
        return date.fromisoformat(str(v)[:10])
    except ValueError:
        return None


def _shift_year(d: date, years: int = -1) -> date:
    try:
        return d.replace(year=d.year + years)
    except ValueError:  # 2/29
        return d.replace(year=d.year + years, day=28)


def normalize(impl: ConceptImpl, raw: Any) -> List[Dict[str, Any]]:
    """provider 결과 → [{date, value}] 오름차순. scale·전년비 변환 적용."""
    items = getattr(raw, "result", raw) or []
    points: Dict[date, float] = {}
    for row in items:
        d, v = _as_date(_row_get(row, "date")), _row_get(row, "value")
        if d is None or v is None:
            continue
        try:
            points[d] = float(v) * impl.scale
        except (TypeError, ValueError):
            continue
    if impl.yoy:
        out = {}
        for d, v in points.items():
            prev = points.get(_shift_year(d))
            if prev not in (None, 0):
                out[d] = (v / prev - 1.0) * 100.0
        points = out
    return [{"date": d.isoformat(), "value": round(v, 6)} for d, v in sorted(points.items())]




async def fetch_concept(
    concept_id: str,
    country: str = "USA",
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    provider: Optional[str] = None,
    is_available: Callable[[str], bool] = lambda p: True,
) -> Dict[str, Any]:
    """개념 시계열 조회. 반환: {rows, provider, concept, country, candidates}.
    조회는 app 계층의 Query 로 — 어떤 실행기(서버 · 로컬)가 받을지는 ProviderInterface 가 정한다."""


    concept = CONCEPTS.get(concept_id)
    if concept is None:
        raise ConceptError(f"알 수 없는 지표 개념: '{concept_id}'")
    country = (country or "USA").upper()
    impl = choose_impl(concept, country, is_available, provider)

    end = end_date or date.today()
    start = start_date or (end - timedelta(days=365 * 10))
    params: Dict[str, Any] = dict(impl.params)
    if impl.country_param:
        params[impl.country_param] = impl.countries[country]
    # 전년비는 1년 전 값이 있어야 첫 점이 생긴다 — 1년 더 당겨 받고 아래에서 잘라낸다
    params["start_date"] = (_shift_year(start) if impl.yoy else start).isoformat()
    params["end_date"] = end.isoformat()

    raw = await Query(_model=impl.model, provider=impl.provider, **params).execute()
    lo, hi = start.isoformat(), end.isoformat()
    rows = [r for r in normalize(impl, raw) if lo <= r["date"] <= hi]
    return {
        "rows": rows,
        "provider": impl.provider,
        "concept": {"id": concept.id, "label": concept.label, "unit": concept.unit, "frequency": concept.frequency},
        "country": {"code": country, "label": COUNTRY_LABELS.get(country, country)},
        "note": impl.note,
        "candidates": candidates(concept, country, is_available),
    }

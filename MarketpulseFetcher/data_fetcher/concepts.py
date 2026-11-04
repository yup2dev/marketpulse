"""데이터 개념(concept) 레지스트리 — provider 무관한 지표 정의 + provider별 구현 매핑.

위젯·수식은 'fred의 CPIAUCSL'이 아니라 '소비자물가 상승률(cpi_yoy)'이라는 개념에 묶인다.
요청 시 국가와 사용자가 쓸 수 있는 provider(키 보유 또는 무키)를 보고 구현을 고른다.
값은 개념의 단위로 정규화한다 — 예) OECD 실업률 0.037 → 3.7(%), ECOS CPI 지수 → 전년비(%).

국가는 ISO3 대문자(USA, KOR, …)와 유로존 'EA'를 정규 코드로 쓰고, 구현마다 provider의
국가 값으로 바꾼다. 구현 순서가 곧 우선순위다(해당 국가 전용 원천 → 범용 국제기구 순).
"""
from dataclasses import dataclass, field
from datetime import date, timedelta
from typing import Any, Callable, Dict, List, Optional

COUNTRY_LABELS: Dict[str, str] = {
    "USA": "미국", "KOR": "한국", "JPN": "일본", "DEU": "독일", "GBR": "영국",
    "FRA": "프랑스", "CAN": "캐나다", "CHN": "중국", "EA": "유로존", "AUS": "호주", "IND": "인도",
}

# OECD 모델마다 국가 코드 표기가 다르다(유로존: euro_area_20 / euro_area20 / euro_area / euro_area19).
_OECD_BASE = {
    "USA": "united_states", "KOR": "korea", "JPN": "japan", "DEU": "germany", "GBR": "united_kingdom",
    "FRA": "france", "CAN": "canada", "CHN": "china", "AUS": "australia", "IND": "india",
}


def _oecd(euro: Optional[str], exclude: tuple = ()) -> Dict[str, str]:
    m = {k: v for k, v in _OECD_BASE.items() if k not in exclude}
    if euro:
        m["EA"] = euro
    return m


@dataclass(frozen=True)
class ConceptImpl:
    provider: str
    model: str
    countries: Dict[str, Optional[str]]          # 정규 국가 → provider 국가 값 (None = 국가 파라미터 없음)
    params: Dict[str, Any] = field(default_factory=dict)
    country_param: Optional[str] = "country"
    scale: float = 1.0                           # 값 × scale (비율 → %)
    yoy: bool = False                            # 수준 시계열 → 전년동기비(%)
    note: str = ""


@dataclass(frozen=True)
class Concept:
    id: str
    label: str
    unit: str
    frequency: str
    description: str
    impls: List[ConceptImpl]

    def countries(self) -> List[str]:
        seen: Dict[str, None] = {}
        for impl in self.impls:
            for c in impl.countries:
                seen.setdefault(c, None)
        return list(seen)

    def impls_for(self, country: str) -> List[ConceptImpl]:
        return [i for i in self.impls if country in i.countries]


_US = {"USA": None}
_KR = {"KOR": None}

CONCEPTS: Dict[str, Concept] = {c.id: c for c in [
    Concept(
        "cpi_yoy", "소비자물가 상승률", "%", "M", "헤드라인 CPI 전년동월비",
        [
            ConceptImpl("fred", "series", _US, {"series_id": "CPIAUCSL", "units": "pc1"}, country_param=None),
            ConceptImpl("ecos", "series", _KR, {"stat_code": "901Y009", "item_code": "0", "cycle": "M"},
                        country_param=None, yoy=True, note="소비자물가지수(2020=100) 총지수 → 전년동월비"),
            ConceptImpl("oecd", "consumer_price_index", _oecd("euro_area_20"), {"transform": "yoy"}, scale=100),
        ],
    ),
    Concept(
        "unemployment_rate", "실업률", "%", "M", "계절조정 실업률",
        [
            ConceptImpl("fred", "series", _US, {"series_id": "UNRATE"}, country_param=None),
            ConceptImpl("oecd", "unemployment", _oecd("euro_area20", exclude=("CHN", "IND")), scale=100),
        ],
    ),
    Concept(
        "policy_rate", "기준금리", "%", "D", "중앙은행 정책금리",
        [
            ConceptImpl("fred", "series", _US, {"series_id": "DFEDTARU"}, country_param=None,
                        note="연방기금금리 목표 상단"),
            ConceptImpl("ecos", "series", _KR, {"stat_code": "722Y001", "item_code": "0101000", "cycle": "M"},
                        country_param=None, note="한국은행 기준금리"),
            # 유로존(euro_area19)은 OECD 익일물 데이터셋에 없음(404), 중국은 관측치가 거의 없음
            ConceptImpl("oecd", "country_interest_rates", _oecd(None, exclude=("USA", "KOR", "CHN")),
                        {"duration": "immediate"}, scale=100, note="OECD 익일물(콜) 금리 — 정책금리 근사"),
        ],
    ),
    Concept(
        "long_rate_10y", "국채 10년 금리", "%", "D", "10년 만기 국채 수익률",
        [
            ConceptImpl("fred", "series", _US, {"series_id": "DGS10"}, country_param=None),
            ConceptImpl("ecos", "series", _KR, {"stat_code": "817Y002", "item_code": "010210000", "cycle": "D"},
                        country_param=None, note="국고채(10년) 일별"),
            ConceptImpl("oecd", "country_interest_rates", _oecd(None, exclude=("KOR",)),
                        {"duration": "long"}, scale=100, note="OECD 장기금리(월평균)"),
        ],
    ),
    Concept(
        "real_gdp_growth", "실질 GDP 성장률", "%", "Q", "실질 GDP 전년동기비",
        [
            ConceptImpl("fred", "series", _US, {"series_id": "GDPC1", "units": "pc1"}, country_param=None),
            ConceptImpl("oecd", "gdp_real", _oecd("euro_area", exclude=("CHN",)), {"frequency": "quarter"}, yoy=True),
        ],
    ),
]}


def concept_catalog() -> List[Dict[str, Any]]:
    """프론트 노출용 개념 목록 (구현 provider · 지원 국가 포함)."""
    return [
        {
            "id": c.id, "label": c.label, "unit": c.unit, "frequency": c.frequency,
            "description": c.description,
            "countries": [{"code": k, "label": COUNTRY_LABELS.get(k, k)} for k in c.countries()],
            "providers": sorted({i.provider for i in c.impls}),
        }
        for c in CONCEPTS.values()
    ]


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


# ── 조회 ──────────────────────────────────────────────────────────────────────

class ConceptError(ValueError):
    pass


def candidates(concept: Concept, country: str, is_available: Callable[[str], bool]) -> List[Dict[str, Any]]:
    """국가를 지원하는 구현 목록 + 사용 가능 여부(키 보유/무키). 순서 = 우선순위."""
    return [
        {"provider": i.provider, "available": bool(is_available(i.provider)), "note": i.note}
        for i in concept.impls_for(country)
    ]


def choose_impl(
    concept: Concept, country: str, is_available: Callable[[str], bool], provider: Optional[str] = None
) -> ConceptImpl:
    impls = concept.impls_for(country)
    if not impls:
        raise ConceptError(f"'{concept.label}'은(는) {COUNTRY_LABELS.get(country, country)} 데이터를 지원하지 않습니다")
    if provider:
        for i in impls:
            if i.provider == provider:
                return i
        raise ConceptError(f"'{provider}'는 {concept.label}({country})을(를) 제공하지 않습니다")
    # 사용 가능한 첫 구현. 전부 키가 없으면 첫 구현을 그대로 돌려 '키 등록' 안내가 나가게 한다.
    return next((i for i in impls if is_available(i.provider)), impls[0])


async def fetch_concept(
    concept_id: str,
    country: str = "USA",
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    provider: Optional[str] = None,
    is_available: Callable[[str], bool] = lambda p: True,
) -> Dict[str, Any]:
    """개념 시계열 조회. 반환: {rows, provider, concept, country, candidates}."""
    from data_fetcher.query_executor import QueryExecutor

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

    raw = await QueryExecutor.fetch(impl.provider, impl.model, params)
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

"""KOSIS Helpers — 상수 · 지표별 코드 맵 · 순수 함수 (HTTP 없음).

HTTP 는 models/series.py 의 KOSISSeriesFetcher 한 곳에서만 한다.
지표 모델은 여기의 코드 맵으로 파라미터를 KOSIS 코드로 바꿔 KOSISSeriesFetcher 를 호출한다.

공식 문서: https://kosis.kr/openapi/devGuide/devGuide_0201List.do (통계자료),
          개발가이드 PDF 1.4절 '에러메시지' (오류 코드표).
"""
from datetime import date
from typing import Any, Dict, List, Optional

KOSIS_PARAM_DATA_URL = "https://kosis.kr/openapi/Param/statisticsParameterData.do"

# 수록주기 (prdSe) — 이 provider 가 다루는 것만
PRD_SE_CHOICES = ["M", "Q", "Y"]

# 개발가이드 1.4.2 오류메시지 유형
KOSIS_ERRORS: Dict[str, str] = {
    "10": "인증키 누락",
    "11": "인증키 기간만료",
    "20": "필수요청변수 누락",
    "21": "잘못된 요청변수",
    "30": "조회결과 없음",
    "31": "조회결과 초과",
    "40": "호출가능건수 제한 (분당 200건)",
    "41": "호출가능 ROW 수 제한",
    "42": "사용자별 이용 제한",
    "50": "서버오류",
}
KOSIS_NO_DATA = "30"
KOSIS_KEY_ERRORS = ("10", "11")
KOSIS_RATE_ERRORS = ("40",)


# ── 지표별 코드 맵 ─────────────────────────────────────────────────────────────

# 산업 → KSIC 코드. 광공업생산지수(DT_1F02001, 분류2) · 가동률지수(DT_1F32001, 분류1) 공통
INDUSTRY_CATEGORIES: Dict[str, str] = {
    "manufacturing": "C",            # 제조업
    "semiconductor": "C261",         # 반도체 제조업
    "electronic_components": "C262", # 전자 부품 제조업
    "battery": "C282",               # 일차전지 및 축전지 제조업
    "automobile": "C301",            # 자동차용 엔진 및 자동차 제조업
    "auto_parts": "C303",            # 자동차 신품 부품 제조업
    "shipbuilding": "C311",          # 선박 및 보트 건조업
    "steel": "C241",                 # 1차 철강 제조업
    "chemicals": "C20",              # 화학 물질 및 화학제품 제조업
    "petroleum": "C192",             # 석유 정제품 제조업
}

# 광공업생산지수 — 국가데이터처 101 / DT_1F02001 (분류1 = 시도, 분류2 = 산업)
MINING_MANUFACTURING_TABLE = ("101", "DT_1F02001")
MINING_MANUFACTURING_REGION = "00"   # 전국
# measure → 항목 코드 (원지수, 계절조정)
MINING_MANUFACTURING_MEASURES: Dict[str, tuple] = {
    "production": ("T10", "T20"),    # 생산지수
    "shipment": ("T11", "T21"),      # 생산자제품 출하지수
    "inventory": ("T12", "T22"),     # 생산자제품 재고지수 (선박은 없음)
}

# 가동률지수 — 국가데이터처 101 / DT_1F32001 (분류1 = 산업)
CAPACITY_UTILIZATION_TABLE = ("101", "DT_1F32001")
# measure → 항목 코드 (원지수, 계절조정). 생산능력지수는 계절조정이 없다
CAPACITY_UTILIZATION_MEASURES: Dict[str, tuple] = {
    "utilization": ("T20", "T30"),   # 가동률지수
    "capacity": ("T10", "T10"),      # 생산능력지수
}

# IT산업별 수출 — 과학기술정보통신부 127 / DT_092_115_2009_S023 (월간, 단위 달러)
ICT_EXPORTS_TABLE = ("127", "DT_092_115_2009_S023")
ICT_EXPORTS_ITEM = "13103131003T1"
ICT_EXPORTS_PREFIX = "13102131003A."   # 분류 코드 앞에 붙는 표 고유 접두사
ICT_EXPORTS_CATEGORIES: Dict[str, str] = {
    "ict_total": "AF10000000",            # 정보통신방송기기 합계
    "semiconductor": "AF11100000",        # 반도체
    "memory": "AF11111000",               # 메모리반도체
    "dram": "AF11111100",                 # DRAM
    "flash": "AF11111300",                # Flash 메모리
    "system_semiconductor": "AF11112000", # 시스템반도체
    "display": "AF11200000",              # 평판디스플레이
    "mobile_phone": "AF13121110",         # 휴대단말기(완제품)
    "computer": "AF12000000",             # 컴퓨터 및 주변기기
    "battery": "AF15542100",              # 축전지
}

# 품목별 수출입 (SITC) — 한국무역협회 360 / DT_1R11001_FRM101 (원 단위 천달러)
PRODUCT_TRADE_TABLE = ("360", "DT_1R11001_FRM101")
PRODUCT_TRADE_PREFIX = "13102112831A."
PRODUCT_TRADE_UNIT_SCALE = 1000   # 천달러 → 달러
PRODUCT_TRADE_FLOWS: Dict[str, str] = {
    "export": "13103112831T1",   # 수출액
    "import": "13103112831T2",   # 수입액
}
PRODUCT_TRADE_CATEGORIES: Dict[str, str] = {
    "total": "A",                    # 총액
    "passenger_car": "781",          # 승용자동차 및 기타의 차량
    "truck": "782",                  # 화물자동차 및 특수목적차량
    "ship": "793",                   # 선박 보트 및 부유구조물
    "battery": "77812",              # 축전지
    "battery_parts": "77819",        # 축전지의 부분품
    "memory": "77644",               # 메모리
    "semiconductor_device": "7763",  # 다이오드 · 트랜지스터 등 반도체 디바이스
    "tire_passenger": "6251",        # 승용자동차용 공기타이어
    "tire_truck": "6252",            # 버스 및 화물차용 공기타이어
}


# ── 파라미터 ──────────────────────────────────────────────────────────────────

def check_prd_se(v: Any) -> str:
    """수록주기 정규화 (대소문자 무관). QueryParams field_validator 에서 쓴다."""
    p = str(v or "M").upper()
    if p not in PRD_SE_CHOICES:
        raise ValueError(f"Invalid prd_se: {v}. Available: {', '.join(PRD_SE_CHOICES)}")
    return p


def check_choice(name: str, v: Any, choices: Dict[str, Any], default: str) -> str:
    """measure · flow 같은 단일 선택값 검증."""
    s = str(v or default).lower()
    if s not in choices:
        raise ValueError(f"Invalid {name}: {v}. Available: {', '.join(choices)}")
    return s


def check_categories(v: Any, choices: Dict[str, str]) -> str:
    """'semiconductor,battery' · 'all' 검증 → 쉼표로 이은 category 키. 모르는 키는 오류."""
    raw = [c.strip().lower() for c in str(v or "").split(",") if c.strip()]
    if not raw or raw == ["all"]:
        return ",".join(choices)
    unknown = [c for c in raw if c not in choices]
    if unknown:
        raise ValueError(f"Invalid category: {', '.join(unknown)}. Available: {', '.join(choices)}")
    return ",".join(raw)


def join_codes(categories: str, choices: Dict[str, str], prefix: str = "") -> str:
    """검증된 category 키들 → KOSIS 분류 코드 ('+' 로 이으면 요청 한 번에 받는다)."""
    return "+".join(prefix + choices[c] for c in categories.split(","))


def default_range(params: Dict[str, Any], years: int = 10) -> Dict[str, Any]:
    """기간을 안 주면 최근 N년 (KOSIS 는 시점을 안 주면 최신 1개만 준다)."""
    values = dict(params)
    today = date.today()
    if not values.get("start_date"):
        values["start_date"] = date(today.year - years, 1, 1)
    if not values.get("end_date"):
        values["end_date"] = today
    return values


# ── 시점 ──────────────────────────────────────────────────────────────────────

def to_period(d: date, prd_se: str) -> str:
    """날짜 → KOSIS 시점 문자열. M: YYYYMM · Q: YYYYQQ(01~04) · Y: YYYY."""
    p = prd_se.upper()
    if p == "M":
        return d.strftime("%Y%m")
    if p == "Q":
        return f"{d.year}{(d.month - 1) // 3 + 1:02d}"
    if p == "Y":
        return str(d.year)
    raise ValueError(f"Invalid prd_se: {prd_se}. Available: {', '.join(PRD_SE_CHOICES)}")


def from_period(prd_de: Any, prd_se: str) -> Optional[date]:
    """KOSIS 수록시점(PRD_DE) → 기간 첫날. 분기 '202402' 는 2024-04-01."""
    s = str(prd_de or "").strip()
    p = (prd_se or "").upper()
    try:
        if p == "M" and len(s) == 6:
            return date(int(s[:4]), int(s[4:]), 1)
        if p == "Q" and len(s) == 6:
            return date(int(s[:4]), (int(s[4:]) - 1) * 3 + 1, 1)
        if p == "Y" and len(s) >= 4:
            return date(int(s[:4]), 1, 1)
    except ValueError:
        return None
    return None


def shift_month(d: date, months: int) -> date:
    """d 가 속한 달의 첫날을 months 개월 이동."""
    y, m = divmod(d.month - 1 + months, 12)
    return date(d.year + y, m + 1, 1)


def lookback_start(start: Optional[date]) -> Optional[date]:
    """증감률용으로 1년 앞부터 받는다 — 요청 첫 시점의 yoy 가 비지 않게. 결과는 trim_before 로 자른다."""
    return shift_month(start, -12) if start else None


def trim_before(rows: List[Dict[str, Any]], start: Optional[date]) -> List[Dict[str, Any]]:
    """lookback 으로 더 받은 앞부분을 잘라 요청 기간만 남긴다 (start 가 속한 기간부터)."""
    if not start:
        return rows
    first = date(start.year, start.month, 1)
    return [r for r in rows if r["date"] >= first]


# ── 값 ────────────────────────────────────────────────────────────────────────

def to_float(v: Any) -> Optional[float]:
    """DT(수치값, 문자열) → float. 콤마 제거, 통계부호('-', 'x' 등)는 None."""
    if v in (None, ""):
        return None
    try:
        return float(str(v).replace(",", ""))
    except ValueError:
        return None


def to_unit(v: Any) -> Optional[str]:
    """UNIT_NM 정규화 — KOSIS 는 전각 기호를 섞어 준다 ('2020＝100' → '2020=100')."""
    s = str(v or "").strip().replace("＝", "=").replace("％", "%")
    return s or None


_STEP_MONTHS = {"M": 1, "Q": 3, "Y": 12}   # 직전 기간이 몇 달 전인가


def pct_change(now: Optional[float], before: Optional[float]) -> Optional[float]:
    """증감률(%). 어느 한쪽이 없거나 0이면 None."""
    if now is None or not before:
        return None
    return round((now / before - 1) * 100, 2)


def add_changes(rows: List[Dict[str, Any]], prd_se: str, key: str = "category") -> List[Dict[str, Any]]:
    """같은 key(category) 안에서 yoy(1년 전 같은 시점) · mom(직전 시점) 증감률(%) 을 붙인다.

    시점을 날짜로 찾는다 — 중간에 빠진 달이 있어도 엉뚱한 달과 비교하지 않는다(없으면 None).
    rows 는 date · value · key 를 가진 dict. 시점 · key 순으로 정렬해 돌려준다.
    """
    step = _STEP_MONTHS[prd_se.upper()]
    by_key: Dict[Any, Dict[date, Optional[float]]] = {}
    for r in rows:
        by_key.setdefault(r.get(key), {})[r["date"]] = r.get("value")
    for r in rows:
        values = by_key[r.get(key)]
        r["yoy"] = pct_change(r.get("value"), values.get(shift_month(r["date"], -12)))
        r["mom"] = pct_change(r.get("value"), values.get(shift_month(r["date"], -step)))
    return sorted(rows, key=lambda r: (r["date"], str(r.get(key))))

"""경기 국면 — 현재 레짐 · 레짐 이력 · 연준 정책 기조 · 필립스 곡선.

전년 대비(YoY)는 직접 계산하지 않고 FRED units=pc1 로 받는다 (CPI · 산업생산 · 비농업 고용).
실질 GDP 성장률(A191RL1Q225SBEA)은 원래 % 변화율 시리즈다.

현재 레짐과 레짐 이력은 분류 기준이 다르다 (현재: growth>0 & CPI<3.0 → goldilocks,
이력: growth>=0 & CPI<=2.5). 예전 동작 그대로 둔다.
"""
from datetime import date, datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple, Union

from pydantic import BaseModel, Field

from app.backend.commands._base import Rows
from app.backend.commands.macro.series import in_range, nearest, points, shift_month

GDP_GROWTH = "A191RL1Q225SBEA"     # 실질 GDP 성장률 (분기, 연율 %)
CPI = "CPIAUCSL"

GROWTH_THRESHOLD = 0.0
INFLATION_HIGH = 3.0


def _clamp(x: float, lo: float = -100.0, hi: float = 100.0) -> float:
    return max(lo, min(hi, x))


# ── 현재 레짐 ──────────────────────────────────────────────────────────────────

class RegimeCurrent(BaseModel):
    regime: str = Field(description="goldilocks / reflation / stagflation / deflation")
    growth_score: float = Field(description="성장 점수 (-100~100)")
    inflation_score: float = Field(description="인플레이션 점수 (-100~100, 2% 목표 중심)")
    growth_momentum: float = Field(description="GDP 성장률 직전 분기 대비 변화 (%p)")
    inflation_momentum: float = Field(description="CPI YoY 3개월 전 대비 변화 (%p)")
    timestamp: str
    cmp_gdp_growth: float = Field(description="최신 실질 GDP 성장률 (%)")
    cmp_industrial_production_yoy: float
    cmp_employment_yoy: float
    cmp_cpi_yoy: float
    gdp_date: Optional[str] = Field(default=None, description="GDP 기준 분기")
    cpi_date: Optional[str] = Field(default=None, description="CPI 기준 월")


def classify_regime(growth_score: float, cpi_yoy: float) -> str:
    if growth_score > GROWTH_THRESHOLD:
        return "goldilocks" if cpi_yoy < INFLATION_HIGH else "reflation"
    return "stagflation" if cpi_yoy > INFLATION_HIGH else "deflation"


def compute_regime(gdp: Rows, indpro_yoy: Rows, payroll_yoy: Rows, cpi_yoy: Rows) -> RegimeCurrent:
    """GDP 성장률 + 산업생산 · 고용 · CPI 의 YoY(pc1) → 레짐. 입력 순서는 상관없다 (날짜로 최신을 고른다)."""
    gdp_d, cpi_d = points(gdp, newest_first=True), points(cpi_yoy, newest_first=True)
    ip_d, emp_d = points(indpro_yoy, newest_first=True), points(payroll_yoy, newest_first=True)

    gdp_growth = gdp_d[0][1] if gdp_d else 0.0
    ip = ip_d[0][1] if ip_d else 0.0
    emp = emp_d[0][1] if emp_d else 0.0
    cpi = cpi_d[0][1] if cpi_d else 0.0

    growth_score = _clamp((gdp_growth / 5.0) * 100 * 0.5 + (ip / 10.0) * 100 * 0.25 + (emp / 3.0) * 100 * 0.25)
    inflation_score = _clamp((cpi - 2.0) / 6.0 * 100)
    growth_momentum = gdp_d[0][1] - gdp_d[1][1] if len(gdp_d) >= 2 else 0.0
    # 3개월 전 '날짜'의 YoY (결측월이 있어도 위치가 아닌 날짜 기준)
    cpi_3m_ago = dict(cpi_d).get(shift_month(cpi_d[0][0], -3)) if cpi_d else None
    inflation_momentum = cpi - cpi_3m_ago if cpi_3m_ago is not None else 0.0

    return RegimeCurrent(
        regime=classify_regime(growth_score, cpi),
        growth_score=round(growth_score, 2),
        inflation_score=round(inflation_score, 2),
        growth_momentum=round(growth_momentum, 2),
        inflation_momentum=round(inflation_momentum, 2),
        timestamp=datetime.now().isoformat(),
        cmp_gdp_growth=round(gdp_growth, 2),
        cmp_industrial_production_yoy=round(ip, 2),
        cmp_employment_yoy=round(emp, 2),
        cmp_cpi_yoy=round(cpi, 2),
        gdp_date=gdp_d[0][0] if gdp_d else None,
        cpi_date=cpi_d[0][0] if cpi_d else None,
    )



# ── 레짐 이력 ──────────────────────────────────────────────────────────────────

class RegimePoint(BaseModel):
    date: str
    regime: str
    growth_score: Optional[float] = None
    inflation_score: Optional[float] = None
    gdp_growth: Optional[float] = None
    cpi_yoy: Optional[float] = None


def classify_history(growth_score: float, cpi_yoy: float) -> str:
    if growth_score >= 0:
        return "goldilocks" if cpi_yoy <= 2.5 else "reflation"
    return "stagflation" if cpi_yoy > 2.5 else "deflation"


def regime_history_from(gdp: Rows, cpi_yoy: Rows, start: Optional[Any] = None,
                        end: Optional[Any] = None) -> Tuple[List[RegimePoint], List[Dict[str, str]]]:
    """분기마다 가장 가까운 달의 CPI YoY 로 분류 → (이력, 레짐이 바뀐 지점)."""
    cpi_in = [p for p in points(cpi_yoy) if in_range(p[0], start, end)]
    history: List[RegimePoint] = []
    transitions: List[Dict[str, str]] = []
    prev: Optional[str] = None
    for d, growth in points(gdp):
        if not in_range(d, start, end) or not cpi_in:
            continue
        cpi = nearest(cpi_in, d)[1]
        growth_score = _clamp(growth / 5.0 * 100)
        regime = classify_history(growth_score, cpi)
        history.append(RegimePoint(
            date=d, regime=regime, growth_score=round(growth_score, 2),
            inflation_score=round(_clamp((cpi - 2.0) / 6.0 * 100), 2),
            gdp_growth=round(growth, 2), cpi_yoy=round(cpi, 2),
        ))
        if prev and regime != prev:
            transitions.append({"date": d, "from": prev, "to": regime})
        prev = regime
    return history, transitions



# ── 필립스 곡선 ────────────────────────────────────────────────────────────────

class PhillipsPoint(BaseModel):
    date: str
    unemployment: float = Field(description="실업률 (%)")
    inflation: float = Field(description="CPI YoY (%)")


def phillips_from(unrate: Rows, cpi_yoy: Rows, start: Optional[Any] = None,
                  end: Optional[Any] = None) -> List[PhillipsPoint]:
    cpi_in = [p for p in points(cpi_yoy) if in_range(p[0], start, end)]
    if not cpi_in:
        return []
    return [PhillipsPoint(date=d, unemployment=round(u, 1), inflation=round(nearest(cpi_in, d)[1], 1))
            for d, u in points(unrate) if in_range(d, start, end)]



# ── 연준 정책 기조 ─────────────────────────────────────────────────────────────

class StanceRow(BaseModel):
    section: str = "Fed Policy"
    metric: str
    value: Optional[Union[float, int, str]] = None
    unit: Optional[str] = None


def compute_stance(rates: Rows, today: Optional[date] = None) -> List[StanceRow]:
    """기준금리 수준 · 추세로 hawkish / neutral / dovish.

    금리 인상 · 동결 · 인하 확률은 시장 가격(FedWatch 등)이 아니라 판정에 따른 고정 휴리스틱 값이다.
    """
    today = today or date.today()
    pts = sorted(({"date": str(r["date"])[:10], "rate": float(r["rate"])}
                  for r in rates if r.get("date") is not None and r.get("rate") is not None),
                 key=lambda r: r["date"], reverse=True)
    if len(pts) < 2:
        raise ValueError("Insufficient Fed Funds Rate data")
    current_rate, current_date = pts[0]["rate"], pts[0]["date"]

    recent = [r for r in pts if r["date"] >= str(today - timedelta(days=365))]
    changes_12m = sum(1 for a, b in zip(recent, recent[1:]) if abs(a["rate"] - b["rate"]) > 0.01)
    peak, trough = max(r["rate"] for r in pts), min(r["rate"] for r in pts)

    level_score = ((current_rate - 2.0) / 3.0) * 50
    three_m = [r for r in pts if r["date"] >= str(today - timedelta(days=90))]
    momentum = (three_m[0]["rate"] - three_m[-1]["rate"]) * 10 if len(three_m) >= 2 else 0
    score = _clamp(level_score + momentum)
    stance = "hawkish" if score > 30 else "dovish" if score < -30 else "neutral"

    if stance == "hawkish" and current_rate < peak - 0.5:
        probs = {"hike": 65, "hold": 30, "cut": 5}
    elif stance == "dovish" and current_rate > trough + 0.5:
        probs = {"hike": 5, "hold": 30, "cut": 65}
    else:
        probs = {"hike": 20, "hold": 60, "cut": 20}
    percentile = round((current_rate - trough) / (peak - trough) * 100, 1) if peak != trough else 50

    return [StanceRow(metric=m, value=v, unit=u) for m, v, u in (
        ("Stance", stance, ""),
        ("Stance Score", round(score, 2), "/100"),
        ("Fed Funds Rate", round(current_rate, 2), "%"),
        ("Target Lower", round(current_rate - 0.25, 2), "%"),
        ("Target Upper", round(current_rate, 2), "%"),
        ("Rate Changes 12M", changes_12m, "times"),
        ("Peak Rate", round(peak, 2), "%"),
        ("Trough Rate", round(trough, 2), "%"),
        ("Rate Percentile", percentile, "%"),
        ("Hike Prob", probs["hike"], "%"),
        ("Hold Prob", probs["hold"], "%"),
        ("Cut Prob", probs["cut"], "%"),
        ("Last Updated", current_date, ""),
    )]

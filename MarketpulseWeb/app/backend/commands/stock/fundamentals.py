"""재무 분석 — 해자(moat) · 분기 손익 · 스코어카드 · SWOT · 매출 세그먼트 전년 대비.

입력은 표준 모델(financials · key_metrics · revenue_segments)의 칸이라 provider 를 바꿔도 같은 계산이다.
비율은 %(소수 1자리), 금액은 십억 단위(소수 3자리) — 예전 yahoo 분석 fetcher 와 같은 응답 모양이다.
"""
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field

from app.backend.commands._base import Rows

BILLION = 1e9


def _ratio(num: Optional[float], den: Optional[float]) -> Optional[float]:
    """num / den × 100 (%), 소수 1자리. 값이 없거나 분모가 0 이면 None."""
    if num is None or not den:
        return None
    return round(num / den * 100, 1)


def _growth(cur: Optional[float], prev: Optional[float]) -> Optional[float]:
    """직전 대비 증감률 (%) — 직전이 음수여도 방향이 맞게 절댓값으로 나눈다."""
    if cur is None or not prev:
        return None
    return round((cur - prev) / abs(prev) * 100, 1)


def _by_date(rows: Rows) -> Rows:
    return sorted((r for r in rows if r.get("date") is not None), key=lambda r: str(r["date"]))


# ── 경제적 해자 ────────────────────────────────────────────────────────────────

class MoatYear(BaseModel):
    year: str
    roe: Optional[float] = None
    roic: Optional[float] = None
    gross_margin: Optional[float] = None
    op_margin: Optional[float] = None
    net_margin: Optional[float] = None
    fcf_margin: Optional[float] = None


class MoatData(BaseModel):
    symbol: str
    history: List[MoatYear] = Field(default_factory=list)
    moat_score: int = 0
    moat_type: str = "No Moat"


def moat_from_rows(symbol: str, rows: Rows) -> MoatData:
    """연간 재무제표 → 연도별 수익성 + ROE 15% 이상인 해 수로 해자 판정."""
    history: List[MoatYear] = []
    strong_years = 0
    for r in _by_date(rows):
        revenue = r.get("revenue")
        ocf, capex = r.get("operating_cash_flow"), r.get("capital_expenditure")
        fcf = ocf + capex if ocf is not None and capex is not None else r.get("free_cash_flow")
        equity, debt = r.get("stockholders_equity"), r.get("total_debt")
        invested = (equity or 0) + (debt or 0)
        roe = _ratio(r.get("net_income"), equity)
        if roe is not None and roe >= 15:
            strong_years += 1
        history.append(MoatYear(
            year=str(r["date"])[:4],
            roe=roe,
            roic=_ratio(r.get("operating_income"), invested),
            gross_margin=_ratio(r.get("gross_profit"), revenue),
            op_margin=_ratio(r.get("operating_income"), revenue),
            net_margin=_ratio(r.get("net_income"), revenue),
            fcf_margin=_ratio(fcf, revenue),
        ))

    if strong_years >= 7:
        moat_type, score = "Wide", min(100, 60 + strong_years * 5)
    elif strong_years >= 4:
        moat_type, score = "Narrow", 30 + strong_years * 5
    else:
        moat_type, score = "No Moat", strong_years * 5
    return MoatData(symbol=symbol, history=history, moat_score=score, moat_type=moat_type)



# ── 분기 손익 ──────────────────────────────────────────────────────────────────

_PNL_FIELDS = {
    "revenue": "revenue", "cogs": "cost_of_revenue", "gross": "gross_profit",
    "op_income": "operating_income", "net": "net_income",
    "rd": "research_and_development", "sga": "selling_general_admin",
}


class PnLQuarter(BaseModel):
    date: str
    revenue: Optional[float] = None
    cogs: Optional[float] = None
    gross: Optional[float] = None
    op_income: Optional[float] = None
    net: Optional[float] = None
    rd: Optional[float] = None
    sga: Optional[float] = None
    gross_margin: Optional[float] = None
    op_margin: Optional[float] = None
    net_margin: Optional[float] = None


class QuarterlyPnLData(BaseModel):
    symbol: str
    history: List[PnLQuarter] = Field(default_factory=list)
    latest: Dict[str, Any] = Field(default_factory=dict)
    yoy_revenue: Dict[str, float] = Field(default_factory=dict, description="분기 → 4분기 전 대비 매출 증감률(%)")


def quarterly_pnl_from_rows(symbol: str, rows: Rows, limit: int) -> QuarterlyPnLData:
    history: List[PnLQuarter] = []
    for r in _by_date(rows)[-limit:]:
        vals = {k: (round(r[src] / BILLION, 3) if r.get(src) is not None else None) for k, src in _PNL_FIELDS.items()}
        rev = vals["revenue"] if (vals["revenue"] or 0) > 0 else None
        history.append(PnLQuarter(
            date=str(r["date"])[:10], **vals,
            gross_margin=_ratio(vals["gross"], rev),
            op_margin=_ratio(vals["op_income"], rev),
            net_margin=_ratio(vals["net"], rev),
        ))
    yoy = {}
    for i in range(4, len(history)):
        g = _growth(history[i].revenue, history[i - 4].revenue)
        if g is not None:
            yoy[history[i].date] = g
    return QuarterlyPnLData(
        symbol=symbol, history=history, yoy_revenue=yoy,
        latest=history[-1].model_dump() if history else {},
    )



# ── 투자 스코어카드 ────────────────────────────────────────────────────────────

class ScorecardData(BaseModel):
    symbol: str
    overall_score: int = 0
    investment_grade: str = "N/A"
    categories: Dict[str, Any] = Field(default_factory=dict)
    outlook: Dict[str, Any] = Field(default_factory=dict)


def _cap(x: float) -> float:
    """0~1 로 자른다."""
    return max(0.0, min(x, 1.0))


def _score(x: float) -> int:
    return int(max(0, min(100, x)))


def _pct(v: Optional[float]) -> str:
    return f"{v * 100:.1f}%" if v else "N/A"


def _num(v: Optional[float], fmt: str = "{:.1f}") -> str:
    return fmt.format(v) if v else "N/A"


def _outlook(score: int) -> str:
    return "Positive" if score >= 60 else "Neutral" if score >= 30 else "Negative"


def _upside(m: Dict[str, Any]) -> Optional[float]:
    price, target = m.get("current_price"), m.get("target_mean_price")
    return (target - price) / price * 100 if price and target else None


def scorecard_from_metrics(symbol: str, m: Dict[str, Any]) -> ScorecardData:
    """주요 지표(key_metrics) 하나로 5개 범주 점수 → 가중 합 → 등급."""
    g = lambda k: m.get(k) or 0  # noqa: E731 — 없는 값은 0 점 처리

    roe, roa, op_m, net_m = g("roe"), g("roa"), g("operating_margin"), g("net_margin")
    fundamentals = _score(_cap(roe / 0.20) * 30 + _cap(roa / 0.10) * 20 + _cap(op_m / 0.25) * 30 + _cap(net_m / 0.15) * 20)

    rev_g, eps_g, eq_g = g("revenue_growth"), g("earnings_growth"), g("earnings_quarterly_growth")
    growth = _score(_cap(rev_g / 0.20) * 40 + _cap(eps_g / 0.25) * 40 + _cap(eq_g / 0.20) * 20)

    def cheap(v: float, ceiling: float) -> float:      # 낮을수록 높은 점수, 값이 없으면 중간
        return 100 - _cap(v / ceiling) * 100 if v > 0 else 50
    pe, pb, ev = g("pe_ratio"), g("pb_ratio"), g("ev_ebitda")
    valuation = int(cheap(pe, 30) * 0.4 + cheap(pb, 5) * 0.3 + cheap(ev, 20) * 0.3)

    rec = m.get("recommendation_mean") or 3
    upside = _upside(m) or 0
    analyst = max(0.0, 100 - (rec - 1) / 4 * 100)
    upside_score = max(0.0, min(100.0, 50 + upside * 2))
    sentiment = int(analyst * 0.6 + upside_score * 0.4)

    price, ma50, ma200 = g("current_price"), g("ma_50_day"), g("ma_200_day")
    if price and ma50 and ma200:
        technical = 100 if price > ma50 > ma200 else 60 if (price > ma50 or price > ma200) else 20
    else:
        technical = 0

    overall = int(fundamentals * 0.30 + growth * 0.25 + valuation * 0.20 + sentiment * 0.15 + technical * 0.10)
    grade = ("Strong Buy" if overall >= 80 else "Buy" if overall >= 65 else "Hold" if overall >= 45
             else "Sell" if overall >= 30 else "Strong Sell")

    return ScorecardData(
        symbol=symbol, overall_score=overall, investment_grade=grade,
        categories={
            "fundamentals": {"score": fundamentals, "detail": {
                "ROE": _pct(roe), "ROA": _pct(roa), "Op Margin": _pct(op_m)}},
            "growth": {"score": growth, "detail": {"Rev Growth": _pct(rev_g), "EPS Growth": _pct(eps_g)}},
            "valuation": {"score": valuation, "detail": {
                "P/E": _num(pe), "P/B": _num(pb), "EV/EBITDA": _num(ev)}},
            "sentiment": {"score": sentiment, "detail": {
                "Analyst Rating": f"{rec:.1f}/5", "Price Upside": f"+{upside:.1f}%" if upside > 0 else f"{upside:.1f}%"}},
            "technical": {"score": technical, "detail": {
                "50 MA": _num(ma50, "${:.2f}"), "200 MA": _num(ma200, "${:.2f}"),
                "Price vs MAs": "Above" if price > ma50 else "Below"}},
        },
        outlook={"short_term": _outlook(technical), "medium_term": _outlook(growth),
                 "long_term": _outlook(fundamentals)},
    )




# ── SWOT ──────────────────────────────────────────────────────────────────────

class SwotItem(BaseModel):
    label: str
    value: str
    type: str = Field(description="positive | negative")


class SwotData(BaseModel):
    symbol: str
    strengths: List[SwotItem] = Field(default_factory=list)
    weaknesses: List[SwotItem] = Field(default_factory=list)
    opportunities: List[SwotItem] = Field(default_factory=list)
    threats: List[SwotItem] = Field(default_factory=list)


def swot_from_metrics(symbol: str, m: Dict[str, Any]) -> SwotData:
    """주요 지표를 문턱값으로 강점 · 약점 · 기회 · 위협에 나눈다."""
    out = SwotData(symbol=symbol)
    pos = lambda bucket, label, value: bucket.append(SwotItem(label=label, value=value, type="positive"))  # noqa: E731
    neg = lambda bucket, label, value: bucket.append(SwotItem(label=label, value=value, type="negative"))  # noqa: E731

    # (지표, 강점 문턱 초과, 약점 문턱 미만, 강점 라벨, 약점 라벨)
    for key, hi, lo, good, bad in (
        ("roe", 0.15, 0.05, "High ROE", "Low ROE"),
        ("roa", 0.08, 0.02, "Strong ROA", "Low ROA"),
        ("operating_margin", 0.20, 0.05, "High Operating Margin", "Thin Operating Margin"),
        ("revenue_growth", 0.10, 0.0, "Revenue Growth", "Revenue Decline"),
    ):
        v = m.get(key)
        if v is None:
            continue
        if v > hi:
            pos(out.strengths, good, f"{v * 100:.1f}%")
        elif v < lo:
            neg(out.weaknesses, bad, f"{v * 100:.1f}%")

    fcf = m.get("free_cash_flow")
    if fcf and fcf > 0:
        pos(out.strengths, "Positive FCF", f"${fcf / 1e9:.1f}B")
    elif fcf and fcf < 0:
        neg(out.weaknesses, "Negative FCF", f"${fcf / 1e9:.1f}B")

    de = m.get("debt_to_equity")
    if de is not None:
        if de > 100:
            neg(out.weaknesses, "High Debt/Equity", f"{de:.0f}%")
            neg(out.threats, "Leverage Risk", f"D/E {de:.0f}%")
        elif de < 30:
            pos(out.strengths, "Low Leverage", f"D/E {de:.0f}%")

    eps_g = m.get("earnings_growth")
    if eps_g is not None and eps_g > 0.15:
        pos(out.opportunities, "EPS Growth Trend", f"{eps_g * 100:.1f}%")

    upside = _upside(m)
    if upside is not None:
        if upside > 15:
            pos(out.opportunities, "Analyst Upside", f"+{upside:.1f}%")
        elif upside < -10:
            neg(out.threats, "Analyst Downside", f"{upside:.1f}%")

    beta = m.get("beta")
    if beta is not None:
        if beta > 1.5:
            neg(out.threats, "High Volatility", f"Beta {beta:.2f}")
        elif beta < 0.7:
            pos(out.strengths, "Low Volatility", f"Beta {beta:.2f}")

    cap = m.get("market_cap")
    if cap and cap > 100e9:
        pos(out.strengths, "Large Cap Stability", f"${cap / 1e9:.0f}B")

    fwd, trailing = m.get("forward_pe"), m.get("pe_ratio")
    if fwd and trailing and fwd < trailing * 0.85:
        pos(out.opportunities, "Improving Earnings Outlook", f"Fwd PE {fwd:.1f}")
    return out



# ── 매출 세그먼트 전년 대비 ────────────────────────────────────────────────────

def add_segment_yoy(row: Dict[str, Any]) -> Dict[str, Any]:
    """revenue_segments 행의 product · geo 마다 최신 연도 vs 직전 연도 증감률(yoy)을 채운다."""
    for kind in ("product", "geo"):
        detail = row.get(kind)
        if not detail:
            continue
        hist = detail.get("history") or []
        latest = hist[-1] if hist else {}
        prior = hist[-2] if len(hist) >= 2 else {}
        detail["yoy"] = {seg: _growth(latest.get(seg), prior.get(seg)) for seg in detail.get("segments") or []}
    return row



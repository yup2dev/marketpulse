"""금융 여건 · 시장 심리 — 스냅샷 대시보드와 공포/탐욕 이력."""
from typing import Dict, List, Optional

from pydantic import BaseModel, Field

from app.backend.commands._base import Rows
from app.backend.commands.macro.series import DashboardRow, points, yoy_at

# ── 금융 여건 ──────────────────────────────────────────────────────────────────

CONDITIONS_SERIES = [
    ("nfci",         "NFCI",          1),
    ("bbb",          "BAMLC0A4CBBB",  1),
    ("aaa",          "BAMLC0A1CAAA",  1),
    ("hy",           "BAMLH0A0HYM2",  1),
    ("credit_total", "TOTALSL",       14),     # 전년 대비를 날짜로 찾는다
    ("cc_delinq",    "DRCCLACBS",     1),
    ("loan_delinq",  "DRCLACBS",      1),
    ("mtg_delinq",   "DRSFRMACBS",    1),
]


def conditions_rows(data: Dict[str, Rows]) -> List[DashboardRow]:
    pts = {k: points(v, newest_first=True) for k, v in data.items()}
    last = {k: (p[0][1] if p else None) for k, p in pts.items()}
    rows: List[DashboardRow] = []

    nfci = last.get("nfci")
    if nfci is not None:
        status = "very_tight" if nfci > 0.5 else "tight" if nfci > 0 else "neutral" if nfci > -0.5 else "loose"
        rows.append(DashboardRow(section="FCI", metric="Chicago Fed NFCI", value=round(nfci, 2), unit="", status=status))

    aaa, hy, bbb = last.get("aaa"), last.get("hy"), last.get("bbb")
    if aaa is not None:
        rows.append(DashboardRow(section="Credit Spreads", metric="Investment Grade (AAA)",
                                 value=round(aaa * 100, 0), unit="bps"))
    if hy is not None:
        rows.append(DashboardRow(section="Credit Spreads", metric="High Yield OAS", value=round(hy, 0), unit="bps",
                                 percentile=round(max(0.0, min(100.0, (hy - 200) / 800 * 100)), 1)))
    if bbb is not None:
        rows.append(DashboardRow(section="Credit Spreads", metric="BBB Treasury", value=round(bbb * 100, 0), unit="bps"))

    credit = pts.get("credit_total", [])
    if credit:
        growth = yoy_at(dict(credit), credit[0][0])
        if growth is not None:
            rows.append(DashboardRow(section="Consumer Health", metric="Credit Growth YoY",
                                     value=round(growth, 2), unit="%"))

    for key, label in (("cc_delinq", "CC Delinquency"), ("loan_delinq", "Consumer Loan Delinquency"),
                       ("mtg_delinq", "Mortgage Delinquency")):
        if last.get(key) is not None:
            rows.append(DashboardRow(section="Consumer Health", metric=label, value=round(last[key], 2), unit="%"))
    return rows



# ── 공포 / 탐욕 ────────────────────────────────────────────────────────────────

def vix_score(v: float) -> float:
    if v < 15:
        return 100 - ((v - 10) / 5) * 30
    if v < 20:
        return 70 - ((v - 15) / 5) * 40
    if v < 30:
        return 30 - ((v - 20) / 10) * 20
    return max(0.0, 10 - ((v - 30) / 10) * 10)


def hy_score(v: float) -> float:
    if v < 300:
        return 100 - ((300 - v) / 100) * 20
    if v < 500:
        return 80 - ((v - 300) / 200) * 50
    return max(0.0, 30 - ((v - 500) / 500) * 30)


def fear_greed_label(score: float) -> str:
    return ("extreme_fear" if score < 20 else "fear" if score < 40 else "neutral" if score < 60
            else "greed" if score < 80 else "extreme_greed")


def sentiment_rows(data: Dict[str, Rows]) -> List[DashboardRow]:
    """VIX · HY 스프레드 · 10년물 금리(최근 20개 평균 대비)를 점수로 → 평균이 공포/탐욕 지수."""
    rows: List[DashboardRow] = []
    scores: List[float] = []

    vix = points(data.get("vix", []), newest_first=True)
    if vix:
        v = vix[0][1]
        s = round(vix_score(v), 1)
        status = "low" if v < 15 else "normal" if v < 20 else "elevated" if v < 30 else "high"
        rows.append(DashboardRow(section="Components", metric="VIX", value=round(v, 2), unit="", score=s,
                                 percentile=round(max(0.0, min(100.0, (v - 10) / 70 * 100)), 1), status=status))
        scores.append(s)

    hy = points(data.get("hy", []), newest_first=True)
    if hy:
        s = round(hy_score(hy[0][1]), 1)
        rows.append(DashboardRow(section="Components", metric="High Yield Spread", value=round(hy[0][1], 0),
                                 unit="bps", score=s))
        scores.append(s)

    dgs10 = points(data.get("dgs10", []), newest_first=True)
    if len(dgs10) >= 2:
        cur = dgs10[0][1]
        avg = sum(v for _, v in dgs10) / len(dgs10)
        s = round(max(0.0, min(100.0, 50 - (cur - avg) * 10)), 1)
        rows.append(DashboardRow(section="Components", metric="Safe Haven Demand", value=round(cur, 2),
                                 unit="%", score=s))
        scores.append(s)

    if scores:
        fg = round(sum(scores) / len(scores), 1)
        rows.insert(0, DashboardRow(section="Fear & Greed", metric="Index", value=fg, unit="/100",
                                    status=fear_greed_label(fg)))
    return rows



class SentimentPoint(BaseModel):
    date: str
    vix: Optional[float] = None
    hy_spread: Optional[float] = Field(default=None, description="하이일드 스프레드 (FRED 값 그대로)")
    fear_greed_score: Optional[float] = Field(default=None, description="0~100")


def sentiment_history_from(vix_rows: Rows, hy_rows: Rows) -> List[SentimentPoint]:
    vix, hy = dict(points(vix_rows)), dict(points(hy_rows))
    out = []
    for d in sorted(set(vix) | set(hy)):
        v, h = vix.get(d), hy.get(d)
        scores = [f(x) for f, x in ((vix_score, v), (hy_score, h)) if x is not None]
        out.append(SentimentPoint(date=d, vix=round(v, 2) if v is not None else None,
                                  hy_spread=round(h, 2) if h is not None else None,
                                  fear_greed_score=round(sum(scores) / len(scores), 1)))
    return out

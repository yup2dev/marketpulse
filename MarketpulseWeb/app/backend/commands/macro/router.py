"""Macro Economic API — OpenBB 식 command 라우터 (/api/macro).

  - 단순 조회는 여기 두지 않는다 — 게이트웨이 /api/data/{provider}/{model} (수익률 곡선 · PMI · 경제 캘린더 …)
  - 가공 command  : @router.command(inputs=...) — inputs 가 받을 모델을 정하고 CommandRunner 가 병렬로 조회한 뒤
                    commands/ 의 순수 함수(rows → 결과)에 넘긴다. 함수 안에서는 조회하지 않는다
  - 오류 응답(424 키 없음 · 503 Fetcher 미접속)은 등록할 때 씌우는 API 래퍼가 한 곳에서 맞춘다 (api/command_map.py)

가공 command 경로는 예전 그대로다 (기본 위젯 · 프론트가 쓴다).
"""
from datetime import date as date_type
from typing import Dict, Optional

from fastapi import HTTPException

from data_fetcher.core import Fetch, OBBject, Router
from data_fetcher.utils.helpers import parse_period_to_dates
from app.backend.commands.macro import fx
from app.backend.commands.macro import inflation
from app.backend.commands.macro import labor
from app.backend.commands.macro import indicators as macro
from app.backend.commands.macro import conditions
from app.backend.commands.macro import regime
from app.backend.constants.macro_catalog import FX_PAIRS, INDICATORS, MACRO_SERIES

router = Router(prefix="", tags=["macro"], description="Macro economic data.")

FRED = "fred"
SENTIMENT_SERIES = [("vix", "VIXCLS", 1), ("hy", "BAMLH0A0HYM2", 1), ("dgs10", "DGS10", 20)]


def series(**params) -> Fetch:
    """FRED 시리즈 하나 — series_id · units · limit · sort_order · start/end_date."""
    required = params.pop("required", False)
    return Fetch(FRED, "series", params, required=required)


def _range(period: str) -> Dict[str, date_type]:
    start, end = parse_period_to_dates(period)
    return {"start_date": start, "end_date": end}


# ══ 가공 command — inputs 조회 → 순수 함수 ═════════════════════════════════════════

# ── 지표 · 시리즈 개요 ────────────────────────────────────────────────────────

@router.command(path="/indicators/overview",
                inputs=lambda: {key: Fetch(FRED, model, params) for key, (model, _n, _u, params) in INDICATORS.items()})
def indicators_overview(data):
    """주요 지표 6개의 최신값 · 직전 대비 (fred 는 서버에서 사용자 키로 직접 호출)."""
    return macro.indicator_overview(data, {k: unit for k, (_m, _n, unit, _p) in INDICATORS.items()})


def _indicator_input(indicator_key: str, period: str = "5y"):
    if indicator_key not in INDICATORS:
        raise HTTPException(status_code=400, detail=f"Invalid indicator. Valid: {', '.join(INDICATORS)}")
    model, _name, _unit, params = INDICATORS[indicator_key]
    return {"rows": Fetch(FRED, model, {**params, **_range(period)}, required=True)}


@router.command(path="/indicators/{indicator_key}/history", inputs=_indicator_input)
def indicator_history(data):
    return macro.dated_values(data["rows"], digits=2)


CATALOG = [macro.SeriesSpec(key, sid, name, category, unit) for key, (sid, name, category, unit) in MACRO_SERIES.items()]


@router.command(path="/fred/series", inputs=lambda date=None: {"rows": series(
    series_id=",".join(s.series_id for s in CATALOG), limit=2, sort_order="desc", end_date=date, required=True)})
def fred_series_overview(data, date: Optional[str] = None):
    """추가 시리즈 전부의 최신값 · 직전 대비 — 한 요청. date = 기준일 (비우면 최신)."""
    return macro.series_overview(data["rows"], CATALOG)


def _series_input(series_key: str, period: str = "5y"):
    if series_key not in MACRO_SERIES:
        raise HTTPException(status_code=400, detail=f"Invalid series. Valid: {', '.join(MACRO_SERIES)}")
    return {"rows": series(series_id=MACRO_SERIES[series_key][0], sort_order="asc", required=True, **_range(period))}


@router.command(path="/fred/series/{series_key}", inputs=_series_input)
def fred_series_history(data):
    return macro.dated_values(data["rows"])


@router.command(path="/financial-conditions/history", inputs=lambda period="5y": {
    "rows": series(series_id="NFCI", sort_order="asc", required=True, **_range(period))})
def financial_conditions_history(data):
    """Chicago Fed NFCI 시계열."""
    return macro.dated_values(data["rows"], digits=4)


# ── 환율 ──────────────────────────────────────────────────────────────────────

@router.command(path="/forex/rates", inputs=lambda: {
    f"{b}/{q}": Fetch("alphavantage", "forex", {"from_currency": b, "to_currency": q, "interval": "daily"})
    for b, q, _name in FX_PAIRS})
def forex_rates(data):
    """주요 통화쌍 5개의 최신 종가 · 전일 대비."""
    return fx.latest_rates(data, {f"{b}/{q}": name for b, q, name in FX_PAIRS})


# ── 경기 국면 ─────────────────────────────────────────────────────────────────
# YoY 는 FRED units=pc1 로 받는다 (CPI · 산업생산 · 비농업 고용)

def _regime_inputs():
    recent = {"sort_order": "desc", "limit": 8}
    return {
        "gdp": series(series_id=regime.GDP_GROWTH, required=True, **recent),
        "indpro": series(series_id="INDPRO", units="pc1", **recent),
        "payroll": series(series_id="PAYEMS", units="pc1", **recent),
        "cpi": series(series_id=regime.CPI, units="pc1", required=True, **recent),
    }


@router.command(path="/regime/current", inputs=_regime_inputs)
def regime_current(data):
    return [regime.compute_regime(data["gdp"], data["indpro"], data["payroll"], data["cpi"])]


@router.command(path="/regime/history", inputs=lambda period="5y": {
    "gdp": series(series_id=regime.GDP_GROWTH, sort_order="asc"),
    "cpi": series(series_id=regime.CPI, units="pc1", sort_order="asc")})
def regime_history(data, period: str = "5y"):
    hist, transitions = regime.regime_history_from(data["gdp"], data["cpi"], *_range(period).values())
    return hist, {"transitions": transitions}


@router.command(path="/fed-policy/stance", inputs=lambda: {
    "rates": Fetch(FRED, "interest_rate", {"rate_type": "federal_funds"}, required=True)})
def fed_policy_stance(data):
    return regime.compute_stance(data["rates"])


@router.command(path="/labor/history", inputs=lambda period="5y": {
    "unemployment": series(series_id="UNRATE", sort_order="asc"),
    "cpi": series(series_id=regime.CPI, units="pc1", sort_order="asc")})
def phillips_curve(data, period: str = "5y"):
    """필립스 곡선 — 실업률 vs CPI YoY."""
    return regime.phillips_from(data["unemployment"], data["cpi"], *_range(period).values())


# ── 인플레이션 ────────────────────────────────────────────────────────────────

def _decomposition_inputs(date: Optional[date_type] = None):
    def one(sid: str, limit: int) -> Fetch:
        return series(series_id=sid, limit=limit, sort_order="desc", end_date=date)
    index_ids = [sid for _, sid, _ in inflation.COMPONENTS] + list(inflation.INDEX_SERIES.values())
    return {**{sid: one(sid, 14) for sid in index_ids},
            **{sid: one(sid, 5) for sid in inflation.RATE_SERIES.values()}}


@router.command(path="/inflation/decomposition", inputs=_decomposition_inputs)
def inflation_decomposition(data):
    """CPI 구성요소별 YoY · 헤드라인 기여도. date = 기준일 (비우면 최신 발표월)."""
    return inflation.decomposition_from(data)


@router.command(path="/inflation/sector-history", inputs=lambda period="5y": {
    "rows": series(series_id=",".join(inflation.SECTOR_SERIES.values()), units="pc1", sort_order="asc",
                   required=True, **_range(period))})
def inflation_sector(data):
    return inflation.sector_from(data["rows"])


def _momentum_inputs(period: str = "3y"):
    rng = _range(period)
    from app.backend.commands.macro.series import shift_month
    lookback = shift_month(rng["start_date"].isoformat(), -13)   # 12개월 전 값이 있어야 첫 점이 나온다
    return {"rows": series(series_id=inflation.INDEX_SERIES["headline"], sort_order="asc", required=True,
                           start_date=lookback, end_date=rng["end_date"])}


@router.command(path="/overview/inflation-momentum", inputs=_momentum_inputs)
def inflation_momentum(data, period: str = "3y"):
    return inflation.momentum_from(data["rows"], _range(period)["start_date"])


# ── 노동 ──────────────────────────────────────────────────────────────────────

def _snapshot(table):
    """스냅샷 inputs — 시리즈마다 기준일(date) 이전 최근 관측 n 개. date 를 비우면 최신."""
    def inputs(date: Optional[date_type] = None):
        return {key: series(series_id=sid, limit=n, sort_order="desc", end_date=date) for key, sid, n in table}
    return inputs


@router.command(path="/labor/dashboard", inputs=_snapshot(labor.LABOR_SERIES))
def labor_dashboard(data):
    """노동시장 스냅샷. date = 기준일 (비우면 최신)."""
    return labor.labor_rows(data)


@router.command(path="/overview/jobs-breakdown", inputs=lambda period="5y": {
    "private": series(series_id="USPRIV", sort_order="asc", **_range(period)),
    "government": series(series_id="USGOVT", sort_order="asc", **_range(period))})
def jobs_breakdown(data):
    return labor.jobs_from(data["private"], data["government"])


# ── 금융 여건 · 심리 ──────────────────────────────────────────────────────────

@router.command(path="/financial-conditions", inputs=_snapshot(conditions.CONDITIONS_SERIES))
def financial_conditions(data):
    return conditions.conditions_rows(data)


@router.command(path="/sentiment/composite", inputs=_snapshot(SENTIMENT_SERIES))
def sentiment_composite(data):
    """공포/탐욕 지수 — VIX · HY 스프레드 · 10년물."""
    return conditions.sentiment_rows(data)


@router.command(path="/sentiment/history", inputs=lambda period="5y": {
    "vix": series(series_id="VIXCLS", sort_order="asc", **_range(period)),
    "hy": series(series_id="BAMLH0A0HYM2", sort_order="asc", **_range(period))})
def sentiment_history(data):
    return conditions.sentiment_history_from(data["vix"], data["hy"])


# ══ 정적 ═══════════════════════════════════════════════════════════════════════

# 금 · 은 시리즈가 FRED 에서 내려가 비율을 계산할 수 없다 — 빈 결과 (화면 호환용으로 주소만 남긴다)
@router.command(path="/commodities/ratios")
def commodity_ratios():
    return OBBject(results=[], provider=FRED)


@router.command(path="/commodities/ratios/{ratio_type}")
def commodity_ratio_history(ratio_type: str, period: str = "5y"):
    return OBBject(results=[], provider=FRED)


CATEGORIES = [
    {"id": "economic_indicators", "name": "Economic Indicators", "description": "Core macroeconomic indicators",
     "indicators": ["GDP", "Unemployment", "CPI", "Fed Funds Rate", "Retail Sales", "Consumer Sentiment"]},
    {"id": "banking_credit", "name": "Banking & Credit", "description": "Banking sector and credit data",
     "indicators": ["Total Bank Loans", "Foreign Bank Assets", "Consumer Credit"]},
    {"id": "money_supply", "name": "Money Supply", "description": "Monetary aggregates", "indicators": ["M1", "M2"]},
    {"id": "interest_rates", "name": "Interest Rates", "description": "Treasury and market rates",
     "indicators": ["10-Year Treasury", "2-Year Treasury", "Fed Funds Rate"]},
    {"id": "trade", "name": "International Trade", "description": "Trade balance and forex",
     "indicators": ["Trade Balance", "Major Forex Pairs"]},
    {"id": "real_estate", "name": "Real Estate", "description": "Housing market data",
     "indicators": ["Case-Shiller Index", "Housing Starts"]},
    {"id": "commodities", "name": "Commodities", "description": "Commodity prices and ratios",
     "indicators": ["Gold", "Silver", "Crude Oil (WTI)", "Gold/Silver Ratio", "Copper/Gold Ratio"]},
]


@router.command(path="/categories")
def categories():
    return OBBject(results=CATEGORIES, provider="static")

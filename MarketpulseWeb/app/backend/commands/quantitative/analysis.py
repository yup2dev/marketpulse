"""계량 분석 — 기술 통계 · 정규성 검정 · CAPM · 롤링 지표 · 단위근(ADF) · 상관행렬.

순수 함수다 — 입력은 일봉 시세(stock_price 표준 모델) 행. 시세 조회는 라우터의 command inputs 를 CommandRunner 가
한다 (서버에서는 yahoo 가 사용자 PC Fetcher 로 위임되고, 꺼져 있으면 503). 시세 캐시는 stock_price 모델 TTL.

scipy · statsmodels 는 무거워서(+35MB · +65MB) 처음 쓸 때 import 한다.
"""
from datetime import date as date_type, datetime, timedelta
from typing import Any, Dict, List, Literal, Optional, Tuple

import numpy as np
import pandas as pd
from pydantic import BaseModel, Field

from app.backend.commands._base import Rows

Target = Literal["close", "open", "high", "low", "adj_close", "return"]
_PRICE_COLS = ("open", "high", "low", "close", "adj_close")
TRADING_DAYS = 252


# ── 시세 → 시계열 ─────────────────────────────────────────────────────────────

def prices_to_frame(rows: Rows) -> pd.DataFrame:
    """stock_price 행 → date 인덱스 OHLC DataFrame (같은 날짜는 마지막 행)."""
    recs = [{"date": pd.Timestamp(str(r["date"])[:10]), **{c: r.get(c) for c in _PRICE_COLS}}
            for r in rows if r.get("date") is not None]
    if not recs:
        return pd.DataFrame()
    return pd.DataFrame(recs).drop_duplicates("date", keep="last").set_index("date").sort_index().astype(float)


def series_from_frame(df: pd.DataFrame, symbol: str, target: str) -> Tuple[pd.Series, pd.Series]:
    """OHLC → (분석 대상 시계열, 일간 수익률). target='return' 이면 대상도 수익률."""
    if df.empty or "close" not in df:
        raise ValueError(f"No price data for {symbol}")
    returns = df["close"].dropna().pct_change().dropna()
    if target == "return":
        series = returns
    else:
        col = target if target in df.columns and not df[target].dropna().empty else "close"
        series = df[col].dropna()
    if len(series) < 2:
        raise ValueError(f"Insufficient data for {symbol} (got {len(series)} points)")
    return series, returns


def _day(d: Any) -> Optional[datetime]:
    if d is None:
        return None
    if isinstance(d, datetime):
        return d
    if isinstance(d, date_type):
        return datetime.combine(d, datetime.min.time())
    return datetime.strptime(str(d)[:10], "%Y-%m-%d")


def price_params(symbol: str, start: Any = None, end: Any = None) -> Dict[str, Any]:
    """기본 기간: 종료일 기준 2년. yfinance history(end=)는 종료일 미포함이라 +1일."""
    e = _day(end) or datetime.now()
    s = _day(start) or (e - timedelta(days=365 * 2))
    return {"symbol": symbol, "start_date": s.strftime("%Y-%m-%d"),
            "end_date": (e + timedelta(days=1)).strftime("%Y-%m-%d"), "interval": "1d"}



def to_returns(series: pd.Series) -> pd.Series:
    """이미 수익률(절댓값 < 1)이면 그대로, 아니면 일간 수익률로."""
    s = series.dropna()
    return s if (s.abs() < 1.0).all() else s.pct_change().dropna()


def _rf_daily(rf_annual: float) -> float:
    return (1.0 + rf_annual) ** (1.0 / TRADING_DAYS) - 1.0


# ── 기술 통계 ─────────────────────────────────────────────────────────────────

class SummaryData(BaseModel):
    symbol: str
    target: str
    count: int
    mean: float
    std: float
    min: float
    max: float
    p_25: float
    p_50: float
    p_75: float
    skew: float
    kurtosis: float = Field(description="excess kurtosis (Fisher)")


def summarize(symbol: str, target: str, series: pd.Series) -> SummaryData:
    from scipy import stats
    x = series.values
    return SummaryData(
        symbol=symbol, target=target, count=int(len(x)), mean=float(series.mean()),
        std=float(series.std(ddof=1)), min=float(series.min()), max=float(series.max()),
        p_25=float(series.quantile(0.25)), p_50=float(series.quantile(0.50)), p_75=float(series.quantile(0.75)),
        skew=float(stats.skew(x, bias=False)), kurtosis=float(stats.kurtosis(x, fisher=True, bias=False)),
    )



# ── 정규성 검정 ───────────────────────────────────────────────────────────────

ALPHA = 0.05


class NormalityTest(BaseModel):
    test: str
    statistic: float
    p_value: float
    normal: bool = Field(description="α=0.05 에서 정규분포 가설을 기각하지 못하면 True")


class NormalityData(BaseModel):
    symbol: str
    target: str
    n: int
    tests: List[NormalityTest]


def normality_tests(x: np.ndarray) -> List[NormalityTest]:
    from scipy import stats
    nan = (np.nan, np.nan)
    z = (x - x.mean()) / (x.std(ddof=1) or 1.0)
    results = [
        ("kurtosis", stats.kurtosistest(x) if len(x) >= 20 else nan),
        ("skewness", stats.skewtest(x) if len(x) >= 8 else nan),
        ("jarque_bera", stats.jarque_bera(x)),
        ("shapiro_wilk", stats.shapiro(x)),
        ("kolmogorov_smirnov", stats.kstest(z, "norm")),     # N(평균, 표준편차) 대비
    ]
    out = []
    for name, (stat, p) in results:
        stat = None if np.isnan(stat) else float(stat)
        p = None if np.isnan(p) else float(p)
        out.append(NormalityTest(test=name, statistic=stat or 0.0, p_value=p or 0.0,
                                 normal=p is not None and p >= ALPHA))
    return out



# ── CAPM ──────────────────────────────────────────────────────────────────────

class CAPMData(BaseModel):
    symbol: str
    benchmark: str
    n: int
    alpha: float = Field(description="Jensen alpha (연율)")
    beta: float
    r_squared: float
    correlation: float
    systematic_risk: float = Field(description="β² · σ²(market) (연율)")
    unsystematic_risk: float = Field(description="잔차 분산 (연율)")
    total_risk: float = Field(description="수익률 분산 (연율)")
    annualised_return: float
    annualised_volatility: float
    sharpe_ratio: float


def capm_from_returns(symbol: str, benchmark: str, asset: pd.Series, market: pd.Series, rf_annual: float) -> CAPMData:
    from scipy import stats
    df = pd.concat({"asset": asset, "mkt": market}, axis=1, join="inner").dropna()
    if len(df) < 30:
        raise ValueError(f"Need ≥30 overlapping observations for CAPM (got {len(df)}).")
    rf = _rf_daily(rf_annual)
    ex_a, ex_m = df["asset"] - rf, df["mkt"] - rf
    slope, intercept, r_value, _, _ = stats.linregress(ex_m.values, ex_a.values)
    beta = float(slope)
    var_m = float(ex_m.var(ddof=1) * TRADING_DAYS)
    var_a = float(ex_a.var(ddof=1) * TRADING_DAYS)
    systematic = beta ** 2 * var_m
    ann_ret = float(df["asset"].mean() * TRADING_DAYS)
    ann_vol = float(df["asset"].std(ddof=1) * np.sqrt(TRADING_DAYS))
    return CAPMData(
        symbol=symbol, benchmark=benchmark, n=int(len(df)),
        alpha=(1.0 + float(intercept)) ** TRADING_DAYS - 1.0, beta=beta, r_squared=float(r_value ** 2),
        correlation=float(np.corrcoef(ex_a.values, ex_m.values)[0, 1]),
        systematic_risk=systematic, unsystematic_risk=max(var_a - systematic, 0.0), total_risk=var_a,
        annualised_return=ann_ret, annualised_volatility=ann_vol,
        sharpe_ratio=float((ann_ret - rf_annual) / ann_vol) if ann_vol > 0 else 0.0,
    )



# ── 롤링 지표 ─────────────────────────────────────────────────────────────────

RollingMetric = Literal["sharpe", "sortino", "stdev", "mean", "skew", "kurtosis", "quantile"]


class RollingPoint(BaseModel):
    date: date_type
    value: Optional[float]


class RollingData(BaseModel):
    symbol: str
    target: str
    metric: str
    window: int
    points: List[RollingPoint]


def rolling_metric(data: pd.Series, metric: str, window: int, rf_annual: float = 0.04,
                   quantile_pct: float = 0.5) -> pd.Series:
    roll = data.rolling(window)
    if metric in ("sharpe", "sortino"):
        excess_mean = (data - _rf_daily(rf_annual)).rolling(window).mean()
        spread = (roll.std(ddof=1) if metric == "sharpe"
                  else data.where(data < 0, 0.0).rolling(window).std(ddof=1))   # sortino: 하락분만
        return (excess_mean / spread) * np.sqrt(TRADING_DAYS)
    calc = {"stdev": lambda: roll.std(ddof=1), "mean": roll.mean, "skew": roll.skew, "kurtosis": roll.kurt,
            "quantile": lambda: roll.quantile(quantile_pct)}
    if metric not in calc:
        raise ValueError(f"Unknown metric: {metric}")
    return calc[metric]()



# ── 단위근 (ADF) ──────────────────────────────────────────────────────────────

class UnitRootData(BaseModel):
    symbol: str
    target: str
    n: int
    test: str = "adf"
    statistic: float
    p_value: float
    used_lag: int
    n_obs: int
    critical_1pct: float
    critical_5pct: float
    critical_10pct: float
    stationary: bool = Field(description="p_value < 0.05")


def adf(symbol: str, target: str, series: pd.Series, regression: str = "c") -> UnitRootData:
    if len(series) < 30:
        raise ValueError(f"ADF needs ≥30 obs (got {len(series)})")
    from statsmodels.tsa.stattools import adfuller
    stat, p, used_lag, n_obs, crit, _ = adfuller(series.values, regression=regression, autolag="AIC")
    return UnitRootData(
        symbol=symbol, target=target, n=int(len(series)), statistic=float(stat), p_value=float(p),
        used_lag=int(used_lag), n_obs=int(n_obs), critical_1pct=float(crit["1%"]),
        critical_5pct=float(crit["5%"]), critical_10pct=float(crit["10%"]), stationary=bool(p < 0.05),
    )



# ── 상관행렬 ──────────────────────────────────────────────────────────────────

class CorrelationData(BaseModel):
    labels: List[str] = Field(description="행렬 행/열 순서의 종목 코드")
    matrix: List[List[float]] = Field(description="일간수익률 피어슨 상관계수")
    rows: int = Field(description="상관 계산에 쓴 공통 거래일 수")
    missing: List[str] = Field(default_factory=list, description="시세가 없어 뺀 종목")


def closes_from_prices(rows: Rows) -> Dict[str, float]:
    return {str(r["date"])[:10]: float(r["close"]) for r in rows
            if r.get("date") is not None and r.get("close") is not None}


def correlation_matrix(closes: Dict[str, Dict[str, float]]) -> Dict[str, Any]:
    series = {sym: pd.Series(c) for sym, c in closes.items() if c}
    if len(series) < 2:
        raise ValueError("Insufficient price data for correlation")
    returns = pd.DataFrame(series).sort_index().pct_change().dropna()
    if returns.shape[0] < 2:
        raise ValueError("Insufficient data for correlation")
    corr = returns.corr()
    labels = list(corr.columns)
    matrix = [[round(float(corr.loc[a, b]), 4) if np.isfinite(corr.loc[a, b]) else 0.0 for b in labels]
              for a in labels]
    return {"labels": labels, "matrix": matrix, "rows": int(returns.shape[0])}


def normalize_symbols(symbols: Any) -> List[str]:
    """대문자 · 공백 제거 · 중복 제거(순서 유지)."""
    raw = symbols.split(",") if isinstance(symbols, str) else (symbols or [])
    return list(dict.fromkeys(s.strip().upper() for s in raw if s and s.strip()))


def series_from_rows(rows: Rows, symbol: str, target: str) -> Tuple[pd.Series, pd.Series]:
    """stock_price 행 → (분석 대상 시계열, 일간 수익률)."""
    if not rows:
        raise ValueError(f"No price data for {symbol}")
    return series_from_frame(prices_to_frame(rows), symbol, target)


def rolling_from(symbol: str, target: str, series: pd.Series, returns: pd.Series, metric: str, window: int,
                 risk_free_rate: float = 0.04, quantile_pct: float = 0.5) -> RollingData:
    """샤프 · 소르티노는 언제나 수익률로, 나머지는 고른 대상으로."""
    data = (returns if target != "return" else to_returns(series)) if metric in ("sharpe", "sortino") else series
    if len(data) <= window:
        raise ValueError(f"window ({window}) must be < data length ({len(data)})")
    out = rolling_metric(data, metric, window, risk_free_rate, quantile_pct).dropna()
    return RollingData(symbol=symbol, target=target, metric=metric, window=window,
                       points=[RollingPoint(date=i.date(), value=None if pd.isna(v) else float(v)) for i, v in out.items()])


def correlation_from(data: Dict[str, Rows]) -> CorrelationData:
    """{종목: 시세 행} → 상관행렬. 시세가 없는 종목은 missing."""
    closes = {sym: closes_from_prices(rows) for sym, rows in data.items()}
    return CorrelationData(**correlation_matrix(closes), missing=[s for s, c in closes.items() if not c])

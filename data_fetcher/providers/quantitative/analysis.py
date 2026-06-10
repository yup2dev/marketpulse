"""Quantitative Analysis Models — summary / normality / CAPM / rolling / unit root."""
from datetime import date as date_type
from typing import List, Literal, Optional

from pydantic import Field

from data_fetcher.abstract_provider.abstract import BaseData, BaseQueryParams


# ────────────────────────────────────────────────────────────────────────────
# Common base for every analysis: a ticker + optional date range + target col
# ────────────────────────────────────────────────────────────────────────────
class _BaseAnalysisQuery(BaseQueryParams):
    symbol: str = Field(description="Ticker symbol (e.g. AAPL)")
    start_date: Optional[date_type] = Field(default=None, description="시작일")
    end_date: Optional[date_type] = Field(default=None, description="종료일")
    target: Literal["close", "open", "high", "low", "adj_close", "return"] = Field(
        default="close", description="분석 대상 컬럼 (return = 일일 수익률)"
    )


# ── 1. Summary (descriptive statistics) ─────────────────────────────────────
class SummaryQueryParams(_BaseAnalysisQuery):
    pass


class SummaryData(BaseData):
    """Descriptive statistics for a single time series."""
    symbol: str
    target: str
    count: int
    mean: float
    std: float
    min: float
    max: float
    p_25: float = Field(description="25th percentile")
    p_50: float = Field(description="median")
    p_75: float = Field(description="75th percentile")
    skew: float
    kurtosis: float = Field(description="excess kurtosis (Fisher)")


# ── 2. Normality tests ──────────────────────────────────────────────────────
class NormalityQueryParams(_BaseAnalysisQuery):
    pass


class NormalityTest(BaseData):
    test: str = Field(description="test name (e.g. jarque_bera)")
    statistic: float
    p_value: float
    normal: bool = Field(description="True if H0 not rejected at α=0.05")


class NormalityData(BaseData):
    """Container — one row per test."""
    symbol: str
    target: str
    n: int
    tests: List[NormalityTest]


# ── 3. CAPM (β vs benchmark) ────────────────────────────────────────────────
class CAPMQueryParams(_BaseAnalysisQuery):
    benchmark: str = Field(default="^GSPC", description="시장 벤치마크 (기본: S&P 500)")
    risk_free_rate: float = Field(
        default=0.04, description="연율 무위험 이자율 (소수점, 0.04 = 4%)"
    )


class CAPMData(BaseData):
    symbol: str
    benchmark: str
    n: int
    alpha: float = Field(description="Jensen alpha (annualised)")
    beta: float = Field(description="market beta")
    r_squared: float
    correlation: float
    systematic_risk: float = Field(description="β² · σ²(market) (annualised)")
    unsystematic_risk: float = Field(description="residual variance (annualised)")
    total_risk: float = Field(description="total return variance (annualised)")
    annualised_return: float
    annualised_volatility: float
    sharpe_ratio: float


# ── 4. Rolling metric ───────────────────────────────────────────────────────
RollingMetric = Literal[
    "sharpe", "sortino", "stdev", "mean", "skew", "kurtosis", "quantile"
]


class RollingQueryParams(_BaseAnalysisQuery):
    metric: RollingMetric = Field(description="롤링 지표 종류")
    window: int = Field(default=21, ge=2, description="롤링 윈도우 크기 (영업일)")
    risk_free_rate: float = Field(
        default=0.04, description="연율 RF (sharpe/sortino에서만 사용)"
    )
    quantile_pct: float = Field(
        default=0.5, ge=0.0, le=1.0, description="분위수 (metric=quantile일 때)"
    )


class RollingPoint(BaseData):
    date: date_type
    value: Optional[float]


class RollingData(BaseData):
    symbol: str
    target: str
    metric: str
    window: int
    points: List[RollingPoint]


# ── 5. Unit root (ADF) ──────────────────────────────────────────────────────
class UnitRootQueryParams(_BaseAnalysisQuery):
    regression: Literal["c", "ct", "ctt", "n"] = Field(
        default="c",
        description="ADF regression type — c=상수, ct=상수+추세, ctt=2차 추세, n=무상수",
    )


class UnitRootData(BaseData):
    symbol: str
    target: str
    n: int
    test: str = Field(default="adf")
    statistic: float
    p_value: float
    used_lag: int
    n_obs: int
    critical_1pct: float
    critical_5pct: float
    critical_10pct: float
    stationary: bool = Field(description="True if p_value < 0.05")

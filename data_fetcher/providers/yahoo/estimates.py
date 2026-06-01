"""Yahoo Finance Estimates Model (애널리스트 추정치)"""
from typing import Optional, List, Dict, Any
from pydantic import Field
from data_fetcher.abstract_provider.abstract import BaseQueryParams, BaseData


class YFinanceEstimatesQueryParams(BaseQueryParams):
    """애널리스트 추정치 조회 파라미터"""

    symbol: str = Field(description="종목 코드 (예: AAPL, MSFT)")


class YFinancePriceTargetData(BaseData):
    """목표주가 데이터"""

    symbol: str = Field(description="종목 코드")
    current_price: Optional[float] = Field(default=None, description="현재가")
    target_high: Optional[float] = Field(default=None, description="목표가 최고")
    target_low: Optional[float] = Field(default=None, description="목표가 최저")
    target_mean: Optional[float] = Field(default=None, description="목표가 평균")
    target_median: Optional[float] = Field(default=None, description="목표가 중앙값")
    number_of_analysts: Optional[int] = Field(default=None, description="애널리스트 수")


class YFinanceEarningsEstimateData(BaseData):
    """수익 추정치 데이터"""

    symbol: str = Field(description="종목 코드")
    period: str = Field(description="기간 (0q, +1q, 0y, +1y)")
    avg: Optional[float] = Field(default=None, description="EPS 추정 평균")
    low: Optional[float] = Field(default=None, description="EPS 추정 최저")
    high: Optional[float] = Field(default=None, description="EPS 추정 최고")
    year_ago_eps: Optional[float] = Field(default=None, description="전년 동기 EPS")
    number_of_analysts: Optional[int] = Field(default=None, description="애널리스트 수")
    growth: Optional[float] = Field(default=None, description="성장률")


class YFinanceRevenueEstimateData(BaseData):
    """매출 추정치 데이터"""

    symbol: str = Field(description="종목 코드")
    period: str = Field(description="기간 (0q, +1q, 0y, +1y)")
    avg: Optional[float] = Field(default=None, description="매출 추정 평균")
    low: Optional[float] = Field(default=None, description="매출 추정 최저")
    high: Optional[float] = Field(default=None, description="매출 추정 최고")
    year_ago_revenue: Optional[float] = Field(default=None, description="전년 동기 매출")
    number_of_analysts: Optional[int] = Field(default=None, description="애널리스트 수")
    growth: Optional[float] = Field(default=None, description="성장률")


class YFinanceGrowthEstimateData(BaseData):
    """성장 추정치 데이터"""

    symbol: str = Field(description="종목 코드")
    current_quarter: Optional[float] = Field(default=None, description="현재 분기 성장률")
    next_quarter: Optional[float] = Field(default=None, description="다음 분기 성장률")
    current_year: Optional[float] = Field(default=None, description="현재 연도 성장률")
    next_year: Optional[float] = Field(default=None, description="다음 연도 성장률")
    next_5_years: Optional[float] = Field(default=None, description="향후 5년 연평균 성장률")
    past_5_years: Optional[float] = Field(default=None, description="과거 5년 연평균 성장률")


class YFinanceEstimatesData(BaseData):
    """통합 추정치 데이터"""

    symbol: str = Field(description="종목 코드")

    # EPS 추정치: {period_key: {estimate, low, high, year_ago, num_analysts, growth}}
    eps: Dict[str, Any] = Field(default_factory=dict)

    # 매출 추정치: {period_key: {...}}
    revenue: Dict[str, Any] = Field(default_factory=dict)

    # 목표주가
    price_target: Dict[str, Any] = Field(default_factory=dict)

    # 애널리스트 컨센서스 레이팅
    recommendations: Dict[str, Any] = Field(default_factory=dict)

    # EPS 수정 이력
    revisions: Dict[str, Any] = Field(default_factory=dict)


"""Yahoo Finance Estimates Fetcher"""
import logging
from typing import Any, Dict, List, Optional
import yfinance as yf
import pandas as pd

from data_fetcher.abstract_provider.abstract.fetcher import Fetcher

log = logging.getLogger(__name__)

_PERIOD_MAP = {
    '0q': 'Current Quarter', '+1q': 'Next Quarter',
    '0y': 'Current Year',    '+1y': 'Next Year',
}


def _fmt_period(period: str) -> str:
    return _PERIOD_MAP.get(period, period)


def _safe_float(df, row, col) -> Optional[float]:
    try:
        v = df.loc[row, col]
        return float(v) if v is not None and not pd.isna(v) else None
    except Exception:
        return None


def _safe_int(df, row, col) -> Optional[int]:
    try:
        v = df.loc[row, col]
        return int(v) if v is not None and not pd.isna(v) else None
    except Exception:
        return None


class YFinanceEstimatesFetcher(Fetcher[YFinanceEstimatesQueryParams, YFinanceEstimatesData]):

    @staticmethod
    def transform_query(params: Dict[str, Any]) -> YFinanceEstimatesQueryParams:
        return YFinanceEstimatesQueryParams(**params)

    @staticmethod
    def extract_data(
        query: YFinanceEstimatesQueryParams,
        credentials: Optional[Dict[str, str]] = None,
        **kwargs: Any,
    ) -> Dict[str, Any]:
        ticker = yf.Ticker(query.symbol)
        return {
            'earnings_estimate':    ticker.earnings_estimate,
            'revenue_estimate':     ticker.revenue_estimate,
            'eps_revisions':        ticker.eps_revisions,
            'analyst_price_targets': ticker.analyst_price_targets,
            'recommendations':      ticker.recommendations,
        }

    @staticmethod
    def transform_data(
        query: YFinanceEstimatesQueryParams,
        data: Dict[str, Any],
        **kwargs: Any,
    ) -> List[YFinanceEstimatesData]:
        earnings_est    = data.get('earnings_estimate')
        revenue_est     = data.get('revenue_estimate')
        eps_revisions   = data.get('eps_revisions')
        price_targets   = data.get('analyst_price_targets')
        recommendations = data.get('recommendations')

        # EPS estimates
        eps: Dict[str, Any] = {}
        if earnings_est is not None and not (isinstance(earnings_est, pd.DataFrame) and earnings_est.empty):
            for period in (earnings_est.index if isinstance(earnings_est, pd.DataFrame) else []):
                key = _fmt_period(str(period))
                eps[key] = {
                    'estimate':     _safe_float(earnings_est, period, 'avg'),
                    'low':          _safe_float(earnings_est, period, 'low'),
                    'high':         _safe_float(earnings_est, period, 'high'),
                    'year_ago':     _safe_float(earnings_est, period, 'yearAgoEps'),
                    'num_analysts': _safe_int(earnings_est, period, 'numberOfAnalysts'),
                    'growth':       _safe_float(earnings_est, period, 'growth'),
                }

        # Revenue estimates
        revenue: Dict[str, Any] = {}
        if revenue_est is not None and not (isinstance(revenue_est, pd.DataFrame) and revenue_est.empty):
            for period in (revenue_est.index if isinstance(revenue_est, pd.DataFrame) else []):
                key = _fmt_period(str(period))
                revenue[key] = {
                    'estimate':     _safe_float(revenue_est, period, 'avg'),
                    'low':          _safe_float(revenue_est, period, 'low'),
                    'high':         _safe_float(revenue_est, period, 'high'),
                    'year_ago':     _safe_float(revenue_est, period, 'yearAgoRevenue'),
                    'num_analysts': _safe_int(revenue_est, period, 'numberOfAnalysts'),
                    'growth':       _safe_float(revenue_est, period, 'growth'),
                }

        # Price target
        price_target: Dict[str, Any] = {}
        if price_targets:
            price_target = {
                'current': price_targets.get('current'),
                'mean':    price_targets.get('mean'),
                'median':  price_targets.get('median'),
                'low':     price_targets.get('low'),
                'high':    price_targets.get('high'),
            }

        # Recommendations
        rec: Dict[str, Any] = {}
        if recommendations is not None and not (isinstance(recommendations, pd.DataFrame) and recommendations.empty):
            latest = recommendations.iloc[0] if len(recommendations) > 0 else None
            if latest is not None:
                rec = {
                    'strong_buy':  int(latest.get('strongBuy', 0)),
                    'buy':         int(latest.get('buy', 0)),
                    'hold':        int(latest.get('hold', 0)),
                    'sell':        int(latest.get('sell', 0)),
                    'strong_sell': int(latest.get('strongSell', 0)),
                }

        # EPS revisions
        revisions: Dict[str, Any] = {}
        if eps_revisions is not None and not (isinstance(eps_revisions, pd.DataFrame) and eps_revisions.empty):
            for period in (eps_revisions.index if isinstance(eps_revisions, pd.DataFrame) else []):
                key = _fmt_period(str(period))
                revisions[key] = {
                    'up_last_7_days':    _safe_int(eps_revisions, period, 'upLast7days') or 0,
                    'up_last_30_days':   _safe_int(eps_revisions, period, 'upLast30days') or 0,
                    'down_last_7_days':  _safe_int(eps_revisions, period, 'downLast7days') or 0,
                    'down_last_30_days': _safe_int(eps_revisions, period, 'downLast30days') or 0,
                }

        return [YFinanceEstimatesData(
            symbol=query.symbol,
            eps=eps,
            revenue=revenue,
            price_target=price_target,
            recommendations=rec,
            revisions=revisions,
        )]

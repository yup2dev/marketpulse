"""Yahoo Finance Estimates provider (standard EquityEstimates 모델 경유)"""
from data_fetcher.abstract_provider.standard_models.equity_estimates import (
    EquityEstimatesQueryParams as YFinanceEstimatesQueryParams,
    PriceTargetData as YFinancePriceTargetData,
    EarningsEstimateData as YFinanceEarningsEstimateData,
    RevenueEstimateData as YFinanceRevenueEstimateData,
    GrowthEstimateData as YFinanceGrowthEstimateData,
    EquityEstimatesData as YFinanceEstimatesData,
)


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

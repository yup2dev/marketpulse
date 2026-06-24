"""Yahoo Finance Quarterly P&L Model"""
from data_fetcher.abstract_provider.standard_models.quarterly_pnl import (
    QuarterlyPnLPeriodData as YFinanceQuarterlyPeriodData,
    QuarterlyPnLQueryParams,
    QuarterlyPnLData,
)


class YFinanceQuarterlyPnLQueryParams(QuarterlyPnLQueryParams):
    """분기 P&L 조회 파라미터 (standard QuarterlyPnL 경유)"""


class YFinanceQuarterlyPnLData(QuarterlyPnLData):
    """분기 P&L 통합 데이터 (standard QuarterlyPnL 경유)"""


"""Yahoo Finance Quarterly P&L Fetcher"""
import logging
from typing import Any, Dict, List, Optional
import numpy as np
import yfinance as yf

from data_fetcher.abstract_provider.abstract.fetcher import Fetcher

log = logging.getLogger(__name__)

_ROW_MAP = {
    'revenue':   'Total Revenue',
    'cogs':      'Cost Of Revenue',
    'gross':     'Gross Profit',
    'op_income': 'Operating Income',
    'net':       'Net Income',
    'rd':        'Research And Development',
    'sga':       'Selling General And Administration',
}


class YFinanceQuarterlyPnLFetcher(Fetcher[YFinanceQuarterlyPnLQueryParams, YFinanceQuarterlyPnLData]):

    @staticmethod
    def transform_query(params: Dict[str, Any]) -> YFinanceQuarterlyPnLQueryParams:
        return YFinanceQuarterlyPnLQueryParams(**params)

    @staticmethod
    def extract_data(
        query: YFinanceQuarterlyPnLQueryParams,
        credentials: Optional[Dict[str, str]] = None,
        **kwargs: Any,
    ) -> Any:
        ticker = yf.Ticker(query.symbol)
        q = ticker.quarterly_income_stmt
        if q is None or q.empty:
            return None
        cols = sorted(q.columns)[-query.limit:]
        rows = []
        for col in cols:
            date_str = str(col)[:10]
            row: Dict[str, Any] = {'date': date_str}
            for key, label in _ROW_MAP.items():
                if label in q.index:
                    val = q.loc[label, col]
                    row[key] = round(float(val) / 1e9, 3) if (val is not None and not (isinstance(val, float) and np.isnan(val))) else None
                else:
                    row[key] = None
            rows.append(row)
        return rows

    @staticmethod
    def transform_data(
        query: YFinanceQuarterlyPnLQueryParams,
        data: Optional[List[Dict[str, Any]]],
        **kwargs: Any,
    ) -> List[YFinanceQuarterlyPnLData]:
        if not data:
            return [YFinanceQuarterlyPnLData(symbol=query.symbol)]

        history: List[YFinanceQuarterlyPeriodData] = []
        for row in data:
            rev = row.get('revenue')
            gross_margin = round(row['gross'] / rev * 100, 1) if (row.get('gross') is not None and rev and rev > 0) else None
            op_margin = round(row['op_income'] / rev * 100, 1) if (row.get('op_income') is not None and rev and rev > 0) else None
            net_margin = round(row['net'] / rev * 100, 1) if (row.get('net') is not None and rev and rev > 0) else None
            history.append(YFinanceQuarterlyPeriodData(
                date=row['date'],
                revenue=row.get('revenue'),
                cogs=row.get('cogs'),
                gross=row.get('gross'),
                op_income=row.get('op_income'),
                net=row.get('net'),
                rd=row.get('rd'),
                sga=row.get('sga'),
                gross_margin=gross_margin,
                op_margin=op_margin,
                net_margin=net_margin,
            ))

        yoy_revenue: Dict[str, float] = {}
        for i, row in enumerate(history):
            prior_idx = i - 4
            if prior_idx >= 0:
                cur = row.revenue
                prv = history[prior_idx].revenue
                if cur is not None and prv and prv != 0:
                    yoy_revenue[row.date] = round((cur - prv) / abs(prv) * 100, 1)

        latest = history[-1].model_dump(mode='json') if history else {}
        return [YFinanceQuarterlyPnLData(
            symbol=query.symbol,
            history=history,
            latest=latest,
            yoy_revenue=yoy_revenue,
        )]

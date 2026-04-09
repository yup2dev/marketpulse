"""Yahoo Finance Balance Sheet Fetcher"""
import logging
import numpy as np
import yfinance as yf
from typing import Any, Dict, List, Optional

from data_fetcher.fetchers.base import Fetcher
from data_fetcher.models.yahoo.balance_sheet import YFinanceBalanceSheetQueryParams, YFinanceBalanceSheetData

log = logging.getLogger(__name__)


class YFinanceBalanceSheetFetcher(Fetcher[YFinanceBalanceSheetQueryParams, YFinanceBalanceSheetData]):

    @staticmethod
    def transform_query(params: Dict[str, Any]) -> YFinanceBalanceSheetQueryParams:
        return YFinanceBalanceSheetQueryParams(**params)

    @staticmethod
    def extract_data(
        query: YFinanceBalanceSheetQueryParams,
        credentials: Optional[Dict[str, str]] = None,
        **kwargs: Any,
    ) -> Any:
        ticker = yf.Ticker(query.symbol)
        df = ticker.get_balance_sheet(freq=query.period)
        if df is None or df.empty:
            return []
        cols = sorted(df.columns)[-query.limit:]
        rows = []
        for col in cols:
            row: Dict[str, Any] = {'date': str(col)[:10]}
            for idx in df.index:
                val = df.loc[idx, col]
                key = idx.replace(' ', '_').lower()
                row[key] = None if (val is None or (isinstance(val, float) and np.isnan(val))) else val
            rows.append(row)
        return rows

    @staticmethod
    def transform_data(
        query: YFinanceBalanceSheetQueryParams,
        data: Any,
        **kwargs: Any,
    ) -> List[YFinanceBalanceSheetData]:
        return [YFinanceBalanceSheetData(**row) for row in data]

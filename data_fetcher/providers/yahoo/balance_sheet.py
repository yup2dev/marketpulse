"""Yahoo Finance Balance Sheet Model"""
from typing import Optional
from pydantic import Field
from data_fetcher.abstract_provider.abstract import BaseQueryParams, BaseData


class YFinanceBalanceSheetQueryParams(BaseQueryParams):
    symbol: str = Field(description="종목 코드 (예: AAPL)")
    period: str = Field(default="annual", description="'annual' 또는 'quarter'")
    limit: int = Field(default=5, ge=1, le=5, description="반환할 기간 수 (최대 5)")


class YFinanceBalanceSheetData(BaseData):
    """재무상태표 데이터 — extra='allow' 이므로 모든 동적 필드 수용"""
    date: str = Field(description="기준일 (YYYY-MM-DD)")


"""Yahoo Finance Balance Sheet Fetcher"""
import logging
import numpy as np
import yfinance as yf
from typing import Any, Dict, List, Optional

from data_fetcher.abstract_provider.abstract.fetcher import Fetcher

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

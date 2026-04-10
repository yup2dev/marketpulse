"""Yahoo Finance Stock Splits Fetcher"""
import logging
from typing import Any, Dict, List, Optional
import yfinance as yf

from data_fetcher.fetchers.base import Fetcher
from data_fetcher.models.yahoo.splits import YFinanceSplitsQueryParams, YFinanceSplitData

log = logging.getLogger(__name__)


class YFinanceSplitsFetcher(Fetcher[YFinanceSplitsQueryParams, YFinanceSplitData]):

    @staticmethod
    def transform_query(params: Dict[str, Any]) -> YFinanceSplitsQueryParams:
        return YFinanceSplitsQueryParams(**params)

    @staticmethod
    def extract_data(
        query: YFinanceSplitsQueryParams,
        credentials: Optional[Dict[str, str]] = None,
        **kwargs: Any,
    ) -> Any:
        ticker = yf.Ticker(query.symbol)
        splits = ticker.splits
        if splits is None or splits.empty:
            return []
        rows = []
        for date_idx, ratio in splits.items():
            rows.append({
                'date': date_idx.strftime('%Y-%m-%d') if hasattr(date_idx, 'strftime') else str(date_idx)[:10],
                'ratio': float(ratio),
            })
        # descending by date, apply limit
        rows.sort(key=lambda x: x['date'], reverse=True)
        return rows[:query.limit]

    @staticmethod
    def transform_data(
        query: YFinanceSplitsQueryParams,
        data: List[Dict[str, Any]],
        **kwargs: Any,
    ) -> List[YFinanceSplitData]:
        result = []
        for row in data:
            ratio = row['ratio']
            description = f"{int(ratio)}:1 split" if ratio > 1 else f"1:{int(1 / ratio)} reverse split"
            result.append(YFinanceSplitData(
                date=row['date'],
                ratio=ratio,
                description=description,
            ))
        return result

"""Yahoo Finance Stock Splits Model"""
from data_fetcher.abstract_provider.standard_models.equity_splits import (
    EquitySplitsQueryParams,
    EquitySplitsData,
)


class YFinanceSplitsQueryParams(EquitySplitsQueryParams):
    """주식 분할 조회 파라미터 (standard EquitySplits 경유)"""


class YFinanceSplitData(EquitySplitsData):
    """주식 분할 데이터 (standard EquitySplits 경유)"""


"""Yahoo Finance Stock Splits Fetcher"""
import logging
from typing import Any, Dict, List, Optional
import yfinance as yf

from data_fetcher.abstract_provider.abstract.base_fetchers import YFinanceFetcher

log = logging.getLogger(__name__)


class YFinanceSplitsFetcher(YFinanceFetcher[YFinanceSplitsQueryParams, YFinanceSplitData]):

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

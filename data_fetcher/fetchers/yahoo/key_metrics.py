"""Yahoo Finance Key Metrics Fetcher"""
import logging
from typing import Any, Dict, List, Optional
import yfinance as yf

from data_fetcher.fetchers.base import Fetcher
from data_fetcher.models.yahoo.key_metrics import YFinanceKeyMetricsQueryParams, YFinanceKeyMetricsData

log = logging.getLogger(__name__)


class YFinanceKeyMetricsFetcher(Fetcher[YFinanceKeyMetricsQueryParams, YFinanceKeyMetricsData]):

    @staticmethod
    def transform_query(params: Dict[str, Any]) -> YFinanceKeyMetricsQueryParams:
        return YFinanceKeyMetricsQueryParams(**params)

    @staticmethod
    def extract_data(
        query: YFinanceKeyMetricsQueryParams,
        credentials: Optional[Dict[str, str]] = None,
        **kwargs: Any,
    ) -> Dict[str, Any]:
        ticker = yf.Ticker(query.symbol)
        return ticker.info

    @staticmethod
    def transform_data(
        query: YFinanceKeyMetricsQueryParams,
        data: Dict[str, Any],
        **kwargs: Any,
    ) -> List[YFinanceKeyMetricsData]:
        return [YFinanceKeyMetricsData.model_validate({**(data or {}), "symbol": query.symbol})]

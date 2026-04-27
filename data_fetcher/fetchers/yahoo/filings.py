"""Yahoo Finance SEC Filings Fetcher"""
import logging
from typing import Any, Dict, List, Optional
import yfinance as yf

from data_fetcher.fetchers.base import Fetcher
from data_fetcher.models.yahoo.filings import YFinanceFilingsQueryParams, YFinanceFilingData

log = logging.getLogger(__name__)


class YFinanceFilingsFetcher(Fetcher[YFinanceFilingsQueryParams, YFinanceFilingData]):

    @staticmethod
    def transform_query(params: Dict[str, Any]) -> YFinanceFilingsQueryParams:
        return YFinanceFilingsQueryParams(**params)

    @staticmethod
    def extract_data(
        query: YFinanceFilingsQueryParams,
        credentials: Optional[Dict[str, str]] = None,
        **kwargs: Any,
    ) -> List[Dict[str, Any]]:
        ticker = yf.Ticker(query.symbol)
        sec_filings = ticker.sec_filings
        if not sec_filings or len(sec_filings) == 0:
            return []
        return list(sec_filings[:query.limit])

    @staticmethod
    def transform_data(
        query: YFinanceFilingsQueryParams,
        data: List[Dict[str, Any]],
        **kwargs: Any,
    ) -> List[YFinanceFilingData]:
        out: List[YFinanceFilingData] = []
        for f in data:
            d = f.get('date', '')
            if hasattr(d, 'isoformat'):
                d = d.isoformat()
            out.append(YFinanceFilingData(
                type=f.get('type', ''),
                title=f.get('title', ''),
                date=str(d) if d else '',
                url=f.get('edgarUrl', '') or f.get('url', ''),
                exhibits=f.get('exhibits'),
            ))
        return out

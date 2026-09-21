"""Yahoo Finance Batch Quotes Models"""
from data_fetcher.abstract_provider.standard_models.batch_quotes import (
    BatchQuotesQueryParams as YFinanceBatchQuotesQueryParams,
    BatchQuoteData as YFinanceBatchQuoteData,
)


"""
Yahoo Finance Batch Quotes Fetcher

여러 심볼을 yf.download() 배치로 동시 조회.
단일 심볼 Ticker 방식보다 300개 기준 3× 빠름.

mode='live'   → 현재가 vs 전일 종가  (WS·랭킹 등락률)
mode='period' → 현재가 vs 기간 시작가 (기간별 랭킹)
"""
import concurrent.futures as _cf
import contextlib
import logging
from typing import Any, Dict, List, Optional

import pandas as pd
import yfinance as yf

from data_fetcher.abstract_provider.abstract.base_fetchers import YFinanceFetcher

log = logging.getLogger(__name__)


@contextlib.contextmanager
def _suppress_yf_logs():
    import logging as _logging
    loggers = [
        _logging.getLogger(n)
        for n in ('yfinance', 'yfinance.base', 'yfinance.multi',
                  'yfinance.utils', 'yfinance.scrapers.history')
    ]
    old = [lg.level for lg in loggers]
    for lg in loggers:
        lg.setLevel(_logging.CRITICAL)
    try:
        yield
    finally:
        for lg, lv in zip(loggers, old):
            lg.setLevel(lv)


def _download_chunks(
    symbols: List[str],
    period: str,
    chunk_size: int,
    max_workers: int,
) -> List[Dict[str, Any]]:
    """청크 동시 다운로드 → raw rows (동기). period별 시작/종가 포함."""
    def _dl(chunk):
        try:
            data = yf.download(
                tickers=chunk, period=period, interval='1d',
                auto_adjust=True, progress=False, threads=False,
            )
        except Exception:
            data = pd.DataFrame()
        return chunk, data

    chunks = [symbols[i:i + chunk_size] for i in range(0, len(symbols), chunk_size)]
    rows: List[Dict[str, Any]] = []

    with _suppress_yf_logs(), _cf.ThreadPoolExecutor(max_workers=max_workers) as ex:
        for chunk, data in ex.map(_dl, chunks):
            if data is None or getattr(data, 'empty', True):
                continue
            is_multi = isinstance(data.columns, pd.MultiIndex)
            for sym in chunk:
                try:
                    close  = data['Close'][sym].dropna()  if is_multi else data['Close'].dropna()
                    volume = data['Volume'][sym].dropna() if is_multi else data['Volume'].dropna()
                    if close.empty:
                        continue
                    rows.append({
                        'symbol': sym,
                        'close':  close,
                        'volume': volume,
                    })
                except Exception:
                    continue

    return rows


class YFinanceBatchQuotesFetcher(
    YFinanceFetcher[YFinanceBatchQuotesQueryParams, YFinanceBatchQuoteData]
):
    """다수 심볼 배치 시세 조회 (yf.download 기반)."""

    require_credentials = False

    @staticmethod
    def transform_query(params: Dict[str, Any]) -> YFinanceBatchQuotesQueryParams:
        return YFinanceBatchQuotesQueryParams(**params)

    @staticmethod
    def extract_data(
        query: YFinanceBatchQuotesQueryParams,
        credentials: Optional[Dict[str, str]] = None,
        **kwargs: Any,
    ) -> List[Dict[str, Any]]:
        symbols = [s for s in query.symbols if s]
        if not symbols:
            return []
        return _download_chunks(symbols, query.period, query.chunk_size, query.max_workers)

    @staticmethod
    def transform_data(
        query: YFinanceBatchQuotesQueryParams,
        data: List[Dict[str, Any]],
        **kwargs: Any,
    ) -> List[YFinanceBatchQuoteData]:
        result: List[YFinanceBatchQuoteData] = []
        for row in (data or []):
            sym    = row['symbol']
            close  = row['close']
            volume = row['volume']
            try:
                price = float(close.iloc[-1])
                if query.mode == 'period':
                    ref = float(close.iloc[0]) if len(close) >= 2 else price
                else:  # live
                    ref = float(close.iloc[-2]) if len(close) >= 2 else price
                chg = ((price - ref) / ref * 100) if ref else 0.0
                vol = int(volume.iloc[-1]) if not volume.empty else 0
                result.append(YFinanceBatchQuoteData(
                    symbol=sym,
                    price=round(price, 4),
                    change=round(price - ref, 4),
                    change_percent=round(chg, 4),
                    volume=vol,
                ))
            except Exception:
                continue
        return result

"""Stock Quote Fetcher — 최신 주가·등락 스냅샷 (stock_price 5d/1d 기반)."""
import logging
from typing import Any, Dict, List, Optional

from data_fetcher.fetchers.base import Fetcher
from data_fetcher.models.yahoo.stock_quote import SYMBOL_ALIASES, StockQuoteData, StockQuoteQueryParams

log = logging.getLogger(__name__)


class YFinanceQuoteFetcher(Fetcher[StockQuoteQueryParams, StockQuoteData]):
    """Yahoo Finance 현재가 스냅샷 — 직전 5일 OHLCV에서 현재가·등락 계산."""

    require_credentials = False

    @staticmethod
    def transform_query(params: Dict[str, Any]) -> StockQuoteQueryParams:
        q = StockQuoteQueryParams(**params)
        # 한국 시장 별칭 → Yahoo Finance 공식 티커
        q.symbol = SYMBOL_ALIASES.get(q.symbol.upper(), q.symbol)
        return q

    @staticmethod
    def extract_data(
        query: StockQuoteQueryParams,
        credentials: Optional[Dict[str, str]] = None,
        **kwargs: Any,
    ) -> List[Dict]:
        import yfinance as yf
        try:
            hist = yf.Ticker(query.symbol).history(period="5d", interval="1d")
            if hist.empty:
                return []
            hist = hist.reset_index()
            rows = []
            for _, row in hist.iterrows():
                rows.append({
                    "date":   str(row.get("Datetime", row.get("Date", ""))),
                    "open":   float(row["Open"])   if "Open"   in row else None,
                    "high":   float(row["High"])   if "High"   in row else None,
                    "low":    float(row["Low"])    if "Low"    in row else None,
                    "close":  float(row["Close"])  if "Close"  in row else None,
                    "volume": int(row["Volume"])   if "Volume" in row else None,
                })
            return rows
        except Exception as e:
            log.warning(f"[StockQuote] {query.symbol}: {e}")
            return []

    @staticmethod
    def transform_data(
        query: StockQuoteQueryParams,
        data: List[Dict],
        **kwargs: Any,
    ) -> List[StockQuoteData]:
        bars = [d for d in data if d.get("close") is not None]
        if not bars:
            return []

        latest = bars[-1]
        prev   = bars[-2] if len(bars) >= 2 else None

        change = change_pct = None
        if prev and prev.get("close"):
            change     = round(latest["close"] - prev["close"], 4)
            change_pct = round(change / prev["close"] * 100, 4)

        return [StockQuoteData(
            symbol=query.symbol,
            price=round(latest["close"], 4),
            change=change,
            change_percent=change_pct,
            volume=latest.get("volume"),
            open=latest.get("open"),
            high=latest.get("high"),
            low=latest.get("low"),
            timestamp=latest.get("date"),
        )]

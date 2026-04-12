"""
StockManager

주식 가격 / 시세 관련 데이터 조회.
"""
from typing import Dict, List, Optional

from data_fetcher.query_executor import QueryExecutor
from data_fetcher.fetchers.base import AnnotatedResult
from data_fetcher.models.yahoo.stock_price import YFinanceStockPriceData
from data_fetcher.models.alphavantage.equity_quote import EquityQuoteData


class StockManager:
    """주식 가격 / 시세 데이터 관리"""

    # ── Yahoo ──────────────────────────────────────────────────────────────
    @classmethod
    async def yahoo_stock_price(
        cls,
        symbol: str,
        interval: str = "1d",
        period: Optional[str] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
    ) -> List[YFinanceStockPriceData]:
        """Yahoo Finance 주가 조회"""
        params: Dict = {"symbol": symbol, "interval": interval}
        if start_date and end_date:
            params.update({"start_date": start_date, "end_date": end_date})
        elif period:
            params["period"] = period
        else:
            params["period"] = "1mo"

        raw = await QueryExecutor.fetch(
            provider="yahoo",
            model="stock_price",
            params=params,
        )
        return raw.result if isinstance(raw, AnnotatedResult) else raw

    # ── AlphaVantage ───────────────────────────────────────────────────────
    @classmethod
    async def alphavantage_quote_data(
        cls,
        symbol: str,
        credentials: Optional[Dict] = None,
    ) -> List[EquityQuoteData]:
        """AlphaVantage 실시간 시세 조회"""
        raw = await QueryExecutor.fetch(
            provider="alphavantage",
            model="quote",
            params={"symbol": symbol},
            credentials=credentials,
        )
        return raw.result if isinstance(raw, AnnotatedResult) else raw

    @classmethod
    async def alphavantage_timeseries_data(
        cls,
        symbol: str,
        interval: str = "daily",
        outputsize: str = "compact",
        credentials: Optional[Dict] = None,
    ) -> List[EquityQuoteData]:
        """AlphaVantage 시계열 데이터 조회"""
        raw = await QueryExecutor.fetch(
            provider="alphavantage",
            model="timeseries",
            params={"symbol": symbol, "interval": interval, "outputsize": outputsize},
            credentials=credentials,
        )
        return raw.result if isinstance(raw, AnnotatedResult) else raw

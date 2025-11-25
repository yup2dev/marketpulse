"""Yahoo Finance Stock Price Fetcher"""
import logging
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional
import yfinance as yf
import pandas as pd

from data_fetcher.fetchers.base import Fetcher
from data_fetcher.models.yahoo.stock_price import (
    StockPriceQueryParams,
    StockPriceData
)

log = logging.getLogger(__name__)


class YahooStockPriceFetcher(Fetcher[StockPriceQueryParams, StockPriceData]):
    """Yahoo Finance 주가 데이터 Fetcher"""

    @staticmethod
    def transform_query(params: Dict[str, Any]) -> StockPriceQueryParams:
        """쿼리 파라미터 변환"""
        return StockPriceQueryParams(**params)

    @staticmethod
    def extract_data(
        query: StockPriceQueryParams,
        credentials: Optional[Dict[str, str]] = None,
        **kwargs: Any
    ) -> pd.DataFrame:
        """
        Yahoo Finance에서 주가 데이터 추출

        Args:
            query: 쿼리 파라미터
            credentials: 사용 안함 (Yahoo Finance는 무료)

        Returns:
            pandas DataFrame
        """
        try:
            ticker = yf.Ticker(query.symbol)

            # Debug logging
            log.info(f"Fetching {query.symbol}: period={query.period}, start={query.start_date}, end={query.end_date}")

            # period가 지정된 경우 period 사용 (더 간단하고 정확)
            if query.period:
                log.info(f"Using period: {query.period}")
                hist = ticker.history(
                    period=query.period,
                    interval=query.interval
                )
            else:
                # 날짜 범위 설정
                end_date = datetime.now()
                start_date = end_date - timedelta(days=365)  # 기본 1년

                if query.start_date:
                    start_date = datetime.strptime(query.start_date, '%Y-%m-%d')
                if query.end_date:
                    end_date = datetime.strptime(query.end_date, '%Y-%m-%d')

                log.info(f"Using date range: {start_date} to {end_date}")

                # 주가 데이터 조회
                hist = ticker.history(
                    start=start_date,
                    end=end_date,
                    interval=query.interval
                )

            if hist.empty:
                log.warning(f"No data found for {query.symbol}")
                return pd.DataFrame()

            return hist

        except Exception as e:
            log.error(f"Error fetching stock price for {query.symbol}: {e}")
            raise

    @staticmethod
    def transform_data(
        query: StockPriceQueryParams,
        data: pd.DataFrame,
        **kwargs: Any
    ) -> List[StockPriceData]:
        """
        원시 데이터를 표준 모델로 변환

        Args:
            query: 쿼리 파라미터
            data: pandas DataFrame

        Returns:
            StockPriceData 리스트
        """
        if data.empty:
            return []

        result = []
        prev_close = None

        for idx, row in data.iterrows():
            try:
                close_price = float(row['Close'])
                open_price = float(row['Open'])

                # 일일 수익률 계산
                daily_return = None
                if prev_close and prev_close > 0:
                    daily_return = ((close_price - prev_close) / prev_close) * 100

                # 가격 변동
                price_change = close_price - open_price
                price_change_pct = (price_change / open_price * 100) if open_price > 0 else None

                stock_data = StockPriceData(
                    symbol=query.symbol,
                    date=idx.date(),
                    open=open_price,
                    high=float(row['High']),
                    low=float(row['Low']),
                    close=close_price,
                    adj_close=float(row.get('Adj Close', close_price)),
                    volume=int(row['Volume']),
                    daily_return=daily_return,
                    price_change=price_change,
                    price_change_pct=price_change_pct
                )

                result.append(stock_data)
                prev_close = close_price

            except (ValueError, KeyError) as e:
                log.warning(f"Error parsing stock data for {idx}: {e}")
                continue

        log.info(f"Fetched {len(result)} stock price records for {query.symbol}")
        return result

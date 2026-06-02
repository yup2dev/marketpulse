"""Yahoo Finance Stock Price Model (주가 데이터)"""
from typing import Optional
from pydantic import Field
from data_fetcher.abstract_provider.standard_models import EquityHistoricalQueryParams, EquityHistoricalData


class YFinanceStockPriceQueryParams(EquityHistoricalQueryParams):
    """Yahoo Finance 주가 데이터 조회 파라미터 (EquityHistoricalQueryParams 상속)

    표준 EquityHistoricalQueryParams에 yfinance-specific 파라미터를 추가합니다.
    Standard: symbol, start_date, end_date, interval
    """

    period: Optional[str] = Field(
        default=None,
        description="조회 기간 (1d, 5d, 1mo, 3mo, 6mo, 1y, 2y, 5y, max)"
    )


class YFinanceStockPriceData(EquityHistoricalData):
    """Yahoo Finance 주가 데이터

    표준 EquityHistoricalData를 상속합니다.
    모든 필드(symbol, date, open, high, low, close, adj_close, volume,
    daily_return, price_change, price_change_pct)가 표준에 포함됩니다.
    """
    pass


"""Yahoo Finance Stock Price Fetcher"""
import logging
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional
import yfinance as yf
import pandas as pd

from data_fetcher.abstract_provider.abstract.fetcher import Fetcher
from data_fetcher.providers.yahoo.stock_quote import SYMBOL_ALIASES

log = logging.getLogger(__name__)


class YFinanceStockPriceFetcher(Fetcher[YFinanceStockPriceQueryParams, YFinanceStockPriceData]):
    """Yahoo Finance 주가 데이터 Fetcher"""

    @staticmethod
    def transform_query(params: Dict[str, Any]) -> YFinanceStockPriceQueryParams:
        
        _INTERVAL_DEFAULTS = {
            '1d': '5m',  '5d': '30m', '1mo': '1h',
            '3mo': '1d', '6mo': '1d', '1y': '1d',
            '2y': '1wk', '5y': '1wk', '10y': '1mo', 'max': '1mo',
        }
        p = dict(params)
        # symbol 매핑 (한국 시장 별칭 → Yahoo Finance 티커)
        p['symbol'] = SYMBOL_ALIASES.get(str(p.get('symbol', '')).upper(), p.get('symbol', ''))
        # period → interval 기본값 자동 설정
        if not p.get('interval') and p.get('period'):
            p['interval'] = _INTERVAL_DEFAULTS.get(p['period'], '1d')
        return YFinanceStockPriceQueryParams(**p)

    @staticmethod
    def extract_data(
        query: YFinanceStockPriceQueryParams,
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
            log.warning(f"Error fetching stock price for {query.symbol}: {e}")
            return pd.DataFrame()

    @staticmethod
    def transform_data(
        query: YFinanceStockPriceQueryParams,
        data: pd.DataFrame,
        **kwargs: Any
    ) -> List[YFinanceStockPriceData]:
        """
        원시 데이터를 표준 모델로 변환

        Args:
            query: 쿼리 파라미터
            data: pandas DataFrame

        Returns:
            YFinanceStockPriceData 리스트
        """
        if data.empty:
            return []

        result = []
        prev_close = None

        # Check if intraday interval (contains time info)
        is_intraday = query.interval in ['1m', '2m', '5m', '15m', '30m', '60m', '90m', '1h']

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

                # For intraday data, preserve full datetime; for daily+, use date only
                if is_intraday:
                    # idx is a pandas Timestamp, convert to Python datetime
                    date_value = idx.to_pydatetime()
                else:
                    date_value = idx.date()

                stock_data = YFinanceStockPriceData(
                    symbol=query.symbol,
                    date=date_value,
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

        log.info(f"Fetched {len(result)} stock price records for {query.symbol} (interval: {query.interval})")
        return result

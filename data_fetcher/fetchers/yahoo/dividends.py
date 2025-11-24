"""Yahoo Finance Dividends Fetcher"""
import logging
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional
import yfinance as yf
import pandas as pd

from data_fetcher.fetchers.base import Fetcher
from data_fetcher.models.yahoo.dividends import (
    DividendsQueryParams,
    DividendData
)

log = logging.getLogger(__name__)


class YahooDividendsFetcher(Fetcher[DividendsQueryParams, DividendData]):
    """Yahoo Finance 배당 데이터 Fetcher"""

    @staticmethod
    def transform_query(params: Dict[str, Any]) -> DividendsQueryParams:
        """쿼리 파라미터 변환"""
        return DividendsQueryParams(**params)

    @staticmethod
    def extract_data(
        query: DividendsQueryParams,
        credentials: Optional[Dict[str, str]] = None,
        **kwargs: Any
    ) -> Dict[str, Any]:
        """
        Yahoo Finance에서 배당 데이터 추출

        Args:
            query: 쿼리 파라미터
            credentials: 사용 안함

        Returns:
            배당 데이터 및 주가 정보
        """
        try:
            ticker = yf.Ticker(query.symbol)

            # 날짜 범위 설정
            end_date = datetime.now()
            start_date = end_date - timedelta(days=365 * 5)  # 기본 5년

            if query.start_date:
                start_date = datetime.strptime(query.start_date, '%Y-%m-%d')
            if query.end_date:
                end_date = datetime.strptime(query.end_date, '%Y-%m-%d')

            # 배당 데이터 조회
            dividends = ticker.dividends

            # 날짜 필터링
            if not dividends.empty:
                # timezone 정보 제거 후 비교
                dividends_index_naive = dividends.index.tz_localize(None)
                dividends = dividends[
                    (dividends_index_naive >= start_date) &
                    (dividends_index_naive <= end_date)
                ]

            # 주가 데이터도 함께 조회 (배당 수익률 계산용)
            hist = ticker.history(start=start_date, end=end_date)

            return {
                'dividends': dividends,
                'history': hist,
                'symbol': query.symbol
            }

        except Exception as e:
            log.error(f"Error fetching dividends for {query.symbol}: {e}")
            raise

    @staticmethod
    def transform_data(
        query: DividendsQueryParams,
        data: Dict[str, Any],
        **kwargs: Any
    ) -> List[DividendData]:
        """
        원시 데이터를 표준 모델로 변환

        Args:
            query: 쿼리 파라미터
            data: 배당 및 주가 데이터

        Returns:
            DividendData 리스트
        """
        dividends = data['dividends']
        history = data['history']
        symbol = data['symbol']

        if dividends.empty:
            log.info(f"No dividend data for {symbol}")
            return []

        result = []
        prev_year_div = {}

        for idx, dividend_amount in dividends.items():
            try:
                div_date = idx.date()

                # 해당 날짜의 주가 찾기
                dividend_yield = None
                if not history.empty:
                    # 가장 가까운 날짜의 주가 찾기
                    time_diff = abs(history.index - idx)
                    closest_idx = time_diff.argmin()
                    closest_price = history.iloc[closest_idx]

                    close_price = float(closest_price['Close'])
                    if close_price > 0:
                        dividend_yield = (float(dividend_amount) / close_price) * 100

                # 전년 대비 성장률
                year = div_date.year
                quarter = (div_date.month - 1) // 3
                yoy_growth = None

                if (year - 1, quarter) in prev_year_div:
                    prev_div = prev_year_div[(year - 1, quarter)]
                    if prev_div > 0:
                        yoy_growth = ((float(dividend_amount) - prev_div) / prev_div) * 100

                prev_year_div[(year, quarter)] = float(dividend_amount)

                dividend_data = DividendData(
                    symbol=symbol,
                    date=div_date,
                    dividend=float(dividend_amount),
                    dividend_yield=dividend_yield,
                    yoy_growth=yoy_growth
                )

                result.append(dividend_data)

            except (ValueError, KeyError) as e:
                log.warning(f"Error parsing dividend data for {idx}: {e}")
                continue

        log.info(f"Fetched {len(result)} dividend records for {symbol}")
        return result

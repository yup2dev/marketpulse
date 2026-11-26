"""Yahoo Finance Dividends Model (배당 데이터)"""
import logging
from datetime import datetime, timedelta
from typing import Optional, Any, Dict, List

from data_fetcher.utils.lazy_import import lazy

yf = lazy("yfinance")   # 처음 쓸 때 import — 서버 기동 메모리 (utils/lazy_import.py)
from data_fetcher.abstract_provider.abstract.base_fetchers import YFinanceFetcher
from data_fetcher.abstract_provider.standard_models import DividendsQueryParams, DividendData


class YFinanceDividendsQueryParams(DividendsQueryParams):
    pass


class YFinanceDividendData(DividendData):
    pass


# ────────────────────────────────────────────────────────────────────────────
# Yahoo Finance Dividends Fetcher


log = logging.getLogger(__name__)


class YFinanceDividendsFetcher(YFinanceFetcher[YFinanceDividendsQueryParams, YFinanceDividendData]):
    """Yahoo Finance 배당 데이터 Fetcher"""

    @staticmethod
    def transform_query(params: Dict[str, Any]) -> YFinanceDividendsQueryParams:
        """쿼리 파라미터 변환"""
        return YFinanceDividendsQueryParams(**params)

    @staticmethod
    def extract_data(
        query: YFinanceDividendsQueryParams,
        credentials: Optional[Dict[str, str]] = None,
        **kwargs: Any
    ) -> Dict[str, Any]:
        """
        Yahoo Finance에서 배당 데이터 추출

        Args:
            query: 쿼리 파라미터
            credentials: 사용 안함

        Returns:
            배당 지급 내역
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

            return {
                'dividends': dividends,
                'symbol': query.symbol
            }

        except Exception as e:
            log.error(f"Error fetching dividends for {query.symbol}: {e}")
            raise

    @staticmethod
    def transform_data(
        query: YFinanceDividendsQueryParams,
        data: Dict[str, Any],
        **kwargs: Any
    ) -> List[YFinanceDividendData]:
        """
        원시 데이터를 표준 모델로 변환

        Args:
            query: 쿼리 파라미터
            data: 배당 지급 내역

        Returns:
            YFinanceDividendData 리스트
        """
        dividends = data['dividends']
        symbol = data['symbol']

        if dividends.empty:
            log.info(f"No dividend data for {symbol}")
            return []

        result = []
        for idx, dividend_amount in dividends.items():
            try:
                result.append(YFinanceDividendData(
                    symbol=symbol,
                    date=idx.date(),
                    dividend=float(dividend_amount),
                ))
            except (ValueError, KeyError) as e:
                log.warning(f"Error parsing dividend data for {idx}: {e}")
                continue

        log.info(f"Fetched {len(result)} dividend records for {symbol}")
        return result

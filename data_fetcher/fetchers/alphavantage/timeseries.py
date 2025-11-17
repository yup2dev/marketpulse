"""Alpha Vantage API Time Series Data Fetcher (일간 주가)"""
import logging
from datetime import datetime, date as date_type
from typing import Any, Dict, List, Optional
import requests

from data_fetcher.fetchers.base import Fetcher
from data_fetcher.models.alphavantage.equity_quote import EquityQuoteQueryParams, EquityQuoteData
from data_fetcher.utils.credentials import CredentialsError, get_api_key

log = logging.getLogger(__name__)

# Alpha Vantage API 엔드포인트
ALPHA_VANTAGE_API_URL = "https://www.alphavantage.co/query"


class AlphaVantageTimeseriesFetcher(Fetcher[EquityQuoteQueryParams, EquityQuoteData]):
    """Alpha Vantage API를 사용한 일간 주가 시계열 데이터 Fetcher"""

    @staticmethod
    def transform_query(params: Dict[str, Any]) -> EquityQuoteQueryParams:
        """쿼리 파라미터 변환"""
        return EquityQuoteQueryParams(**params)

    @staticmethod
    def extract_data(
        query: EquityQuoteQueryParams,
        credentials: Optional[Dict[str, str]] = None,
        **kwargs: Any
    ) -> Dict[str, Any]:
        """
        Alpha Vantage API에서 일간 주가 데이터 추출

        Args:
            query: 쿼리 파라미터
            credentials: Alpha Vantage API 키 포함 {"api_key": "..."}
            **kwargs: 추가 파라미터 (interval: 'compact' or 'full')

        Returns:
            원시 데이터 딕셔너리

        Raises:
            CredentialsError: API 키가 없을 경우
        """
        # API 키 필수 검증
        api_key = get_api_key(
            credentials=credentials,
            api_name="Alpha Vantage",
            env_var="ALPHA_VANTAGE_API_KEY"
        )

        try:
            # Daily Time Series 데이터 조회
            interval = kwargs.get('interval', 'compact')  # compact: 최근 100일, full: 전체

            params = {
                'function': 'TIME_SERIES_DAILY',
                'symbol': query.symbol,
                'outputsize': interval,  # compact or full
                'apikey': api_key,
            }

            response = requests.get(ALPHA_VANTAGE_API_URL, params=params, timeout=10)
            response.raise_for_status()

            data = response.json()

            # API 오류 확인
            if 'Error Message' in data:
                raise ValueError(f"Alpha Vantage Error: {data['Error Message']}")

            if 'Note' in data:
                raise ValueError(f"Alpha Vantage API Limit: {data['Note']}")

            # Meta Data와 Time Series 분리
            meta_data = data.get('Meta Data', {})
            time_series = data.get('Time Series (Daily)', {})

            return {
                'meta_data': meta_data,
                'time_series': time_series,
                'symbol': query.symbol,
            }

        except Exception as e:
            log.error(f"Error fetching timeseries data from Alpha Vantage for {query.symbol}: {e}")
            raise

    @staticmethod
    def transform_data(
        query: EquityQuoteQueryParams,
        data: Dict[str, Any],
        **kwargs: Any
    ) -> List[EquityQuoteData]:
        """
        원시 데이터를 표준 모델로 변환

        Args:
            query: 쿼리 파라미터
            data: 원시 데이터
            **kwargs: 추가 파라미터

        Returns:
            EquityQuoteData 리스트 (지정된 기간 내 데이터)
        """
        from datetime import datetime as dt

        meta_data = data.get('meta_data', {})
        time_series = data.get('time_series', {})
        symbol = data.get('symbol', query.symbol)

        if not time_series:
            log.warning(f"No timeseries data available for {symbol}")
            return []

        quote_data_list = []
        previous_close = None

        # 날짜 역순 정렬 (최신순)
        sorted_dates = sorted(time_series.keys(), reverse=True)

        for date_str in sorted_dates:
            try:
                # 날짜 파싱
                obs_date = dt.strptime(date_str, '%Y-%m-%d').date()

                # 날짜 범위 필터링
                if query.start_date and obs_date < query.start_date:
                    continue
                if query.end_date and obs_date > query.end_date:
                    continue

                ts_data = time_series[date_str]

                # Alpha Vantage의 시계열 데이터 키
                open_price = float(ts_data.get('1. open', 0))
                high = float(ts_data.get('2. high', 0))
                low = float(ts_data.get('3. low', 0))
                close = float(ts_data.get('4. close', 0))
                volume = int(ts_data.get('5. volume', 0))

                # 변동 정보 계산
                change = None
                change_percent = None

                if previous_close:
                    change = close - previous_close
                    change_percent = (change / previous_close * 100) if previous_close > 0 else None

                previous_close = close

                quote_obj = EquityQuoteData(
                    symbol=symbol,
                    name=meta_data.get('2. Symbol', symbol),
                    last_price=close,
                    open=open_price,
                    high=high,
                    low=low,
                    previous_close=previous_close,
                    change=change,
                    change_percent=change_percent,
                    volume=volume,
                    currency='USD',
                    last_updated=dt.strptime(date_str, '%Y-%m-%d'),
                )

                quote_data_list.append(quote_obj)

            except (ValueError, KeyError) as e:
                log.warning(f"Error parsing timeseries data for {date_str}: {e}")
                continue

        return quote_data_list

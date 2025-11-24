"""AlphaVantage Forex Fetcher"""
import logging
from datetime import datetime
from typing import Any, Dict, List, Optional
import requests

from data_fetcher.fetchers.base import Fetcher
from data_fetcher.models.alphavantage.forex import (
    ForexQueryParams,
    ForexData
)
from data_fetcher.utils.api_keys import get_api_key

log = logging.getLogger(__name__)


class AlphaVantageForexFetcher(Fetcher[ForexQueryParams, ForexData]):
    """AlphaVantage 외환 데이터 Fetcher"""

    @staticmethod
    def transform_query(params: Dict[str, Any]) -> ForexQueryParams:
        """쿼리 파라미터 변환"""
        return ForexQueryParams(**params)

    @staticmethod
    def extract_data(
        query: ForexQueryParams,
        credentials: Optional[Dict[str, str]] = None,
        **kwargs: Any
    ) -> Dict[str, Any]:
        """
        AlphaVantage API에서 외환 데이터 추출

        Args:
            query: 쿼리 파라미터
            credentials: API 키 포함 {"api_key": "..."}

        Returns:
            원시 JSON 데이터
        """
        api_key = get_api_key(
            credentials=credentials,
            api_name="AlphaVantage",
            env_var="ALPHAVANTAGE_API_KEY"
        )

        # 간격에 따른 함수 선택
        function_map = {
            'daily': 'FX_DAILY',
            'weekly': 'FX_WEEKLY',
            'monthly': 'FX_MONTHLY'
        }

        function = function_map.get(query.interval.lower(), 'FX_DAILY')

        try:
            url = "https://www.alphavantage.co/query"
            params = {
                'function': function,
                'from_symbol': query.from_currency.upper(),
                'to_symbol': query.to_currency.upper(),
                'apikey': api_key,
                'outputsize': 'full'  # 전체 데이터
            }

            response = requests.get(url, params=params, timeout=30)
            response.raise_for_status()
            data = response.json()

            # API 오류 체크
            if 'Error Message' in data:
                raise ValueError(f"AlphaVantage API Error: {data['Error Message']}")
            if 'Note' in data:
                raise ValueError(f"AlphaVantage API Limit: {data['Note']}")

            return data

        except Exception as e:
            log.error(f"Error fetching forex data: {e}")
            raise

    @staticmethod
    def transform_data(
        query: ForexQueryParams,
        data: Dict[str, Any],
        **kwargs: Any
    ) -> List[ForexData]:
        """
        원시 데이터를 표준 모델로 변환

        Args:
            query: 쿼리 파라미터
            data: AlphaVantage API 응답

        Returns:
            ForexData 리스트
        """
        # 시계열 데이터 키 찾기
        time_series_key = None
        for key in data.keys():
            if 'Time Series' in key:
                time_series_key = key
                break

        if not time_series_key:
            log.warning("No time series data found")
            return []

        time_series = data[time_series_key]
        result = []

        # 날짜 필터링 준비
        start_date = None
        end_date = None
        if query.start_date:
            start_date = datetime.strptime(query.start_date, '%Y-%m-%d').date()
        if query.end_date:
            end_date = datetime.strptime(query.end_date, '%Y-%m-%d').date()

        for date_str, values in time_series.items():
            try:
                fx_date = datetime.strptime(date_str, '%Y-%m-%d').date()

                # 날짜 필터링
                if start_date and fx_date < start_date:
                    continue
                if end_date and fx_date > end_date:
                    continue

                open_price = float(values['1. open'])
                high_price = float(values['2. high'])
                low_price = float(values['3. low'])
                close_price = float(values['4. close'])

                # 계산 필드
                daily_change = close_price - open_price
                daily_change_pct = (daily_change / open_price * 100) if open_price > 0 else None
                volatility = high_price - low_price

                forex_data = ForexData(
                    from_currency=query.from_currency.upper(),
                    to_currency=query.to_currency.upper(),
                    date=fx_date,
                    open=open_price,
                    high=high_price,
                    low=low_price,
                    close=close_price,
                    daily_change=daily_change,
                    daily_change_pct=daily_change_pct,
                    volatility=volatility
                )

                result.append(forex_data)

            except (ValueError, KeyError) as e:
                log.warning(f"Error parsing forex data for {date_str}: {e}")
                continue

        # 날짜순 정렬
        result.sort(key=lambda x: x.date)

        log.info(f"Fetched {len(result)} forex records for {query.from_currency}/{query.to_currency}")
        return result

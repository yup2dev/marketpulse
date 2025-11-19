"""AlphaVantage Cryptocurrency Fetcher"""
import logging
from datetime import datetime
from typing import Any, Dict, List, Optional
import requests

from data_fetcher.fetchers.base import Fetcher
from data_fetcher.models.alphavantage.crypto import (
    CryptoQueryParams,
    CryptoData
)
from data_fetcher.utils.credentials import get_api_key

log = logging.getLogger(__name__)


class AlphaVantageCryptoFetcher(Fetcher[CryptoQueryParams, CryptoData]):
    """AlphaVantage 암호화폐 데이터 Fetcher"""

    @staticmethod
    def transform_query(params: Dict[str, Any]) -> CryptoQueryParams:
        """쿼리 파라미터 변환"""
        return CryptoQueryParams(**params)

    @staticmethod
    def extract_data(
        query: CryptoQueryParams,
        credentials: Optional[Dict[str, str]] = None,
        **kwargs: Any
    ) -> Dict[str, Any]:
        """
        AlphaVantage API에서 암호화폐 데이터 추출

        Args:
            query: 쿼리 파라미터
            credentials: API 키 포함

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
            'daily': 'DIGITAL_CURRENCY_DAILY',
            'weekly': 'DIGITAL_CURRENCY_WEEKLY',
            'monthly': 'DIGITAL_CURRENCY_MONTHLY'
        }

        function = function_map.get(query.interval.lower(), 'DIGITAL_CURRENCY_DAILY')

        try:
            url = "https://www.alphavantage.co/query"
            params = {
                'function': function,
                'symbol': query.symbol.upper(),
                'market': query.market.upper(),
                'apikey': api_key
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
            log.error(f"Error fetching crypto data: {e}")
            raise

    @staticmethod
    def transform_data(
        query: CryptoQueryParams,
        data: Dict[str, Any],
        **kwargs: Any
    ) -> List[CryptoData]:
        """
        원시 데이터를 표준 모델로 변환

        Args:
            query: 쿼리 파라미터
            data: AlphaVantage API 응답

        Returns:
            CryptoData 리스트
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
        prev_close = None

        # 날짜 필터링 준비
        start_date = None
        end_date = None
        if query.start_date:
            start_date = datetime.strptime(query.start_date, '%Y-%m-%d').date()
        if query.end_date:
            end_date = datetime.strptime(query.end_date, '%Y-%m-%d').date()

        for date_str, values in time_series.items():
            try:
                crypto_date = datetime.strptime(date_str, '%Y-%m-%d').date()

                # 날짜 필터링
                if start_date and crypto_date < start_date:
                    continue
                if end_date and crypto_date > end_date:
                    continue

                # 가격 데이터 추출
                open_price = float(values.get('1. open', 0))
                high_price = float(values.get('2. high', 0))
                low_price = float(values.get('3. low', 0))
                close_price = float(values.get('4. close', 0))
                volume = float(values.get('5. volume', 0))

                # market_cap은 없을 수 있음
                market_cap = None
                if '6. market cap (USD)' in values:
                    market_cap = float(values['6. market cap (USD)'])

                # 계산 필드
                price_change = close_price - open_price
                price_change_pct = (price_change / open_price * 100) if open_price > 0 else None
                volatility = high_price - low_price

                # 일일 수익률 (전일 종가 대비)
                daily_return = None
                if prev_close and prev_close > 0:
                    daily_return = ((close_price - prev_close) / prev_close) * 100

                crypto_data = CryptoData(
                    symbol=query.symbol.upper(),
                    market=query.market.upper(),
                    date=crypto_date,
                    open=open_price,
                    high=high_price,
                    low=low_price,
                    close=close_price,
                    volume=volume,
                    market_cap=market_cap,
                    daily_return=daily_return,
                    price_change=price_change,
                    price_change_pct=price_change_pct,
                    volatility=volatility
                )

                result.append(crypto_data)
                prev_close = close_price

            except (ValueError, KeyError) as e:
                log.warning(f"Error parsing crypto data for {date_str}: {e}")
                continue

        # 날짜순 정렬
        result.sort(key=lambda x: x.date)

        log.info(f"Fetched {len(result)} crypto records for {query.symbol}/{query.market}")
        return result

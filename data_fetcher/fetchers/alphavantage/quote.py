"""Alpha Vantage API Stock Quote Data Fetcher"""
import logging
from datetime import datetime
from typing import Any, Dict, List, Optional
import requests

from data_fetcher.fetchers.base import Fetcher
from data_fetcher.models.alphavantage.equity_quote import EquityQuoteQueryParams, EquityQuoteData
from data_fetcher.utils.api_keys import CredentialsError, get_api_key

log = logging.getLogger(__name__)

# Alpha Vantage API 엔드포인트
ALPHA_VANTAGE_API_URL = "https://www.alphavantage.co/query"


class AlphaVantageQuoteFetcher(Fetcher[EquityQuoteQueryParams, EquityQuoteData]):
    """Alpha Vantage API를 사용한 주가 시세 데이터 Fetcher"""

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
        Alpha Vantage API에서 주가 데이터 추출

        Args:
            query: 쿼리 파라미터
            credentials: Alpha Vantage API 키 포함 {"api_key": "..."}
            **kwargs: 추가 파라미터

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
            # Global Quote 데이터 조회 (현재가 정보)
            params = {
                'function': 'GLOBAL_QUOTE',
                'symbol': query.symbol,
                'apikey': api_key,
            }

            response = requests.get(ALPHA_VANTAGE_API_URL, params=params, timeout=10)
            response.raise_for_status()

            data = response.json()

            # API 오류 확인
            if 'Error Message' in data:
                raise ValueError(f"Alpha Vantage Error: {data['Error Message']}")

            if 'Note' in data:
                # API 호출 제한 메시지
                raise ValueError(f"Alpha Vantage API Limit: {data['Note']}")

            return {
                'quote': data.get('Global Quote', {}),
                'symbol': query.symbol,
            }

        except Exception as e:
            log.error(f"Error fetching quote data from Alpha Vantage for {query.symbol}: {e}")
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
            EquityQuoteData 리스트
        """
        quote = data.get('quote', {})
        symbol = data.get('symbol', query.symbol)

        if not quote:
            log.warning(f"No quote data available for {symbol}")
            return []

        try:
            # Alpha Vantage의 JSON 키 이름이 특이함
            # "01. symbol", "05. price" 같은 형식

            def get_value(key_pattern: str) -> Optional[float]:
                """키 패턴으로 값 추출 (예: "05. price")"""
                for key, value in quote.items():
                    if key_pattern in key:
                        try:
                            return float(value) if value else None
                        except (ValueError, TypeError):
                            return None
                return None

            # 주요 데이터 추출
            symbol_val = quote.get('01. symbol', symbol)
            last_price = get_value('05. price')
            previous_close = get_value('08. previous close')
            open_price = get_value('02. open')
            high = get_value('03. high')
            low = get_value('04. low')
            volume = quote.get('06. volume')

            # 변동 정보 계산
            change = None
            change_percent = None

            if last_price and previous_close:
                change = last_price - previous_close
                change_percent = (change / previous_close * 100) if previous_close > 0 else None

            # 거래량 정수화
            try:
                volume = int(volume) if volume else None
            except (ValueError, TypeError):
                volume = None

            quote_data = EquityQuoteData(
                symbol=symbol_val,
                name=quote.get('01. symbol'),
                last_price=last_price,
                open=open_price,
                high=high,
                low=low,
                previous_close=previous_close,
                change=change,
                change_percent=change_percent,
                volume=volume,
                currency='USD',
                last_updated=datetime.now(),
            )

            return [quote_data]

        except Exception as e:
            log.error(f"Error transforming quote data for {symbol}: {e}")
            raise

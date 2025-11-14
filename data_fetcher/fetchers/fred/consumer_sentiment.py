"""FRED API Consumer Sentiment Index Fetcher"""
import logging
from datetime import datetime, date as date_type
from typing import Any, Dict, List, Optional
import requests

from data_fetcher.fetchers.base import Fetcher
from data_fetcher.models.consumer_sentiment import ConsumerSentimentQueryParams, ConsumerSentimentData
from data_fetcher.utils.credentials import CredentialsError, get_api_key

log = logging.getLogger(__name__)

# FRED Consumer Sentiment Series IDs
FRED_SERIES_MAP = {
    'preliminary': 'MMNRNJ',    # Consumer Sentiment Index (Preliminary)
    'final': 'UMCSENT',         # Consumer Sentiment Index (Final)
}


class FREDConsumerSentimentFetcher(Fetcher[ConsumerSentimentQueryParams, ConsumerSentimentData]):
    """FRED Consumer Sentiment Index Fetcher"""

    FRED_API_URL = "https://api.stlouisfed.org/fred/series/observations"

    @staticmethod
    def transform_query(params: Dict[str, Any]) -> ConsumerSentimentQueryParams:
        """쿼리 파라미터 변환"""
        return ConsumerSentimentQueryParams(**params)

    @staticmethod
    def extract_data(
        query: ConsumerSentimentQueryParams,
        credentials: Optional[Dict[str, str]] = None,
        **kwargs: Any
    ) -> Dict[str, Any]:
        """
        FRED API에서 소비자 심리 지수 데이터 추출

        Args:
            query: 쿼리 파라미터
            credentials: FRED API 키 포함 {"api_key": "..."}
            **kwargs: 추가 파라미터

        Returns:
            원시 데이터 딕셔너리

        Raises:
            CredentialsError: FRED API 키가 없을 경우
        """
        # API 키 필수 검증
        api_key = get_api_key(
            credentials=credentials,
            api_name="FRED",
            env_var="FRED_API_KEY"
        )

        # US만 지원
        if query.country != 'US':
            log.warning(f"Only US Consumer Sentiment is supported via FRED, got {query.country}")

        # 데이터 타입별 시리즈 ID 선택
        frequency = query.frequency.lower()
        series_id = FRED_SERIES_MAP.get(frequency, FRED_SERIES_MAP['final'])

        try:
            params = {
                'series_id': series_id,
                'api_key': api_key,
                'file_type': 'json',
                'limit': 400,
            }

            # 날짜 범위 설정
            if query.start_date:
                params['observation_start'] = query.start_date.isoformat()
            if query.end_date:
                params['observation_end'] = query.end_date.isoformat()

            response = requests.get(FREDConsumerSentimentFetcher.FRED_API_URL, params=params, timeout=10)
            response.raise_for_status()

            data = response.json()
            return {
                'observations': data.get('observations', []),
                'series_id': series_id,
                'frequency': frequency,
                'country': query.country
            }

        except Exception as e:
            log.error(f"Error fetching consumer sentiment data from FRED: {e}")
            raise

    @staticmethod
    def transform_data(
        query: ConsumerSentimentQueryParams,
        data: Dict[str, Any],
        **kwargs: Any
    ) -> List[ConsumerSentimentData]:
        """
        원시 데이터를 표준 모델로 변환

        Args:
            query: 쿼리 파라미터
            data: 원시 데이터
            **kwargs: 추가 파라미터

        Returns:
            ConsumerSentimentData 리스트
        """
        observations = data.get('observations', [])
        frequency = data.get('frequency', 'final')
        country = data.get('country', 'US')

        cs_data_list = []
        previous_value = None

        for obs in observations:
            try:
                date_str = obs.get('date')
                value_str = obs.get('value')

                if not date_str or value_str == '.' or value_str is None:
                    continue

                value = float(value_str)
                obs_date = datetime.strptime(date_str, '%Y-%m-%d').date()

                # 전월 대비 변화 계산
                change_from_previous = None
                if previous_value is not None:
                    change_from_previous = value - previous_value

                cs_obj = ConsumerSentimentData(
                    date=obs_date,
                    value=value,
                    country=country,
                    unit='Index',
                    change_from_previous=change_from_previous,
                    frequency_type=frequency
                )

                cs_data_list.append(cs_obj)
                previous_value = value

            except (ValueError, KeyError) as e:
                log.warning(f"Error parsing consumer sentiment observation {obs}: {e}")
                continue

        return cs_data_list

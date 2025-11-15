"""
FRED Series Fetcher - Common API logic for all FRED data sources

This module provides a base fetcher for FRED API calls, reducing code duplication
across different economic indicator fetchers.
"""
import logging
from datetime import date
from typing import Any, Dict, List, Optional
import requests

log = logging.getLogger(__name__)

FRED_API_BASE_URL = "https://api.stlouisfed.org/fred"
FRED_SERIES_OBSERVATIONS_URL = f"{FRED_API_BASE_URL}/series/observations"


class FredSeriesFetcher:
    """
    FRED Series 공통 Fetcher

    모든 FRED 경제 지표 fetcher에서 사용할 수 있는 공통 API 호출 로직을 제공합니다.
    OpenBB Platform의 FredSeriesFetcher 패턴을 따릅니다.

    Example:
        >>> api_key = "your_api_key"
        >>> observations = FredSeriesFetcher.fetch_series(
        ...     series_id="GDP",
        ...     api_key=api_key,
        ...     start_date=date(2020, 1, 1)
        ... )
    """

    @staticmethod
    def fetch_series(
        series_id: str,
        api_key: str,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        frequency: Optional[str] = None,
        aggregation_method: Optional[str] = None,
        units: Optional[str] = None,
        limit: int = 10000,
        **kwargs: Any
    ) -> List[Dict[str, Any]]:
        """
        FRED API에서 시계열 데이터 조회

        Args:
            series_id: FRED 시리즈 ID (예: 'GDP', 'CPIAUCSL')
            api_key: FRED API 키
            start_date: 시작 날짜
            end_date: 종료 날짜
            frequency: 데이터 빈도 ('d', 'w', 'm', 'q', 'sa', 'a')
            aggregation_method: 집계 방법 ('avg', 'sum', 'eop')
            units: 단위 변환 ('lin', 'chg', 'ch1', 'pch', 'pc1', 'pca', 'cch', 'cca', 'log')
            limit: 최대 관찰값 개수
            **kwargs: 추가 파라미터

        Returns:
            관찰값 리스트 [{'date': '2020-01-01', 'value': '100.0'}, ...]

        Raises:
            requests.HTTPError: API 호출 실패 시
            ValueError: 잘못된 응답 포맷
        """
        params = {
            'series_id': series_id,
            'api_key': api_key,
            'file_type': 'json',
            'limit': limit,
        }

        # 날짜 범위 설정
        if start_date:
            params['observation_start'] = start_date.isoformat()
        if end_date:
            params['observation_end'] = end_date.isoformat()

        # 빈도 설정
        if frequency:
            params['frequency'] = frequency

        # 집계 방법
        if aggregation_method:
            params['aggregation_method'] = aggregation_method

        # 단위 변환
        if units:
            params['units'] = units

        # 추가 파라미터
        for key, value in kwargs.items():
            if value is not None:
                params[key] = value

        try:
            log.debug(f"Fetching FRED series: {series_id}")
            response = requests.get(
                FRED_SERIES_OBSERVATIONS_URL,
                params=params,
                timeout=30
            )
            response.raise_for_status()

            data = response.json()

            # API 오류 확인
            if 'error_message' in data:
                raise ValueError(f"FRED API Error: {data['error_message']}")

            observations = data.get('observations', [])

            if not observations:
                log.warning(f"No observations found for series {series_id}")
                return []

            log.debug(f"Fetched {len(observations)} observations for {series_id}")
            return observations

        except requests.HTTPError as e:
            log.error(f"HTTP error fetching FRED series {series_id}: {e}")
            raise
        except Exception as e:
            log.error(f"Error fetching FRED series {series_id}: {e}")
            raise

    @staticmethod
    def fetch_multiple_series(
        series_ids: List[str],
        api_key: str,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        **kwargs: Any
    ) -> Dict[str, List[Dict[str, Any]]]:
        """
        여러 FRED 시리즈를 한 번에 조회

        Args:
            series_ids: FRED 시리즈 ID 리스트
            api_key: FRED API 키
            start_date: 시작 날짜
            end_date: 종료 날짜
            **kwargs: 추가 파라미터

        Returns:
            {series_id: [observations]} 딕셔너리
        """
        results = {}

        for series_id in series_ids:
            try:
                observations = FredSeriesFetcher.fetch_series(
                    series_id=series_id,
                    api_key=api_key,
                    start_date=start_date,
                    end_date=end_date,
                    **kwargs
                )
                results[series_id] = observations
            except Exception as e:
                log.error(f"Failed to fetch series {series_id}: {e}")
                results[series_id] = []

        return results

    @staticmethod
    def get_series_info(
        series_id: str,
        api_key: str
    ) -> Dict[str, Any]:
        """
        FRED 시리즈 메타데이터 조회

        Args:
            series_id: FRED 시리즈 ID
            api_key: FRED API 키

        Returns:
            시리즈 정보 딕셔너리
        """
        params = {
            'series_id': series_id,
            'api_key': api_key,
            'file_type': 'json',
        }

        try:
            response = requests.get(
                f"{FRED_API_BASE_URL}/series",
                params=params,
                timeout=10
            )
            response.raise_for_status()

            data = response.json()
            series_list = data.get('seriess', [])

            if series_list:
                return series_list[0]

            return {}

        except Exception as e:
            log.error(f"Error fetching series info for {series_id}: {e}")
            return {}

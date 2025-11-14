"""FRED API Housing Starts Fetcher"""
import logging
from datetime import datetime, date as date_type
from typing import Any, Dict, List, Optional
import requests

from data_fetcher.fetchers.base import Fetcher
from data_fetcher.models.housing_starts import HousingStartsQueryParams, HousingStartsData
from data_fetcher.utils.credentials import CredentialsError, get_api_key

log = logging.getLogger(__name__)

# FRED Housing Series IDs
FRED_SERIES_MAP = {
    'total': 'HOUST',              # Total Housing Starts
    'single_family': 'HOUST1F',    # Single Family Housing Starts
    'permits': 'PERMIT',           # Building Permits
}


class FREDHousingStartsFetcher(Fetcher[HousingStartsQueryParams, HousingStartsData]):
    """FRED Housing Starts Fetcher"""

    FRED_API_URL = "https://api.stlouisfed.org/fred/series/observations"

    @staticmethod
    def transform_query(params: Dict[str, Any]) -> HousingStartsQueryParams:
        """쿼리 파라미터 변환"""
        return HousingStartsQueryParams(**params)

    @staticmethod
    def extract_data(
        query: HousingStartsQueryParams,
        credentials: Optional[Dict[str, str]] = None,
        **kwargs: Any
    ) -> Dict[str, Any]:
        """
        FRED API에서 주택 건설 착공 데이터 추출

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
            log.warning(f"Only US Housing Starts is supported via FRED, got {query.country}")

        # 기본 시리즈 ID (총 주택)
        series_id = FRED_SERIES_MAP['total']

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

            response = requests.get(FREDHousingStartsFetcher.FRED_API_URL, params=params, timeout=10)
            response.raise_for_status()

            data = response.json()

            # 건축 허가 데이터도 함께 조회
            permits_data = {}
            try:
                permits_params = {
                    'series_id': FRED_SERIES_MAP['permits'],
                    'api_key': api_key,
                    'file_type': 'json',
                    'limit': 400,
                }
                if query.start_date:
                    permits_params['observation_start'] = query.start_date.isoformat()
                if query.end_date:
                    permits_params['observation_end'] = query.end_date.isoformat()

                permits_response = requests.get(FREDHousingStartsFetcher.FRED_API_URL, params=permits_params, timeout=10)
                permits_response.raise_for_status()
                permits_data = {obs['date']: float(obs['value']) for obs in permits_response.json().get('observations', [])
                               if obs.get('value') and obs.get('value') != '.'}
            except Exception as e:
                log.warning(f"Could not fetch building permits data: {e}")

            return {
                'observations': data.get('observations', []),
                'series_id': series_id,
                'country': query.country,
                'permits_data': permits_data
            }

        except Exception as e:
            log.error(f"Error fetching housing starts data from FRED: {e}")
            raise

    @staticmethod
    def transform_data(
        query: HousingStartsQueryParams,
        data: Dict[str, Any],
        **kwargs: Any
    ) -> List[HousingStartsData]:
        """
        원시 데이터를 표준 모델로 변환

        Args:
            query: 쿼리 파라미터
            data: 원시 데이터
            **kwargs: 추가 파라미터

        Returns:
            HousingStartsData 리스트
        """
        observations = data.get('observations', [])
        permits_data = data.get('permits_data', {})
        country = data.get('country', 'US')

        hs_data_list = []
        previous_value = None
        previous_date = None

        for obs in observations:
            try:
                date_str = obs.get('date')
                value_str = obs.get('value')

                if not date_str or value_str == '.' or value_str is None:
                    continue

                value = float(value_str)
                obs_date = datetime.strptime(date_str, '%Y-%m-%d').date()

                # 월간 변화율 계산
                mom_change = None
                if previous_value and previous_value != 0:
                    mom_change = ((value - previous_value) / previous_value) * 100

                # 건축 허가 값 조회
                permits_value = permits_data.get(date_str)

                hs_obj = HousingStartsData(
                    date=obs_date,
                    value=value,
                    country=country,
                    unit='Thousands of Units',
                    month_over_month_change=mom_change,
                    permits=permits_value
                )

                hs_data_list.append(hs_obj)
                previous_value = value

            except (ValueError, KeyError) as e:
                log.warning(f"Error parsing housing starts observation {obs}: {e}")
                continue

        return hs_data_list

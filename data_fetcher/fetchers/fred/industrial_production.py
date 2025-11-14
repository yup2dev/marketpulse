"""FRED API Industrial Production Index Fetcher"""
import logging
from datetime import datetime, date as date_type
from typing import Any, Dict, List, Optional
import requests

from data_fetcher.fetchers.base import Fetcher
from data_fetcher.models.industrial_production import IndustrialProductionQueryParams, IndustrialProductionData
from data_fetcher.utils.credentials import CredentialsError, get_api_key

log = logging.getLogger(__name__)

# FRED Industrial Production Series IDs
FRED_SERIES_MAP = {
    'total': 'INDPRO',                          # Total Industrial Production Index
    'manufacturing': 'MMNRNJ',                  # Manufacturing Production Index
    'mining': 'IMGMNSA',                        # Mining Production Index
    'utilities': 'IPUTSL',                      # Utilities Production Index
}


class FREDIndustrialProductionFetcher(Fetcher[IndustrialProductionQueryParams, IndustrialProductionData]):
    """FRED Industrial Production Index Fetcher"""

    FRED_API_URL = "https://api.stlouisfed.org/fred/series/observations"

    @staticmethod
    def transform_query(params: Dict[str, Any]) -> IndustrialProductionQueryParams:
        """쿼리 파라미터 변환"""
        return IndustrialProductionQueryParams(**params)

    @staticmethod
    def extract_data(
        query: IndustrialProductionQueryParams,
        credentials: Optional[Dict[str, str]] = None,
        **kwargs: Any
    ) -> Dict[str, Any]:
        """
        FRED API에서 산업 생산 지수 데이터 추출

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
            log.warning(f"Only US Industrial Production is supported via FRED, got {query.country}")

        # 카테고리별 시리즈 ID 선택
        category = query.category.lower()
        series_id = FRED_SERIES_MAP.get(category, FRED_SERIES_MAP['total'])

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

            response = requests.get(FREDIndustrialProductionFetcher.FRED_API_URL, params=params, timeout=10)
            response.raise_for_status()

            data = response.json()
            return {
                'observations': data.get('observations', []),
                'series_id': series_id,
                'category': category,
                'country': query.country
            }

        except Exception as e:
            log.error(f"Error fetching industrial production data from FRED: {e}")
            raise

    @staticmethod
    def transform_data(
        query: IndustrialProductionQueryParams,
        data: Dict[str, Any],
        **kwargs: Any
    ) -> List[IndustrialProductionData]:
        """
        원시 데이터를 표준 모델로 변환

        Args:
            query: 쿼리 파라미터
            data: 원시 데이터
            **kwargs: 추가 파라미터

        Returns:
            IndustrialProductionData 리스트
        """
        observations = data.get('observations', [])
        category = data.get('category', 'total')
        country = data.get('country', 'US')

        ip_data_list = []
        previous_value = None

        for obs in observations:
            try:
                date_str = obs.get('date')
                value_str = obs.get('value')

                if not date_str or value_str == '.' or value_str is None:
                    continue

                value = float(value_str)
                obs_date = datetime.strptime(date_str, '%Y-%m-%d').date()

                # 성장률 계산
                growth_rate = None
                if previous_value and previous_value != 0:
                    growth_rate = ((value - previous_value) / previous_value) * 100

                ip_obj = IndustrialProductionData(
                    date=obs_date,
                    value=value,
                    country=country,
                    category=category,
                    unit='Index (2012=100)',
                    growth_rate=growth_rate,
                    previous_value=previous_value
                )

                ip_data_list.append(ip_obj)
                previous_value = value

            except (ValueError, KeyError) as e:
                log.warning(f"Error parsing industrial production observation {obs}: {e}")
                continue

        return ip_data_list

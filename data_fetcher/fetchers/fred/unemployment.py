"""FRED API Unemployment Data Fetcher"""
import logging
from datetime import datetime, date as date_type
from typing import Any, Dict, List, Optional

from data_fetcher.fetchers.base import Fetcher
from data_fetcher.fetchers.fred.series import FredSeriesFetcher
from data_fetcher.models.fred.unemployment import UnemploymentQueryParams, UnemploymentData
from data_fetcher.utils.credentials import CredentialsError, get_api_key

log = logging.getLogger(__name__)

# FRED Unemployment Series IDs
FRED_SERIES_MAP = {
    'total': 'UNRATE',                    # Unemployment Rate
    'civilian': 'CIVPART',                # Civilian Labor Force Participation Rate
    'employed': 'EMRATIO',                # Employment-Population Ratio
    '16_19': 'LNU04000061',               # Unemployment Rate - 16 to 19 years
    '20_24': 'LNU04000062',               # Unemployment Rate - 20 to 24 years
    '25_54': 'LNU04000063',               # Unemployment Rate - 25 to 54 years
    '55_plus': 'LNU04000064',             # Unemployment Rate - 55 years and over
}

AGE_GROUP_MAP = {
    'all': 'total',
    '16-19': '16_19',
    '20-24': '20_24',
    '25-54': '25_54',
    '55+': '55_plus',
}


class FREDUnemploymentFetcher(Fetcher[UnemploymentQueryParams, UnemploymentData]):
    """
    FRED (Federal Reserve Economic Data) Unemployment Rate Fetcher

    Uses FredSeriesFetcher for common API logic.
    """

    @staticmethod
    def transform_query(params: Dict[str, Any]) -> UnemploymentQueryParams:
        """쿼리 파라미터 변환"""
        return UnemploymentQueryParams(**params)

    @staticmethod
    def extract_data(
        query: UnemploymentQueryParams,
        credentials: Optional[Dict[str, str]] = None,
        **kwargs: Any
    ) -> Dict[str, Any]:
        """
        FRED API에서 실업률 데이터 추출

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

        # US 실업률만 지원
        if query.country != 'US':
            log.warning(f"Only US unemployment rate is supported via FRED, got {query.country}")

        # 연령대별 시리즈 ID 선택
        age_group = getattr(query, 'age_group', 'all').lower()
        series_key = AGE_GROUP_MAP.get(age_group, 'total')
        series_id = FRED_SERIES_MAP[series_key]

        # 추가 데이터 시리즈 (노동 통계)
        labor_series = {
            'participation': FRED_SERIES_MAP['civilian'],
            'employment': FRED_SERIES_MAP['employed'],
        }

        try:
            # FredSeriesFetcher를 사용하여 데이터 조회 (의존성 활용)
            observations = FredSeriesFetcher.fetch_series(
                series_id=series_id,
                api_key=api_key,
                start_date=query.start_date,
                end_date=query.end_date,
                limit=400
            )

            # 보조 데이터 조회 (참가율)
            auxiliary_data = {}
            for data_type, sid in labor_series.items():
                try:
                    aux_observations = FredSeriesFetcher.fetch_series(
                        series_id=sid,
                        api_key=api_key,
                        start_date=query.start_date,
                        end_date=query.end_date,
                        limit=400
                    )
                    auxiliary_data[data_type] = aux_observations
                except Exception as e:
                    log.warning(f"Error fetching auxiliary data {data_type}: {e}")

            return {
                'observations': observations,
                'participation_data': auxiliary_data.get('participation', []),
                'employment_data': auxiliary_data.get('employment', []),
                'series_id': series_id,
                'country': query.country,
                'age_group': age_group
            }

        except Exception as e:
            log.error(f"Error fetching unemployment data from FRED: {e}")
            raise

    @staticmethod
    def transform_data(
        query: UnemploymentQueryParams,
        data: Dict[str, Any],
        **kwargs: Any
    ) -> List[UnemploymentData]:
        """
        원시 데이터를 표준 모델로 변환

        Args:
            query: 쿼리 파라미터
            data: 원시 데이터
            **kwargs: 추가 파라미터

        Returns:
            UnemploymentData 리스트
        """
        observations = data.get('observations', [])
        participation_data = data.get('participation_data', [])
        employment_data = data.get('employment_data', [])
        country = data.get('country', 'US')
        age_group = data.get('age_group', 'all')

        # 보조 데이터 맵 생성 (날짜별)
        participation_map = {obs['date']: float(obs['value'])
                            for obs in participation_data
                            if obs.get('value') not in ['.', None]}
        employment_map = {obs['date']: float(obs['value'])
                         for obs in employment_data
                         if obs.get('value') not in ['.', None]}

        unemployment_data_list = []

        for obs in observations:
            try:
                date_str = obs.get('date')
                value_str = obs.get('value')

                if not date_str or value_str == '.' or value_str is None:
                    continue

                value = float(value_str)
                obs_date = datetime.strptime(date_str, '%Y-%m-%d').date()
                # 사용자 지정 기간 필터링
                if query.start_date and obs_date < query.start_date:
                    continue
                if query.end_date and obs_date > query.end_date:
                    continue


                # 보조 데이터 가져오기
                participation_rate = participation_map.get(date_str)
                employment_ratio = employment_map.get(date_str)

                # 고용자 수 및 실업자 수 추정 (참고용)
                # 실제로는 별도의 데이터 소스에서 가져와야 함
                labor_force = None
                employed = None
                unemployed = None

                unemployment_obj = UnemploymentData(
                    date=obs_date,
                    value=value,
                    country=country,
                    labor_force=labor_force,
                    employed=employed,
                    unemployed=unemployed,
                    participation_rate=participation_rate
                )

                unemployment_data_list.append(unemployment_obj)

            except (ValueError, KeyError) as e:
                log.warning(f"Error parsing unemployment observation {obs}: {e}")
                continue

            return unemployment_data_list


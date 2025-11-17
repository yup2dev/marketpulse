"""FRED API CPI Data Fetcher"""
import logging
from datetime import datetime, date as date_type
from typing import Any, Dict, List, Optional

from data_fetcher.fetchers.base import Fetcher
from data_fetcher.fetchers.fred.series import FredSeriesFetcher
from data_fetcher.models.fred.cpi import CPIQueryParams, CPIData, CoreCPIData
from data_fetcher.utils.credentials import CredentialsError, get_api_key

log = logging.getLogger(__name__)

# FRED CPI Series IDs
FRED_SERIES_MAP = {
    'all_items': 'CPIAUCSL',              # Consumer Price Index - All Items
    'all_items_core': 'CPILFESL',         # Consumer Price Index - Core (Excluding Food and Energy)
    'food': 'CPIUFDSL',                   # Food
    'energy': 'CPIUEDSL',                 # Energy
    'transportation': 'CPIUTRAN',         # Transportation
    'medical': 'CPIMEDSL',                # Medical Care
}


class FREDCPIFetcher(Fetcher[CPIQueryParams, CPIData]):
    """FRED (Federal Reserve Economic Data) CPI Fetcher

    Uses FredSeriesFetcher for common API logic.
    """

    @staticmethod
    def transform_query(params: Dict[str, Any]) -> CPIQueryParams:
        """쿼리 파라미터 변환"""
        return CPIQueryParams(**params)

    @staticmethod
    def extract_data(
        query: CPIQueryParams,
        credentials: Optional[Dict[str, str]] = None,
        **kwargs: Any
    ) -> Dict[str, Any]:
        """
        FRED API에서 CPI 데이터 추출

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

        # US CPI만 지원
        if query.country != 'US':
            log.warning(f"Only US CPI is supported via FRED, got {query.country}")

        # 카테고리별 시리즈 ID 선택
        category = getattr(query, 'category', 'All Items').lower()
        category_map = {
            'all items': 'all_items',
            'core': 'all_items_core',
            'food': 'food',
            'energy': 'energy',
            'transportation': 'transportation',
            'medical': 'medical',
        }

        series_key = category_map.get(category, 'all_items')
        series_id = FRED_SERIES_MAP[series_key]

        try:
            # FredSeriesFetcher를 사용하여 데이터 조회 (의존성 활용)
            observations = FredSeriesFetcher.fetch_series(
                series_id=series_id,
                api_key=api_key,
                start_date=query.start_date,
                end_date=query.end_date,
                limit=400
            )

            return {
                'observations': observations,
                'series_id': series_id,
                'frequency': query.frequency,
                'country': query.country,
                'category': category
            }

        except Exception as e:
            log.error(f"Error fetching CPI data from FRED: {e}")
            raise

    @staticmethod
    def transform_data(
        query: CPIQueryParams,
        data: Dict[str, Any],
        **kwargs: Any
    ) -> List[CPIData]:
        """
        원시 데이터를 표준 모델로 변환

        Args:
            query: 쿼리 파라미터
            data: 원시 데이터
            **kwargs: 추가 파라미터

        Returns:
            CPIData 리스트
        """
        observations = data.get('observations', [])
        series_id = data.get('series_id')
        frequency = data.get('frequency')
        country = data.get('country', 'US')
        category = data.get('category', 'All Items')

        cpi_data_list = []
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

                # 변화율 계산
                change_month = None
                change_year = None

                if previous_value and previous_value != 0:
                    change_month = ((value - previous_value) / previous_value) * 100

                # 연간 변화율은 12개월 이전 데이터가 필요 (간단히 구현)
                if previous_date:
                    month_diff = (obs_date.year - previous_date.year) * 12 + (obs_date.month - previous_date.month)
                    if month_diff >= 12:
                        change_year = ((value - previous_value) / previous_value) * 100

                previous_value = value
                previous_date = obs_date

                # 데이터 타입 결정
                is_core = series_id == FRED_SERIES_MAP['all_items_core']

                if is_core:
                    cpi_obj = CoreCPIData(
                        date=obs_date,
                        value=value,
                        country=country,
                        category=category,
                        change_month=change_month,
                        change_year=change_year,
                        is_core=True,
                        excluded_items='Food and Energy'
                    )
                else:
                    cpi_obj = CPIData(
                        date=obs_date,
                        value=value,
                        country=country,
                        category=category,
                        change_month=change_month,
                        change_year=change_year
                    )

                cpi_data_list.append(cpi_obj)

            except (ValueError, KeyError) as e:
                log.warning(f"Error parsing CPI observation {obs}: {e}")
                continue

        return cpi_data_list


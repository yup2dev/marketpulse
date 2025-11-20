"""FRED API GDP Data Fetcher"""
import logging
from datetime import datetime, date as date_type
from typing import Any, Dict, List, Optional

from data_fetcher.fetchers.base import Fetcher
from data_fetcher.fetchers.fred.series import FredSeriesFetcher
from data_fetcher.models.fred.gdp import GDPQueryParams, GDPData, GDPRealData
from data_fetcher.utils.api_keys import CredentialsError, get_api_key

log = logging.getLogger(__name__)

# FRED GDP Series IDs
FRED_SERIES_MAP = {
    'nominal': 'A191RA1Q225SBEA',      # Nominal GDP (Billions)
    'real': 'A191RL1Q225SBEA',          # Real GDP (Chained 2012 Dollars)
    'per_capita': 'A4701A1Q225SBEA',    # Real GDP per Capita
    'quarterly': 'GDPC1',                # Real GDP (Quarterly)
}


class FREDGDPFetcher(Fetcher[GDPQueryParams, GDPData]):
    """FRED (Federal Reserve Economic Data) GDP Fetcher

    Uses FredSeriesFetcher for common API logic.
    """

    @staticmethod
    def transform_query(params: Dict[str, Any]) -> GDPQueryParams:
        """쿼리 파라미터 변환"""
        return GDPQueryParams(**params)

    @staticmethod
    def extract_data(
        query: GDPQueryParams,
        credentials: Optional[Dict[str, str]] = None,
        **kwargs: Any
    ) -> Dict[str, Any]:
        """
        FRED API에서 GDP 데이터 추출

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

        # US GDP만 지원
        if query.country != 'US':
            log.warning(f"Only US GDP is supported via FRED, got {query.country}")

        # 데이터 빈도별 시리즈 ID 선택
        frequency = query.frequency.lower()
        if frequency == 'quarterly':
            series_id = FRED_SERIES_MAP['real']
        else:  # annual
            series_id = FRED_SERIES_MAP['nominal']

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
                'frequency': frequency,
                'country': query.country
            }

        except Exception as e:
            log.error(f"Error fetching GDP data from FRED: {e}")
            raise

    @staticmethod
    def transform_data(
        query: GDPQueryParams,
        data: Dict[str, Any],
        **kwargs: Any
    ) -> List[GDPData]:
        """
        원시 데이터를 표준 모델로 변환

        Args:
            query: 쿼리 파라미터
            data: 원시 데이터
            **kwargs: 추가 파라미터

        Returns:
            GDPData 리스트 (사용자 지정 기간으로 필터링됨)
        """
        observations = data.get('observations', [])
        series_id = data.get('series_id')
        frequency = data.get('frequency')
        country = data.get('country', 'US')

        gdp_data_list = []
        previous_value = None

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

                # 성장률 계산
                growth_rate = None
                if previous_value and previous_value != 0:
                    growth_rate = ((value - previous_value) / previous_value) * 100

                previous_value = value

                # 데이터 타입 결정
                if series_id == FRED_SERIES_MAP['real']:
                    gdp_obj = GDPRealData(
                        date=obs_date,
                        value=value,
                        country=country,
                        unit='Billions of Chained 2012 Dollars',
                        growth_rate=growth_rate,
                        is_real=True,
                        base_year=2016
                    )
                else:
                    gdp_obj = GDPData(
                        date=obs_date,
                        value=value,
                        country=country,
                        unit='Billions of Dollars',
                        growth_rate=growth_rate
                    )

                gdp_data_list.append(gdp_obj)

            except (ValueError, KeyError) as e:
                log.warning(f"Error parsing GDP observation {obs}: {e}")
                continue

        log.info(
            f"Filtered GDP data: {len(gdp_data_list)} records "
            f"(start: {query.start_date}, end: {query.end_date})"
        )

        return gdp_data_list


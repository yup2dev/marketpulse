"""FRED API GDP Data Fetcher"""
import logging
from typing import Any, Dict, List, Optional

from data_fetcher.fetchers.base import Fetcher
from data_fetcher.fetchers.fred.series import FredSeriesFetcher
from data_fetcher.models.fred.gdp import GDPQueryParams, GDPData, GDPRealData
from data_fetcher.utils.api_keys import get_api_key

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
        country = data.get('country', 'US')
        is_real = series_id == FRED_SERIES_MAP['real']
        Model = GDPRealData if is_real else GDPData
        unit = 'Billions of Chained 2012 Dollars' if is_real else 'Billions of Dollars'

        # FRED uses "." for missing values; normalize and filter
        clean = []
        for obs in observations:
            value_str = obs.get('value')
            date_str = obs.get('date')
            if not date_str or value_str in (None, '.', ''):
                continue
            try:
                value = float(value_str)
            except (TypeError, ValueError):
                continue
            clean.append({'date': date_str, 'value': value})

        if query.start_date:
            sd = query.start_date.isoformat()
            clean = [r for r in clean if r['date'] >= sd]
        if query.end_date:
            ed = query.end_date.isoformat()
            clean = [r for r in clean if r['date'] <= ed]

        clean.sort(key=lambda r: r['date'])

        gdp_data_list: List[GDPData] = []
        previous_value = None

        for row in clean:
            value = row['value']

            growth_rate = None
            if previous_value and previous_value != 0:
                growth_rate = ((value - previous_value) / previous_value) * 100
            previous_value = value

            payload = {
                'date': row['date'],
                'value': value,
                'country': country,
                'unit': unit,
                'growth_rate': growth_rate,
            }
            if is_real:
                payload['is_real'] = True
                payload['base_year'] = 2016

            gdp_data_list.append(Model.model_validate(payload))

        log.info(
            f"Filtered GDP data: {len(gdp_data_list)} records "
            f"(start: {query.start_date}, end: {query.end_date})"
        )

        return gdp_data_list


"""FRED API CPI Data Fetcher"""
import logging
from typing import Any, Dict, List, Optional

from data_fetcher.fetchers.base import Fetcher
from data_fetcher.fetchers.fred.series import FredSeriesFetcher
from data_fetcher.models.fred.cpi import CPIQueryParams, CPIData, CoreCPIData
from data_fetcher.utils.api_keys import get_api_key

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
        country = data.get('country', 'US')
        category = data.get('category', 'All Items')
        is_core = series_id == FRED_SERIES_MAP['all_items_core']
        Model = CoreCPIData if is_core else CPIData

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

        # 사용자 지정 기간 필터링 (문자열 비교 가능: YYYY-MM-DD)
        if query.start_date:
            sd = query.start_date.isoformat()
            clean = [r for r in clean if r['date'] >= sd]
        if query.end_date:
            ed = query.end_date.isoformat()
            clean = [r for r in clean if r['date'] <= ed]

        clean.sort(key=lambda r: r['date'])

        # 변화율 계산
        cpi_data_list: List[CPIData] = []
        previous_value = None
        previous_ym: Optional[tuple] = None

        for row in clean:
            value = row['value']
            y, m, _ = row['date'].split('-')
            y, m = int(y), int(m)

            change_month = None
            change_year = None
            if previous_value and previous_value != 0:
                change_month = ((value - previous_value) / previous_value) * 100
            if previous_ym and previous_value:
                month_diff = (y - previous_ym[0]) * 12 + (m - previous_ym[1])
                if month_diff >= 12:
                    change_year = ((value - previous_value) / previous_value) * 100

            previous_value = value
            previous_ym = (y, m)

            payload = {
                'date': row['date'],
                'value': value,
                'country': country,
                'category': category,
                'change_month': change_month,
                'change_year': change_year,
            }
            if is_core:
                payload['is_core'] = True
                payload['excluded_items'] = 'Food and Energy'

            cpi_data_list.append(Model.model_validate(payload))

        log.info(
            f"Filtered CPI data: {len(cpi_data_list)} records "
            f"(start: {query.start_date}, end: {query.end_date})"
        )

        return cpi_data_list
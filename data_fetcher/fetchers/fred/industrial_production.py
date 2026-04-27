"""FRED API Industrial Production Index Fetcher"""
import logging
from datetime import datetime, date as date_type
from typing import Any, Dict, List, Optional

from data_fetcher.fetchers.base import Fetcher
from data_fetcher.fetchers.fred.series import FredSeriesFetcher
from data_fetcher.models.fred.industrial_production import IndustrialProductionQueryParams, IndustrialProductionData
from data_fetcher.utils.api_keys import CredentialsError, get_api_key

log = logging.getLogger(__name__)

# FRED Industrial Production Series IDs
FRED_SERIES_MAP = {
    'total': 'INDPRO',                          # Total Industrial Production Index
    'manufacturing': 'MMNRNJ',                  # Manufacturing Production Index
    'mining': 'IMGMNSA',                        # Mining Production Index
    'utilities': 'IPUTSL',                      # Utilities Production Index
}


class FREDIndustrialProductionFetcher(Fetcher[IndustrialProductionQueryParams, IndustrialProductionData]):
    """
    FRED Industrial Production Index Fetcher

    Uses FredSeriesFetcher for common API logic.
    """

    @staticmethod
    def transform_query(params: Dict[str, Any]) -> IndustrialProductionQueryParams:
        """쿼리 파라미터 변환"""
        return IndustrialProductionQueryParams(**params)

    @staticmethod
    def extract_data(
        query: IndustrialProductionQueryParams,
        credentials: Optional[Dict[str, str]] = None,
        **kwargs: Any
    ) -> List[Dict[str, Any]]:
        api_key = get_api_key(
            credentials=credentials,
            api_name="FRED",
            env_var="FRED_API_KEY"
        )

        if query.country != 'US':
            log.warning(f"Only US Industrial Production is supported via FRED, got {query.country}")

        category = query.category.lower()
        series_id = FRED_SERIES_MAP.get(category, FRED_SERIES_MAP['total'])

        return FredSeriesFetcher.fetch_series(
            series_id=series_id,
            api_key=api_key,
            start_date=query.start_date,
            end_date=query.end_date,
            limit=400,
        )

    @staticmethod
    def transform_data(
        query: IndustrialProductionQueryParams,
        data: List[Dict[str, Any]],
        **kwargs: Any
    ) -> List[IndustrialProductionData]:
        observations = data or []
        category = query.category.lower()
        country = query.country

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
                # 사용자 지정 기간 필터링
                if query.start_date and obs_date < query.start_date:
                    continue
                if query.end_date and obs_date > query.end_date:
                    continue


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

        log.info(
            f"Filtered industrial production data: {len(ip_data_list)} records "
            f"(start: {query.start_date}, end: {query.end_date})"
        )

        # 날짜순으로 정렬
        ip_data_list.sort(key=lambda x: x.date)

        return ip_data_list

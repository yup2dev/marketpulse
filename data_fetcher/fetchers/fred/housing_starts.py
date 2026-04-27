"""FRED API Housing Starts Fetcher"""
import logging
from datetime import datetime, date as date_type
from typing import Any, Dict, List, Optional

from data_fetcher.fetchers.base import Fetcher
from data_fetcher.fetchers.fred.series import FredSeriesFetcher
from data_fetcher.models.fred.housing_starts import HousingStartsQueryParams, HousingStartsData
from data_fetcher.utils.api_keys import CredentialsError, get_api_key

log = logging.getLogger(__name__)

# FRED Housing Series IDs
FRED_SERIES_MAP = {
    'total': 'HOUST',              # Total Housing Starts
    'single_family': 'HOUST1F',    # Single Family Housing Starts
    'permits': 'PERMIT',           # Building Permits
}


class FREDHousingStartsFetcher(Fetcher[HousingStartsQueryParams, HousingStartsData]):
    """
    FRED Housing Starts Fetcher

    Uses FredSeriesFetcher for common API logic.
    """

    @staticmethod
    def transform_query(params: Dict[str, Any]) -> HousingStartsQueryParams:
        """쿼리 파라미터 변환"""
        return HousingStartsQueryParams(**params)

    @staticmethod
    def extract_data(
        query: HousingStartsQueryParams,
        credentials: Optional[Dict[str, str]] = None,
        **kwargs: Any
    ) -> List[Dict[str, Any]]:
        api_key = get_api_key(
            credentials=credentials,
            api_name="FRED",
            env_var="FRED_API_KEY"
        )

        if query.country != 'US':
            log.warning(f"Only US Housing Starts is supported via FRED, got {query.country}")

        observations = FredSeriesFetcher.fetch_series(
            series_id=FRED_SERIES_MAP['total'],
            api_key=api_key,
            start_date=query.start_date,
            end_date=query.end_date,
            limit=400,
        )

        permits_map: Dict[str, float] = {}
        try:
            permits_obs = FredSeriesFetcher.fetch_series(
                series_id=FRED_SERIES_MAP['permits'],
                api_key=api_key,
                start_date=query.start_date,
                end_date=query.end_date,
                limit=400,
            )
            permits_map = {
                o['date']: float(o['value'])
                for o in permits_obs
                if o.get('value') and o.get('value') != '.'
            }
        except Exception as e:
            log.warning(f"Could not fetch building permits data: {e}")

        for obs in observations:
            obs['permits'] = permits_map.get(obs.get('date'))
        return observations

    @staticmethod
    def transform_data(
        query: HousingStartsQueryParams,
        data: List[Dict[str, Any]],
        **kwargs: Any
    ) -> List[HousingStartsData]:
        observations = data or []
        country = query.country

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
                # 사용자 지정 기간 필터링
                if query.start_date and obs_date < query.start_date:
                    continue
                if query.end_date and obs_date > query.end_date:
                    continue


                # 월간 변화율 계산
                mom_change = None
                if previous_value and previous_value != 0:
                    mom_change = ((value - previous_value) / previous_value) * 100

                # 건축 허가 값 (extract에서 행마다 병합됨)
                permits_value = obs.get('permits')

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

        log.info(
            f"Filtered housing starts data: {len(hs_data_list)} records "
            f"(start: {query.start_date}, end: {query.end_date})"
        )

        # 날짜순으로 정렬
        hs_data_list.sort(key=lambda x: x.date)

        return hs_data_list

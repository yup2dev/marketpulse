"""FRED API Non-Farm Payroll Fetcher"""
import logging
from datetime import datetime, date as date_type
from typing import Any, Dict, List, Optional

from data_fetcher.fetchers.base import Fetcher
from data_fetcher.fetchers.fred.series import FredSeriesFetcher
from data_fetcher.models.fred.nonfarm_payroll import NonfarmPayrollQueryParams, NonfarmPayrollData
from data_fetcher.utils.api_keys import CredentialsError, get_api_key

log = logging.getLogger(__name__)

# FRED Non-Farm Payroll Series IDs
FRED_SERIES_MAP = {
    'total': 'PAYEMS',                     # Total Non-Farm Payroll
    'manufacturing': 'MMNRNJ',             # Manufacturing Payroll
    'service': 'SRVPRD',                   # Service-Providing Payroll
    'government': 'GOVTG',                 # Government Payroll
}


class FREDNonfarmPayrollFetcher(Fetcher[NonfarmPayrollQueryParams, NonfarmPayrollData]):
    """
    FRED Non-Farm Payroll Fetcher

    Uses FredSeriesFetcher for common API logic.
    """

    @staticmethod
    def transform_query(params: Dict[str, Any]) -> NonfarmPayrollQueryParams:
        """쿼리 파라미터 변환"""
        return NonfarmPayrollQueryParams(**params)

    @staticmethod
    def extract_data(
        query: NonfarmPayrollQueryParams,
        credentials: Optional[Dict[str, str]] = None,
        **kwargs: Any
    ) -> List[Dict[str, Any]]:
        api_key = get_api_key(
            credentials=credentials,
            api_name="FRED",
            env_var="FRED_API_KEY"
        )

        if query.country != 'US':
            log.warning(f"Only US Non-Farm Payroll is supported via FRED, got {query.country}")

        sector = query.sector.lower()
        observations = FredSeriesFetcher.fetch_series(
            series_id=FRED_SERIES_MAP.get(sector, FRED_SERIES_MAP['total']),
            api_key=api_key,
            start_date=query.start_date,
            end_date=query.end_date,
            limit=400,
        )

        unemployment_map: Dict[str, float] = {}
        try:
            unemployment_obs = FredSeriesFetcher.fetch_series(
                series_id='UNRATE',
                api_key=api_key,
                start_date=query.start_date,
                end_date=query.end_date,
                limit=400,
            )
            unemployment_map = {
                o['date']: float(o['value'])
                for o in unemployment_obs
                if o.get('value') and o.get('value') != '.'
            }
        except Exception as e:
            log.warning(f"Could not fetch unemployment rate data: {e}")

        for obs in observations:
            obs['unemployment_rate'] = unemployment_map.get(obs.get('date'))
        return observations

    @staticmethod
    def transform_data(
        query: NonfarmPayrollQueryParams,
        data: List[Dict[str, Any]],
        **kwargs: Any
    ) -> List[NonfarmPayrollData]:
        observations = data or []
        sector = query.sector.lower()
        country = query.country

        nfp_data_list = []
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


                # 월간 변화 계산 (천 명 단위)
                mom_change = None
                if previous_value is not None:
                    mom_change = value - previous_value

                # 실업률 값 (extract에서 행마다 병합됨)
                unemployment_rate = obs.get('unemployment_rate')

                nfp_obj = NonfarmPayrollData(
                    date=obs_date,
                    value=value,
                    country=country,
                    sector=sector,
                    unit='Thousands of Persons',
                    month_over_month_change=mom_change,
                    unemployment_rate=unemployment_rate
                )

                nfp_data_list.append(nfp_obj)
                previous_value = value

            except (ValueError, KeyError) as e:
                log.warning(f"Error parsing non-farm payroll observation {obs}: {e}")
                continue

        log.info(
            f"Filtered non-farm payroll data: {len(nfp_data_list)} records "
            f"(start: {query.start_date}, end: {query.end_date})"
        )

        # 날짜순으로 정렬
        nfp_data_list.sort(key=lambda x: x.date)

        return nfp_data_list

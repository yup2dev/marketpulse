"""FRED API Non-Farm Payroll Fetcher"""
import logging
from datetime import datetime, date as date_type
from typing import Any, Dict, List, Optional

from data_fetcher.fetchers.base import Fetcher
from data_fetcher.fetchers.fred.series import FredSeriesFetcher
from data_fetcher.models.fred.nonfarm_payroll import NonfarmPayrollQueryParams, NonfarmPayrollData
from data_fetcher.utils.credentials import CredentialsError, get_api_key

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
    ) -> Dict[str, Any]:
        """
        FRED API에서 비농업 취업자 데이터 추출

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
            log.warning(f"Only US Non-Farm Payroll is supported via FRED, got {query.country}")

        # 업종별 시리즈 ID 선택
        sector = query.sector.lower()
        series_id = FRED_SERIES_MAP.get(sector, FRED_SERIES_MAP['total'])

        try:
            # FredSeriesFetcher를 사용하여 데이터 조회 (의존성 활용)
            observations = FredSeriesFetcher.fetch_series(
                series_id=series_id,
                api_key=api_key,
                start_date=query.start_date,
                end_date=query.end_date,
                limit=400
            )

            # 실업률 데이터 함께 조회
            unemployment_data = {}
            try:
                unemployment_observations = FredSeriesFetcher.fetch_series(
                    series_id='UNRATE',  # Unemployment Rate
                    api_key=api_key,
                    start_date=query.start_date,
                    end_date=query.end_date,
                    limit=400
                )
                unemployment_data = {obs['date']: float(obs['value']) for obs in unemployment_observations
                                    if obs.get('value') and obs.get('value') != '.'}
            except Exception as e:
                log.warning(f"Could not fetch unemployment rate data: {e}")

            return {
                'observations': observations,
                'series_id': series_id,
                'sector': sector,
                'country': query.country,
                'unemployment_data': unemployment_data
            }

        except Exception as e:
            log.error(f"Error fetching non-farm payroll data from FRED: {e}")
            raise

    @staticmethod
    def transform_data(
        query: NonfarmPayrollQueryParams,
        data: Dict[str, Any],
        **kwargs: Any
    ) -> List[NonfarmPayrollData]:
        """
        원시 데이터를 표준 모델로 변환

        Args:
            query: 쿼리 파라미터
            data: 원시 데이터
            **kwargs: 추가 파라미터

        Returns:
            NonfarmPayrollData 리스트
        """
        observations = data.get('observations', [])
        unemployment_data = data.get('unemployment_data', {})
        sector = data.get('sector', 'total')
        country = data.get('country', 'US')

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

                # 실업률 값 조회
                unemployment_rate = unemployment_data.get(date_str)

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

            return nfp_data_list

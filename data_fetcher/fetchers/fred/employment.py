"""FRED API Employment Data Fetcher"""
import logging
from datetime import datetime, date as date_type
from typing import Any, Dict, List, Optional

from data_fetcher.fetchers.base import Fetcher
from data_fetcher.fetchers.fred.series import FredSeriesFetcher
from data_fetcher.models.fred.employment import EmploymentQueryParams, EmploymentData
from data_fetcher.utils.api_keys import CredentialsError, get_api_key

log = logging.getLogger(__name__)

# FRED Employment Series IDs
FRED_SERIES_MAP = {
    'nonfarm_payroll': 'PAYEMS',                  # Total Nonfarm Payroll
    'civilian_employment': 'EMRATIO',             # Employment-Population Ratio
    'labor_force': 'CLF16OV',                     # Civilian Labor Force
    'total_employed': 'TOTALSA',                  # Total Employed
}


class FREDEmploymentFetcher(Fetcher[EmploymentQueryParams, EmploymentData]):
    """
    FRED (Federal Reserve Economic Data) Employment Fetcher

    Uses FredSeriesFetcher for common API logic.
    """

    @staticmethod
    def transform_query(params: Dict[str, Any]) -> EmploymentQueryParams:
        """쿼리 파라미터 변환"""
        return EmploymentQueryParams(**params)

    @staticmethod
    def extract_data(
        query: EmploymentQueryParams,
        credentials: Optional[Dict[str, str]] = None,
        **kwargs: Any
    ) -> Dict[str, Any]:
        """
        FRED API에서 고용 데이터 추출

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

        # 고용 데이터 유형별 시리즈 ID 선택
        employment_type = query.employment_type.lower()
        if employment_type not in FRED_SERIES_MAP:
            raise ValueError(f"Unsupported employment type: {employment_type}")

        series_id = FRED_SERIES_MAP[employment_type]

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
                'employment_type': employment_type,
                'country': query.country,
            }

        except Exception as e:
            log.error(f"Error fetching employment data from FRED: {e}")
            raise

    @staticmethod
    def transform_data(
        query: EmploymentQueryParams,
        data: Dict[str, Any],
        **kwargs: Any
    ) -> List[EmploymentData]:
        """
        원시 데이터를 표준 모델로 변환

        Args:
            query: 쿼리 파라미터
            data: 원시 데이터
            **kwargs: 추가 파라미터

        Returns:
            EmploymentData 리스트
        """
        observations = data.get('observations', [])
        employment_type = data.get('employment_type')
        country = data.get('country', 'US')

        employment_data_list = []
        previous_value = None
        previous_date = None

        for obs in observations:
            try:
                date_str = obs.get('date')
                value_str = obs.get('value')

                if not date_str or value_str == '.' or value_str is None:
                    continue

                value = int(float(value_str))
                obs_date = datetime.strptime(date_str, '%Y-%m-%d').date()
                # 사용자 지정 기간 필터링
                if query.start_date and obs_date < query.start_date:
                    continue
                if query.end_date and obs_date > query.end_date:
                    continue


                # 변화 계산
                change_month = None
                change_month_percent = None
                change_year = None

                if previous_value is not None and previous_date:
                    day_diff = (obs_date - previous_date).days

                    # 월간 변화
                    if day_diff >= 20:  # 약 1개월
                        change_month = value - previous_value
                        change_month_percent = (change_month / previous_value * 100) if previous_value > 0 else None

                    # 연간 변화
                    if day_diff >= 350:  # 약 1년
                        change_year = value - previous_value

                previous_value = value
                previous_date = obs_date

                employment_obj = EmploymentData(
                    date=obs_date,
                    value=value,
                    employment_type=employment_type,
                    country=country,
                    change_month=change_month,
                    change_month_percent=change_month_percent,
                    change_year=change_year,
                )

                employment_data_list.append(employment_obj)

            except (ValueError, KeyError) as e:
                log.warning(f"Error parsing employment observation {obs}: {e}")
                continue



        


                return employment_data_list

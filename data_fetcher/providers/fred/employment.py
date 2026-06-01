"""Employment Data Standard Model (고용 데이터)"""
from datetime import date as date_type, datetime, timedelta
from typing import Optional
from pydantic import Field
from data_fetcher.abstract_provider.abstract import BaseQueryParams, BaseData


class EmploymentQueryParams(BaseQueryParams):
    """고용 데이터 조회 파라미터"""

    country: str = Field(
        default="US",
        description="국가 코드"
    )
    employment_type: str = Field(
        default="nonfarm_payroll",
        description="고용 유형 (nonfarm_payroll, civilian_employment, labor_force)"
    )
    start_date: Optional[date_type] = Field(
        default=None,
        description="시작일 (None이면 사용 가능한 모든 데이터)"
    )
    end_date: Optional[date_type] = Field(
        default=None,
        description="종료일 (None이면 최신 데이터까지)"
    )


class EmploymentData(BaseData):
    """고용 데이터"""

    date: date_type = Field(
        description="날짜"
    )
    value: int = Field(
        description="고용 수 (천 단위)"
    )
    employment_type: str = Field(
        description="고용 유형"
    )
    country: Optional[str] = Field(
        default=None,
        description="국가 코드"
    )
    change_month: Optional[int] = Field(
        default=None,
        description="전월 대비 변화 (천 단위)"
    )
    change_month_percent: Optional[float] = Field(
        default=None,
        description="전월 대비 변화율 (%)"
    )
    change_year: Optional[int] = Field(
        default=None,
        description="전년 대비 변화 (천 단위)"
    )


"""FRED API Employment Data Fetcher"""
import logging
from datetime import datetime, date as date_type
from typing import Any, Dict, List, Optional

from data_fetcher.abstract_provider.abstract.fetcher import Fetcher
from data_fetcher.providers.fred.utils.helpers import FredSeriesHelper as FredSeriesFetcher
from data_fetcher.utils.api_keys import get_api_key

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
    async def aextract_data(
        query: EmploymentQueryParams,
        credentials: Optional[Dict[str, str]] = None,
        **kwargs: Any
    ) -> List[Dict[str, Any]]:
        api_key = get_api_key(
            credentials=credentials,
            api_name="FRED",
            env_var="FRED_API_KEY"
        )

        employment_type = query.employment_type.lower()
        if employment_type not in FRED_SERIES_MAP:
            raise ValueError(f"Unsupported employment type: {employment_type}")

        return await FredSeriesFetcher.fetch_series(
            series_id=FRED_SERIES_MAP[employment_type],
            api_key=api_key,
            start_date=query.start_date,
            end_date=query.end_date,
            limit=400,
        )

    @staticmethod
    def transform_data(
        query: EmploymentQueryParams,
        data: List[Dict[str, Any]],
        **kwargs: Any
    ) -> List[EmploymentData]:
        observations = data or []
        employment_type = query.employment_type.lower()
        country = query.country

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

        log.info(
            f"Filtered employment data: {len(employment_data_list)} records "
            f"(start: {query.start_date}, end: {query.end_date})"
        )

        # 날짜순으로 정렬
        employment_data_list.sort(key=lambda x: x.date)

        return employment_data_list

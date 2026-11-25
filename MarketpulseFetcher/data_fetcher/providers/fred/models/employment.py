"""Employment Data Standard Model (고용 데이터)"""
import asyncio
import logging
from datetime import date as date_type, datetime
from typing import Optional, Any, Dict, List

from pydantic import Field

from data_fetcher.abstract_provider.abstract.base_fetchers import ApiFetcher
from data_fetcher.abstract_provider.standard_models.fred_series import (
    FredSeriesQueryParams,
    FredSeriesData,
)
from data_fetcher.providers.fred.models.generic_series import FREDGenericSeriesFetcher
from data_fetcher.providers.fred.utils.units import attach_units, with_units


class EmploymentQueryParams(FredSeriesQueryParams):
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


class EmploymentData(FredSeriesData):
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


# ────────────────────────────────────────────────────────────────────────────
# FRED API Employment Data Fetcher


log = logging.getLogger(__name__)


def _int(v):
    return int(round(v)) if v is not None else None


# 파생 칸은 FRED 가 계산해 준다 (units — utils/units.py)
_UNITS = {'change_month': 'chg', 'change_month_percent': 'pch', 'change_year': 'ch1'}

# FRED Employment Series IDs
FRED_SERIES_MAP = {
    'nonfarm_payroll': 'PAYEMS',                  # Total Nonfarm Payroll
    'civilian_employment': 'EMRATIO',             # Employment-Population Ratio
    'labor_force': 'CLF16OV',                     # Civilian Labor Force
    'total_employed': 'TOTALSA',                  # Total Employed
}


class FREDEmploymentFetcher(ApiFetcher[EmploymentQueryParams, EmploymentData]):
    """
    FRED (Federal Reserve Economic Data) Employment Fetcher

    Uses FREDGenericSeriesFetcher (the only FRED HTTP call) for observations.
    """

    api_name = "FRED"
    api_key_env = "FRED_API_KEY"

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
        employment_type = query.employment_type.lower()
        if employment_type not in FRED_SERIES_MAP:
            raise ValueError(f"Unsupported employment type: {employment_type}")

        return attach_units(await asyncio.gather(*[
            FREDGenericSeriesFetcher.fetch_data(p, credentials)
            for p in with_units(dict(
                series_id=FRED_SERIES_MAP[employment_type],
                start_date=query.start_date,
                end_date=query.end_date,
                limit=400,
                sort_order='desc',
            ), _UNITS)
        ], return_exceptions=True), _UNITS)

    @staticmethod
    def transform_data(
        query: EmploymentQueryParams,
        data: List[Dict[str, Any]],
        **kwargs: Any
    ) -> List[EmploymentData]:
        # 날짜 오름차순 (FRED 는 desc 로 받는다)
        observations = sorted(data or [], key=lambda o: o.get('date') or '')
        employment_type = query.employment_type.lower()
        country = query.country

        employment_data_list = []

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


                # FRED units — chg(전월 대비) · pch(전월 대비 %) · ch1(전년 대비)
                change_month = _int(obs.get('change_month'))
                change_month_percent = obs.get('change_month_percent')
                change_year = _int(obs.get('change_year'))

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

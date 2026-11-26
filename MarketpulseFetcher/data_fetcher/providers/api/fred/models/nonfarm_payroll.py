"""Non-Farm Payroll (비농업 취업자) Standard Model"""
import asyncio
import logging
from datetime import date as date_type, datetime, timedelta
from typing import Optional, Any, Dict, List

from pydantic import Field

from data_fetcher.abstract_provider.abstract.base_fetchers import ApiFetcher
from data_fetcher.abstract_provider.standard_models.fred_series import (
    FredSeriesQueryParams,
    FredSeriesData,
)
from data_fetcher.providers.api.fred.models.generic_series import FREDGenericSeriesFetcher
from data_fetcher.providers.api.fred.utils.units import attach_units, with_units


class NonfarmPayrollQueryParams(FredSeriesQueryParams):
    """비농업 취업자 조회 파라미터"""

    country: str = Field(
        default="US",
        description="국가 코드 (US만 지원)"
    )
    start_date: Optional[date_type] = Field(
        default_factory=lambda: (datetime.now().date() - timedelta(days=365*5)),
        description="시작일 (기본값: 5년 전)"
    )
    end_date: Optional[date_type] = Field(
        default=None,
        description="종료일 (None이면 최신 데이터까지)"
    )
    frequency: str = Field(
        default="monthly",
        description="데이터 빈도 (monthly)"
    )
    sector: str = Field(
        default="total",
        description="업종 (total, manufacturing, service, government)"
    )


class NonfarmPayrollData(FredSeriesData):
    """비농업 취업자 데이터 모델"""

    date: date_type = Field(
        description="데이터 날짜"
    )
    value: float = Field(
        description="취업자 수"
    )
    country: Optional[str] = Field(
        default="US",
        description="국가 코드"
    )
    sector: Optional[str] = Field(
        default="total",
        description="업종"
    )
    unit: Optional[str] = Field(
        default="Thousands of Persons",
        description="단위"
    )
    month_over_month_change: Optional[float] = Field(
        default=None,
        description="월간 변화 (천 명)"
    )
    unemployment_rate: Optional[float] = Field(
        default=None,
        description="실업률 (%)"
    )
    average_hourly_earnings: Optional[float] = Field(
        default=None,
        description="시간당 평균 임금 (달러)"
    )
    is_revised: Optional[bool] = Field(
        default=False,
        description="수정된 데이터 여부"
    )


# ────────────────────────────────────────────────────────────────────────────
# FRED API Non-Farm Payroll Fetcher


log = logging.getLogger(__name__)

# 파생 칸은 FRED 가 계산해 준다 (units — utils/units.py)
_UNITS = {'month_over_month_change': 'chg'}

# FRED Non-Farm Payroll Series IDs
FRED_SERIES_MAP = {
    'total': 'PAYEMS',                     # Total Non-Farm Payroll
    'manufacturing': 'MMNRNJ',             # Manufacturing Payroll
    'service': 'SRVPRD',                   # Service-Providing Payroll
    'government': 'GOVTG',                 # Government Payroll
}


class FREDNonfarmPayrollFetcher(ApiFetcher[NonfarmPayrollQueryParams, NonfarmPayrollData]):
    """
    FRED Non-Farm Payroll Fetcher

    Uses FREDGenericSeriesFetcher (the only FRED HTTP call) for observations.
    """

    api_name = "FRED"
    api_key_env = "FRED_API_KEY"

    @staticmethod
    def transform_query(params: Dict[str, Any]) -> NonfarmPayrollQueryParams:
        """쿼리 파라미터 변환"""
        return NonfarmPayrollQueryParams(**params)

    @staticmethod
    async def aextract_data(
        query: NonfarmPayrollQueryParams,
        credentials: Optional[Dict[str, str]] = None,
        **kwargs: Any
    ) -> List[Dict[str, Any]]:
        if query.country != 'US':
            log.warning(f"Only US Non-Farm Payroll is supported via FRED, got {query.country}")

        sector = query.sector.lower()
        observations = attach_units(await asyncio.gather(*[
            FREDGenericSeriesFetcher.fetch_data(p, credentials)
            for p in with_units(dict(
                series_id=FRED_SERIES_MAP.get(sector, FRED_SERIES_MAP['total']),
                start_date=query.start_date,
                end_date=query.end_date,
                limit=400,
                sort_order='desc',
            ), _UNITS)
        ], return_exceptions=True), _UNITS)

        unemployment_map: Dict[str, float] = {}
        try:
            unemployment_obs = [d.model_dump() for d in await FREDGenericSeriesFetcher.fetch_data(dict(
                series_id='UNRATE',
                start_date=query.start_date,
                end_date=query.end_date,
                limit=400,
                sort_order='desc',
            ), credentials)]
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
        # 날짜 오름차순 (FRED 는 desc 로 받는다)
        observations = sorted(data or [], key=lambda o: o.get('date') or '')
        sector = query.sector.lower()
        country = query.country

        nfp_data_list = []

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


                mom_change = obs.get('month_over_month_change')          # FRED units=chg (천 명)

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

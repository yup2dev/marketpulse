"""Housing Starts (주택 건설 착공) Standard Model"""
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


class HousingStartsQueryParams(FredSeriesQueryParams):
    """주택 건설 착공 조회 파라미터"""

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
        description="데이터 빈도 (monthly, annual)"
    )
    unit: str = Field(
        default="thousands",
        description="단위 (thousands, millions)"
    )


class HousingStartsData(FredSeriesData):
    """주택 건설 착공 데이터 모델"""

    date: date_type = Field(
        description="데이터 날짜"
    )
    value: float = Field(
        description="주택 건설 착공 수"
    )
    country: Optional[str] = Field(
        default="US",
        description="국가 코드"
    )
    unit: Optional[str] = Field(
        default="Thousands of Units",
        description="단위"
    )
    month_over_month_change: Optional[float] = Field(
        default=None,
        description="월간 변화율 (%)"
    )
    year_over_year_change: Optional[float] = Field(
        default=None,
        description="전년도 대비 변화율 (%)"
    )
    permits: Optional[float] = Field(
        default=None,
        description="건축 허가 수 (단위: 천 호)"
    )


# ────────────────────────────────────────────────────────────────────────────
# FRED API Housing Starts Fetcher


log = logging.getLogger(__name__)

# 파생 칸은 FRED 가 계산해 준다 (units — utils/units.py)
_UNITS = {'month_over_month_change': 'pch'}

# FRED Housing Series IDs
FRED_SERIES_MAP = {
    'total': 'HOUST',              # Total Housing Starts
    'single_family': 'HOUST1F',    # Single Family Housing Starts
    'permits': 'PERMIT',           # Building Permits
}


class FREDHousingStartsFetcher(ApiFetcher[HousingStartsQueryParams, HousingStartsData]):
    """
    FRED Housing Starts Fetcher

    Uses FREDGenericSeriesFetcher (the only FRED HTTP call) for observations.
    """

    api_name = "FRED"
    api_key_env = "FRED_API_KEY"

    @staticmethod
    def transform_query(params: Dict[str, Any]) -> HousingStartsQueryParams:
        """쿼리 파라미터 변환"""
        return HousingStartsQueryParams(**params)

    @staticmethod
    async def aextract_data(
        query: HousingStartsQueryParams,
        credentials: Optional[Dict[str, str]] = None,
        **kwargs: Any
    ) -> List[Dict[str, Any]]:
        if query.country != 'US':
            log.warning(f"Only US Housing Starts is supported via FRED, got {query.country}")

        observations = attach_units(await asyncio.gather(*[
            FREDGenericSeriesFetcher.fetch_data(p, credentials)
            for p in with_units(dict(
                series_id=FRED_SERIES_MAP['total'],
                start_date=query.start_date,
                end_date=query.end_date,
                limit=400,
                sort_order='desc',
            ), _UNITS)
        ], return_exceptions=True), _UNITS)

        permits_map: Dict[str, float] = {}
        try:
            permits_obs = [d.model_dump() for d in await FREDGenericSeriesFetcher.fetch_data(dict(
                series_id=FRED_SERIES_MAP['permits'],
                start_date=query.start_date,
                end_date=query.end_date,
                limit=400,
                sort_order='desc',
            ), credentials)]
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
        # 날짜 오름차순 (FRED 는 desc 로 받는다)
        observations = sorted(data or [], key=lambda o: o.get('date') or '')
        country = query.country

        hs_data_list = []

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


                mom_change = obs.get('month_over_month_change')          # FRED units=pch

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

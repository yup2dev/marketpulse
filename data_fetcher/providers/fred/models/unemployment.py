"""FRED Unemployment provider (standard Unemployment 모델 경유)."""
from datetime import date as date_type, datetime, timedelta
from typing import Optional
from pydantic import Field
from data_fetcher.abstract_provider.standard_models.unemployment import (
    UnemploymentQueryParams as BaseUnemploymentQueryParams,
    UnemploymentData as BaseUnemploymentData,
)


class FredUnemploymentQueryParams(BaseUnemploymentQueryParams):
    """FRED 실업률 조회 파라미터 (standard 경유, provider 고유 필드 추가)."""

    # standard 기본값(country="united_states")을 FRED 동작에 맞게 override
    country: str = Field(default="US", description="국가 코드")
    age_group: Optional[str] = Field(
        default="all",
        description="연령대 (all, 16-19, 20-24, 25-54, 55+)",
    )


class FredUnemploymentData(BaseUnemploymentData):
    """FRED 실업률 데이터 (standard date/country/value 경유, 보조 필드 추가)."""

    labor_force: Optional[int] = Field(default=None, description="노동인구 (명)")
    employed: Optional[int] = Field(default=None, description="취업자 수 (명)")
    unemployed: Optional[int] = Field(default=None, description="실업자 수 (명)")
    participation_rate: Optional[float] = Field(
        default=None, description="경제활동참가율 (%)"
    )


"""FRED API Unemployment Data Fetcher"""
import logging
from datetime import datetime
from typing import Any, Dict, List, Optional

from data_fetcher.abstract_provider.abstract.base_fetchers import ApiFetcher
from data_fetcher.providers.fred.utils.helpers import FredSeriesHelper as FredSeriesFetcher
from data_fetcher.utils.api_keys import get_api_key

log = logging.getLogger(__name__)

# FRED Unemployment Series IDs
FRED_SERIES_MAP = {
    'total': 'UNRATE',                    # Unemployment Rate
    'civilian': 'CIVPART',                # Civilian Labor Force Participation Rate
    'employed': 'EMRATIO',                # Employment-Population Ratio
    '16_19': 'LNU04000061',               # Unemployment Rate - 16 to 19 years
    '20_24': 'LNU04000062',               # Unemployment Rate - 20 to 24 years
    '25_54': 'LNU04000063',               # Unemployment Rate - 25 to 54 years
    '55_plus': 'LNU04000064',             # Unemployment Rate - 55 years and over
}

AGE_GROUP_MAP = {
    'all': 'total',
    '16-19': '16_19',
    '20-24': '20_24',
    '25-54': '25_54',
    '55+': '55_plus',
}


class FREDUnemploymentFetcher(ApiFetcher[FredUnemploymentQueryParams, FredUnemploymentData]):
    """
    FRED (Federal Reserve Economic Data) Unemployment Rate Fetcher

    Uses FredSeriesFetcher for common API logic.
    """

    api_name = "FRED"
    api_key_env = "FRED_API_KEY"

    @staticmethod
    def transform_query(params: Dict[str, Any]) -> FredUnemploymentQueryParams:
        """쿼리 파라미터 변환"""
        return FredUnemploymentQueryParams(**params)

    @staticmethod
    async def aextract_data(
        query: FredUnemploymentQueryParams,
        credentials: Optional[Dict[str, str]] = None,
        **kwargs: Any
    ) -> List[Dict[str, Any]]:
        api_key = get_api_key(
            credentials=credentials,
            api_name="FRED",
            env_var="FRED_API_KEY"
        )

        if query.country != 'US':
            log.warning(f"Only US unemployment rate is supported via FRED, got {query.country}")

        age_group = getattr(query, 'age_group', 'all').lower()
        series_key = AGE_GROUP_MAP.get(age_group, 'total')

        observations = await FredSeriesFetcher.fetch_series(
            series_id=FRED_SERIES_MAP[series_key],
            api_key=api_key,
            start_date=query.start_date,
            end_date=query.end_date,
            limit=400,
        )

        # 보조 시리즈 (참가율, 고용률) → 날짜별 맵
        aux_maps: Dict[str, Dict[str, float]] = {'participation': {}, 'employment': {}}
        labor_series = {
            'participation': FRED_SERIES_MAP['civilian'],
            'employment': FRED_SERIES_MAP['employed'],
        }
        for key, sid in labor_series.items():
            try:
                aux_obs = await FredSeriesFetcher.fetch_series(
                    series_id=sid,
                    api_key=api_key,
                    start_date=query.start_date,
                    end_date=query.end_date,
                    limit=400,
                )
                aux_maps[key] = {
                    o['date']: float(o['value'])
                    for o in aux_obs
                    if o.get('value') not in ('.', None)
                }
            except Exception as e:
                log.warning(f"Error fetching auxiliary data {key}: {e}")

        for obs in observations:
            d = obs.get('date')
            obs['participation_rate'] = aux_maps['participation'].get(d)
            obs['employment_ratio'] = aux_maps['employment'].get(d)
        return observations

    @staticmethod
    def transform_data(
        query: FredUnemploymentQueryParams,
        data: List[Dict[str, Any]],
        **kwargs: Any
    ) -> List[FredUnemploymentData]:
        observations = data or []
        country = query.country

        unemployment_data_list = []

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


                # 보조 데이터 (extract에서 행마다 병합됨)
                participation_rate = obs.get('participation_rate')
                employment_ratio = obs.get('employment_ratio')

                # 고용자 수 및 실업자 수 추정 (참고용)
                # 실제로는 별도의 데이터 소스에서 가져와야 함
                labor_force = None
                employed = None
                unemployed = None

                unemployment_obj = FredUnemploymentData(
                    date=obs_date,
                    value=value,
                    country=country,
                    labor_force=labor_force,
                    employed=employed,
                    unemployed=unemployed,
                    participation_rate=participation_rate
                )

                unemployment_data_list.append(unemployment_obj)

            except (ValueError, KeyError) as e:
                log.warning(f"Error parsing unemployment observation {obs}: {e}")
                continue

        log.info(
            f"Filtered unemployment data: {len(unemployment_data_list)} records "
            f"(start: {query.start_date}, end: {query.end_date})"
        )

        # 날짜순으로 정렬
        unemployment_data_list.sort(key=lambda x: x.date)

        return unemployment_data_list

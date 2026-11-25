"""Industrial Production Index (산업 생산 지수) Standard Model"""
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
from data_fetcher.providers.fred.models.generic_series import FREDGenericSeriesFetcher
from data_fetcher.providers.fred.utils.units import attach_units, with_units


class IndustrialProductionQueryParams(FredSeriesQueryParams):
    """산업 생산 지수 조회 파라미터"""

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
    category: str = Field(
        default="total",
        description="카테고리 (total, manufacturing, mining, utilities)"
    )


class IndustrialProductionData(FredSeriesData):
    """산업 생산 지수 데이터 모델"""

    date: date_type = Field(
        description="데이터 날짜"
    )
    value: float = Field(
        description="산업 생산 지수 (2012년=100)"
    )
    country: Optional[str] = Field(
        default="US",
        description="국가 코드"
    )
    category: Optional[str] = Field(
        default="total",
        description="카테고리"
    )
    unit: Optional[str] = Field(
        default="Index (2012=100)",
        description="단위"
    )
    growth_rate: Optional[float] = Field(
        default=None,
        description="월간/연간 성장률 (%)"
    )
    previous_value: Optional[float] = Field(
        default=None,
        description="이전 기간 값"
    )


# ────────────────────────────────────────────────────────────────────────────
# FRED API Industrial Production Index Fetcher


log = logging.getLogger(__name__)

# 파생 칸은 FRED 가 계산해 준다 (units — utils/units.py)
_UNITS = {'growth_rate': 'pch'}

# FRED Industrial Production Series IDs
FRED_SERIES_MAP = {
    'total': 'INDPRO',                          # Total Industrial Production Index
    'manufacturing': 'MMNRNJ',                  # Manufacturing Production Index
    'mining': 'IMGMNSA',                        # Mining Production Index
    'utilities': 'IPUTSL',                      # Utilities Production Index
}


class FREDIndustrialProductionFetcher(ApiFetcher[IndustrialProductionQueryParams, IndustrialProductionData]):
    """
    FRED Industrial Production Index Fetcher

    Uses FREDGenericSeriesFetcher (the only FRED HTTP call) for observations.
    """

    api_name = "FRED"
    api_key_env = "FRED_API_KEY"

    @staticmethod
    def transform_query(params: Dict[str, Any]) -> IndustrialProductionQueryParams:
        """쿼리 파라미터 변환"""
        return IndustrialProductionQueryParams(**params)

    @staticmethod
    async def aextract_data(
        query: IndustrialProductionQueryParams,
        credentials: Optional[Dict[str, str]] = None,
        **kwargs: Any
    ) -> List[Dict[str, Any]]:
        if query.country != 'US':
            log.warning(f"Only US Industrial Production is supported via FRED, got {query.country}")

        category = query.category.lower()
        series_id = FRED_SERIES_MAP.get(category, FRED_SERIES_MAP['total'])

        return attach_units(await asyncio.gather(*[
            FREDGenericSeriesFetcher.fetch_data(p, credentials)
            for p in with_units(dict(
                series_id=series_id,
                start_date=query.start_date,
                end_date=query.end_date,
                limit=400,
                sort_order='desc',
            ), _UNITS)
        ], return_exceptions=True), _UNITS)

    @staticmethod
    def transform_data(
        query: IndustrialProductionQueryParams,
        data: List[Dict[str, Any]],
        **kwargs: Any
    ) -> List[IndustrialProductionData]:
        # 날짜 오름차순 (FRED 는 desc 로 받는다)
        observations = sorted(data or [], key=lambda o: o.get('date') or '')
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


                growth_rate = obs.get('growth_rate')          # FRED units=pch

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

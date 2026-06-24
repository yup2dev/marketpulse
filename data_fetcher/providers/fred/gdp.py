"""GDP (Gross Domestic Product) Standard Model"""
from datetime import date as date_type, datetime, timedelta
from typing import Optional
from pydantic import Field
from data_fetcher.abstract_provider.standard_models.fred_series import (
    FredSeriesQueryParams,
    FredSeriesData,
)


class GDPQueryParams(FredSeriesQueryParams):
    """GDP 조회 파라미터"""

    country: str = Field(
        default="US",
        description="국가 코드 (US, KR, CN 등)"
    )
    start_date: Optional[date_type] = Field(
        default=None,
        description="시작일 (None이면 사용 가능한 모든 데이터)"
    )
    end_date: Optional[date_type] = Field(
        default=None,
        description="종료일 (None이면 최신 데이터까지)"
    )
    frequency: str = Field(
        default="quarterly",
        description="데이터 빈도 (annual, quarterly)"
    )


class GDPData(FredSeriesData):
    """GDP 데이터 모델"""

    date: date_type = Field(
        description="데이터 날짜"
    )
    value: float = Field(
        description="GDP 값 (단위: 십억 달러 또는 현지 통화)"
    )
    country: Optional[str] = Field(
        default=None,
        description="국가 코드"
    )
    unit: Optional[str] = Field(
        default="Billions of Dollars",
        description="단위"
    )
    growth_rate: Optional[float] = Field(
        default=None,
        description="GDP 성장률 (%)"
    )


class GDPRealData(GDPData):
    """실질 GDP 데이터 (인플레이션 조정)"""

    is_real: bool = Field(
        default=True,
        description="실질 GDP 여부"
    )
    base_year: Optional[int] = Field(
        default=None,
        description="기준년도"
    )


class GDPNominalData(GDPData):
    """명목 GDP 데이터 (인플레이션 미조정)"""

    is_real: bool = Field(
        default=False,
        description="실질 GDP 여부"
    )


class GDPPerCapitaData(FredSeriesData):
    """1인당 GDP 데이터"""

    date: date_type = Field(
        description="데이터 날짜"
    )
    value: float = Field(
        description="1인당 GDP"
    )
    country: Optional[str] = Field(
        default=None,
        description="국가 코드"
    )
    population: Optional[int] = Field(
        default=None,
        description="인구 수"
    )


"""FRED API GDP Data Fetcher"""
import logging
from typing import Any, Dict, List, Optional

from data_fetcher.abstract_provider.abstract.fetcher import Fetcher
from data_fetcher.providers.fred.utils.helpers import FredSeriesHelper as FredSeriesFetcher
from data_fetcher.utils.api_keys import get_api_key

log = logging.getLogger(__name__)

# FRED GDP Series IDs
FRED_SERIES_MAP = {
    'nominal': 'A191RA1Q225SBEA',      # Nominal GDP (Billions)
    'real': 'A191RL1Q225SBEA',          # Real GDP (Chained 2012 Dollars)
    'per_capita': 'A4701A1Q225SBEA',    # Real GDP per Capita
    'quarterly': 'GDPC1',                # Real GDP (Quarterly)
}


class FREDGDPFetcher(Fetcher[GDPQueryParams, GDPData]):
    """FRED (Federal Reserve Economic Data) GDP Fetcher

    Uses FredSeriesFetcher for common API logic.
    """

    @staticmethod
    def transform_query(params: Dict[str, Any]) -> GDPQueryParams:
        """쿼리 파라미터 변환"""
        return GDPQueryParams(**params)

    @staticmethod
    async def aextract_data(
        query: GDPQueryParams,
        credentials: Optional[Dict[str, str]] = None,
        **kwargs: Any
    ) -> List[Dict[str, Any]]:
        api_key = get_api_key(
            credentials=credentials,
            api_name="FRED",
            env_var="FRED_API_KEY"
        )

        if query.country != 'US':
            log.warning(f"Only US GDP is supported via FRED, got {query.country}")

        frequency = query.frequency.lower()
        series_id = FRED_SERIES_MAP['real'] if frequency == 'quarterly' else FRED_SERIES_MAP['nominal']

        return await FredSeriesFetcher.fetch_series(
            series_id=series_id,
            api_key=api_key,
            start_date=query.start_date,
            end_date=query.end_date,
            limit=400,
        )

    @staticmethod
    def transform_data(
        query: GDPQueryParams,
        data: List[Dict[str, Any]],
        **kwargs: Any
    ) -> List[GDPData]:
        observations = data or []
        country = query.country
        is_real = query.frequency.lower() == 'quarterly'
        Model = GDPRealData if is_real else GDPData
        unit = 'Billions of Chained 2012 Dollars' if is_real else 'Billions of Dollars'

        # FRED uses "." for missing values; normalize and filter
        clean = []
        for obs in observations:
            value_str = obs.get('value')
            date_str = obs.get('date')
            if not date_str or value_str in (None, '.', ''):
                continue
            try:
                value = float(value_str)
            except (TypeError, ValueError):
                continue
            clean.append({'date': date_str, 'value': value})

        if query.start_date:
            sd = query.start_date.isoformat()
            clean = [r for r in clean if r['date'] >= sd]
        if query.end_date:
            ed = query.end_date.isoformat()
            clean = [r for r in clean if r['date'] <= ed]

        clean.sort(key=lambda r: r['date'])

        gdp_data_list: List[GDPData] = []
        previous_value = None

        for row in clean:
            value = row['value']

            growth_rate = None
            if previous_value and previous_value != 0:
                growth_rate = ((value - previous_value) / previous_value) * 100
            previous_value = value

            payload = {
                'date': row['date'],
                'value': value,
                'country': country,
                'unit': unit,
                'growth_rate': growth_rate,
            }
            if is_real:
                payload['is_real'] = True
                payload['base_year'] = 2016

            gdp_data_list.append(Model.model_validate(payload))

        log.info(
            f"Filtered GDP data: {len(gdp_data_list)} records "
            f"(start: {query.start_date}, end: {query.end_date})"
        )

        return gdp_data_list

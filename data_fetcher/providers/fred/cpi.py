"""Consumer Price Index (CPI) Standard Model"""
from datetime import date as date_type, datetime, timedelta
from typing import Optional
from pydantic import Field
from data_fetcher.abstract_provider.abstract import BaseQueryParams, BaseData


class CPIQueryParams(BaseQueryParams):
    """CPI 조회 파라미터"""

    country: str = Field(
        default="US",
        description="국가 코드"
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
        default="monthly",
        description="데이터 빈도 (monthly, quarterly, annual)"
    )


class CPIData(BaseData):
    """소비자물가지수 데이터"""

    date: date_type = Field(
        description="데이터 날짜"
    )
    value: float = Field(
        description="CPI 지수 값"
    )
    country: Optional[str] = Field(
        default=None,
        description="국가 코드"
    )
    category: Optional[str] = Field(
        default="All Items",
        description="CPI 카테고리"
    )
    change_month: Optional[float] = Field(
        default=None,
        description="전월 대비 변화율 (%)"
    )
    change_year: Optional[float] = Field(
        default=None,
        description="전년 대비 변화율 (%)"
    )


class CoreCPIData(CPIData):
    """핵심 CPI 데이터 (식품 및 에너지 제외)"""

    is_core: bool = Field(
        default=True,
        description="핵심 CPI 여부"
    )
    excluded_items: str = Field(
        default="Food and Energy",
        description="제외 항목"
    )


"""FRED API CPI Data Fetcher"""
import logging
from typing import Any, Dict, List, Optional

from data_fetcher.abstract_provider.abstract.fetcher import Fetcher
from data_fetcher.providers.fred.utils.helpers import FredSeriesHelper as FredSeriesFetcher
from data_fetcher.utils.api_keys import get_api_key

log = logging.getLogger(__name__)

# FRED CPI Series IDs
FRED_SERIES_MAP = {
    'all_items': 'CPIAUCSL',              # Consumer Price Index - All Items
    'all_items_core': 'CPILFESL',         # Consumer Price Index - Core (Excluding Food and Energy)
    'food': 'CPIUFDSL',                   # Food
    'energy': 'CPIUEDSL',                 # Energy
    'transportation': 'CPIUTRAN',         # Transportation
    'medical': 'CPIMEDSL',                # Medical Care
}


class FREDCPIFetcher(Fetcher[CPIQueryParams, CPIData]):
    """FRED (Federal Reserve Economic Data) CPI Fetcher

    Uses FredSeriesFetcher for common API logic.
    """

    @staticmethod
    def transform_query(params: Dict[str, Any]) -> CPIQueryParams:
        """쿼리 파라미터 변환"""
        return CPIQueryParams(**params)

    CATEGORY_MAP = {
        'all items': 'all_items',
        'core': 'all_items_core',
        'food': 'food',
        'energy': 'energy',
        'transportation': 'transportation',
        'medical': 'medical',
    }

    @staticmethod
    async def aextract_data(
        query: CPIQueryParams,
        credentials: Optional[Dict[str, str]] = None,
        **kwargs: Any
    ) -> List[Dict[str, Any]]:
        api_key = get_api_key(
            credentials=credentials,
            api_name="FRED",
            env_var="FRED_API_KEY"
        )

        if query.country != 'US':
            log.warning(f"Only US CPI is supported via FRED, got {query.country}")

        category = getattr(query, 'category', 'All Items').lower()
        series_key = FREDCPIFetcher.CATEGORY_MAP.get(category, 'all_items')
        series_id = FRED_SERIES_MAP[series_key]

        return await FredSeriesFetcher.fetch_series(
            series_id=series_id,
            api_key=api_key,
            start_date=query.start_date,
            end_date=query.end_date,
            limit=400,
        )

    @staticmethod
    def transform_data(
        query: CPIQueryParams,
        data: List[Dict[str, Any]],
        **kwargs: Any
    ) -> List[CPIData]:
        observations = data or []
        country = query.country
        category = getattr(query, 'category', 'All Items').lower()
        is_core = category == 'core'
        Model = CoreCPIData if is_core else CPIData

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

        # 사용자 지정 기간 필터링 (문자열 비교 가능: YYYY-MM-DD)
        if query.start_date:
            sd = query.start_date.isoformat()
            clean = [r for r in clean if r['date'] >= sd]
        if query.end_date:
            ed = query.end_date.isoformat()
            clean = [r for r in clean if r['date'] <= ed]

        clean.sort(key=lambda r: r['date'])

        # 변화율 계산
        cpi_data_list: List[CPIData] = []
        previous_value = None
        previous_ym: Optional[tuple] = None

        for row in clean:
            value = row['value']
            y, m, _ = row['date'].split('-')
            y, m = int(y), int(m)

            change_month = None
            change_year = None
            if previous_value and previous_value != 0:
                change_month = ((value - previous_value) / previous_value) * 100
            if previous_ym and previous_value:
                month_diff = (y - previous_ym[0]) * 12 + (m - previous_ym[1])
                if month_diff >= 12:
                    change_year = ((value - previous_value) / previous_value) * 100

            previous_value = value
            previous_ym = (y, m)

            payload = {
                'date': row['date'],
                'value': value,
                'country': country,
                'category': category,
                'change_month': change_month,
                'change_year': change_year,
            }
            if is_core:
                payload['is_core'] = True
                payload['excluded_items'] = 'Food and Energy'

            cpi_data_list.append(Model.model_validate(payload))

        log.info(
            f"Filtered CPI data: {len(cpi_data_list)} records "
            f"(start: {query.start_date}, end: {query.end_date})"
        )

        return cpi_data_list

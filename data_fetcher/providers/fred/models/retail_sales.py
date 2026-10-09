"""Retail Sales (소매 판매) Standard Model"""
from datetime import date as date_type, datetime, timedelta
from typing import Optional
from pydantic import Field
from data_fetcher.abstract_provider.standard_models.fred_series import (
    FredSeriesQueryParams,
    FredSeriesData,
)


class RetailSalesQueryParams(FredSeriesQueryParams):
    """소매 판매 조회 파라미터"""

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
        description="카테고리 (total, excluding_autos, gasoline_stations)"
    )


class RetailSalesData(FredSeriesData):
    """소매 판매 데이터 모델"""

    date: date_type = Field(
        description="데이터 날짜"
    )
    value: float = Field(
        description="소매 판매액"
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
        default="Billions of Dollars",
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
    is_seasonal_adjusted: Optional[bool] = Field(
        default=True,
        description="계절 조정 여부"
    )


"""FRED API Retail Sales Fetcher"""
import logging
from datetime import datetime, date as date_type
from typing import Any, Dict, List, Optional

from data_fetcher.abstract_provider.abstract.base_fetchers import ApiFetcher
from data_fetcher.providers.fred.utils.helpers import FredSeriesHelper as FredSeriesFetcher
from data_fetcher.utils.api_keys import get_api_key

log = logging.getLogger(__name__)

# FRED Retail Sales Series IDs
FRED_SERIES_MAP = {
    'total': 'RSXFS',                           # Total Retail Sales
    'excluding_autos': 'RSXFSXMV',              # Retail Sales ex-Autos
    'gasoline_stations': 'GASMMNRNSA',          # Gasoline Station Sales
    'food_service': 'EMSRGSP',                  # Food Service Sales
}


class FREDRetailSalesFetcher(ApiFetcher[RetailSalesQueryParams, RetailSalesData]):
    """
    FRED Retail Sales Fetcher

    Uses FredSeriesFetcher for common API logic.
    """

    api_name = "FRED"
    api_key_env = "FRED_API_KEY"

    @staticmethod
    def transform_query(params: Dict[str, Any]) -> RetailSalesQueryParams:
        """쿼리 파라미터 변환"""
        return RetailSalesQueryParams(**params)

    @staticmethod
    async def aextract_data(
        query: RetailSalesQueryParams,
        credentials: Optional[Dict[str, str]] = None,
        **kwargs: Any
    ) -> List[Dict[str, Any]]:
        api_key = get_api_key(
            credentials=credentials,
            api_name="FRED",
            env_var="FRED_API_KEY"
        )

        if query.country != 'US':
            log.warning(f"Only US Retail Sales is supported via FRED, got {query.country}")

        category = query.category.lower()
        series_id = FRED_SERIES_MAP.get(category, FRED_SERIES_MAP['total'])

        return await FredSeriesFetcher.fetch_series(
            series_id=series_id,
            api_key=api_key,
            start_date=query.start_date,
            end_date=query.end_date,
            limit=400,
        )

    @staticmethod
    def transform_data(
        query: RetailSalesQueryParams,
        data: List[Dict[str, Any]],
        **kwargs: Any
    ) -> List[RetailSalesData]:
        observations = data or []
        category = query.category.lower()
        country = query.country

        rs_data_list = []
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


                # 월간 변화율 계산
                mom_change = None
                if previous_value and previous_value != 0:
                    mom_change = ((value - previous_value) / previous_value) * 100

                rs_obj = RetailSalesData(
                    date=obs_date,
                    value=value,
                    country=country,
                    category=category,
                    unit='Billions of Dollars',
                    month_over_month_change=mom_change,
                    is_seasonal_adjusted=True
                )

                rs_data_list.append(rs_obj)
                previous_value = value

            except (ValueError, KeyError) as e:
                log.warning(f"Error parsing retail sales observation {obs}: {e}")
                continue

        log.info(
            f"Filtered retail sales data: {len(rs_data_list)} records "
            f"(start: {query.start_date}, end: {query.end_date})"
        )

        # 날짜순으로 정렬
        rs_data_list.sort(key=lambda x: x.date)

        return rs_data_list

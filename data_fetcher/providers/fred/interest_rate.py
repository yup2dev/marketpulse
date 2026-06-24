"""Interest Rate Standard Model (금리)"""
from datetime import date as date_type, datetime, timedelta
from typing import Optional
from pydantic import Field
from data_fetcher.abstract_provider.standard_models.fred_series import (
    FredSeriesQueryParams,
    FredSeriesData,
)


class InterestRateQueryParams(FredSeriesQueryParams):
    """금리 조회 파라미터"""

    rate_type: str = Field(
        description="금리 유형 (federal_funds, treasury_3m, treasury_6m, treasury_1y, treasury_5y, treasury_10y, treasury_30y, prime_lending)"
    )
    start_date: Optional[date_type] = Field(
        default=None,
        description="시작일 (None이면 사용 가능한 모든 데이터)"
    )
    end_date: Optional[date_type] = Field(
        default=None,
        description="종료일 (None이면 최신 데이터까지)"
    )


class InterestRateData(FredSeriesData):
    """금리 데이터"""

    date: date_type = Field(
        description="날짜"
    )
    rate: float = Field(
        description="금리 (%)"
    )
    rate_type: str = Field(
        description="금리 유형"
    )
    change_day: Optional[float] = Field(
        default=None,
        description="전일 대비 변화 (베이시스 포인트)"
    )
    change_week: Optional[float] = Field(
        default=None,
        description="전주 대비 변화"
    )
    change_month: Optional[float] = Field(
        default=None,
        description="전월 대비 변화"
    )


"""FRED API Interest Rate Data Fetcher"""
import logging
from datetime import datetime, date as date_type
from typing import Any, Dict, List, Optional

from data_fetcher.abstract_provider.abstract.fetcher import Fetcher
from data_fetcher.providers.fred.utils.helpers import FredSeriesHelper as FredSeriesFetcher
from data_fetcher.utils.api_keys import get_api_key

log = logging.getLogger(__name__)

# FRED Interest Rate Series IDs
FRED_SERIES_MAP = {
    'federal_funds': 'FEDFUNDS',                  # Federal Funds Rate
    'treasury_3m': 'DTB3',                        # 3-Month Treasury Bill
    'treasury_6m': 'DTB6',                        # 6-Month Treasury Bill
    'treasury_1y': 'DGS1',                        # 1-Year Treasury Rate
    'treasury_5y': 'DGS5',                        # 5-Year Treasury Rate
    'treasury_10y': 'DGS10',                      # 10-Year Treasury Rate
    'treasury_30y': 'DGS30',                      # 30-Year Treasury Rate
    'prime_lending': 'MPRIME',                    # Prime Lending Rate
}


class FREDInterestRateFetcher(Fetcher[InterestRateQueryParams, InterestRateData]):
    """
    FRED (Federal Reserve Economic Data) Interest Rate Fetcher

    Uses FredSeriesFetcher for common API logic.
    """

    @staticmethod
    def transform_query(params: Dict[str, Any]) -> InterestRateQueryParams:
        """쿼리 파라미터 변환"""
        return InterestRateQueryParams(**params)

    @staticmethod
    async def aextract_data(
        query: InterestRateQueryParams,
        credentials: Optional[Dict[str, str]] = None,
        **kwargs: Any
    ) -> List[Dict[str, Any]]:
        api_key = get_api_key(
            credentials=credentials,
            api_name="FRED",
            env_var="FRED_API_KEY"
        )

        rate_type = query.rate_type.lower()
        if rate_type not in FRED_SERIES_MAP:
            raise ValueError(f"Unsupported interest rate type: {rate_type}")

        return await FredSeriesFetcher.fetch_series(
            series_id=FRED_SERIES_MAP[rate_type],
            api_key=api_key,
            start_date=query.start_date,
            end_date=query.end_date,
            limit=400,
        )

    @staticmethod
    def transform_data(
        query: InterestRateQueryParams,
        data: List[Dict[str, Any]],
        **kwargs: Any
    ) -> List[InterestRateData]:
        observations = data or []
        rate_type = query.rate_type.lower()

        interest_data_list = []
        previous_rate = None
        previous_date = None

        for obs in observations:
            try:
                date_str = obs.get('date')
                value_str = obs.get('value')

                if not date_str or value_str == '.' or value_str is None:
                    continue

                rate = float(value_str)
                obs_date = datetime.strptime(date_str, '%Y-%m-%d').date()
                # 사용자 지정 기간 필터링
                if query.start_date and obs_date < query.start_date:
                    continue
                if query.end_date and obs_date > query.end_date:
                    continue


                # 변화 계산
                change_day = None
                change_week = None
                change_month = None

                if previous_rate is not None:
                    change_day = (rate - previous_rate) * 100  # 베이시스 포인트

                    # 주간, 월간 변화는 간단히 구현 (실제로는 5일, 30일 전 데이터 필요)
                    if previous_date:
                        day_diff = (obs_date - previous_date).days
                        if day_diff >= 7:
                            change_week = (rate - previous_rate) * 100
                        if day_diff >= 30:
                            change_month = (rate - previous_rate) * 100

                previous_rate = rate
                previous_date = obs_date

                interest_obj = InterestRateData(
                    date=obs_date,
                    rate=rate,
                    rate_type=rate_type,
                    change_day=change_day,
                    change_week=change_week,
                    change_month=change_month,
                )

                interest_data_list.append(interest_obj)

            except (ValueError, KeyError) as e:
                log.warning(f"Error parsing interest rate observation {obs}: {e}")
                continue

        log.info(
            f"Filtered interest rate data: {len(interest_data_list)} records "
            f"(start: {query.start_date}, end: {query.end_date})"
        )

        # 날짜순으로 정렬
        interest_data_list.sort(key=lambda x: x.date)

        return interest_data_list

    @classmethod
    def set_data(cls, result, **kwargs):
        """rate 필드를 value로 정규화하여 다른 FRED fetcher와 일관된 포맷 반환"""
        data = super().set_data(result, **kwargs)
        for d in data:
            d['value'] = d.get('rate')
        return data

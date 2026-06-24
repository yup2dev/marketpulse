"""Consumer Sentiment Index (소비자 심리 지수) Standard Model"""
from datetime import date as date_type, datetime, timedelta
from typing import Optional
from pydantic import Field
from data_fetcher.abstract_provider.standard_models.fred_series import (
    FredSeriesQueryParams,
    FredSeriesData,
)


class ConsumerSentimentQueryParams(FredSeriesQueryParams):
    """소비자 심리 지수 조회 파라미터"""

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
        description="데이터 빈도 (monthly, preliminary, final)"
    )


class ConsumerSentimentData(FredSeriesData):
    """소비자 심리 지수 데이터 모델"""

    date: date_type = Field(
        description="데이터 날짜"
    )
    value: float = Field(
        description="소비자 심리 지수 값"
    )
    country: Optional[str] = Field(
        default="US",
        description="국가 코드"
    )
    unit: Optional[str] = Field(
        default="Index",
        description="단위"
    )
    change_from_previous: Optional[float] = Field(
        default=None,
        description="전월 대비 변화"
    )
    frequency_type: Optional[str] = Field(
        default="preliminary",
        description="데이터 타입 (preliminary, final)"
    )
    notes: Optional[str] = Field(
        default=None,
        description="참고 사항"
    )


"""FRED API Consumer Sentiment Index Fetcher"""
import logging
from datetime import datetime, date as date_type
from typing import Any, Dict, List, Optional

from data_fetcher.abstract_provider.abstract.fetcher import Fetcher
from data_fetcher.providers.fred.utils.helpers import FredSeriesHelper as FredSeriesFetcher
from data_fetcher.utils.api_keys import get_api_key

log = logging.getLogger(__name__)

# FRED Consumer Sentiment Series IDs
FRED_SERIES_MAP = {
    'preliminary': 'MMNRNJ',    # Consumer Sentiment Index (Preliminary)
    'final': 'UMCSENT',         # Consumer Sentiment Index (Final)
}


class FREDConsumerSentimentFetcher(Fetcher[ConsumerSentimentQueryParams, ConsumerSentimentData]):
    """
    FRED Consumer Sentiment Index Fetcher

    Uses FredSeriesFetcher for common API logic.
    """

    @staticmethod
    def transform_query(params: Dict[str, Any]) -> ConsumerSentimentQueryParams:
        """쿼리 파라미터 변환"""
        return ConsumerSentimentQueryParams(**params)

    @staticmethod
    async def aextract_data(
        query: ConsumerSentimentQueryParams,
        credentials: Optional[Dict[str, str]] = None,
        **kwargs: Any
    ) -> List[Dict[str, Any]]:
        api_key = get_api_key(
            credentials=credentials,
            api_name="FRED",
            env_var="FRED_API_KEY"
        )

        if query.country != 'US':
            log.warning(f"Only US Consumer Sentiment is supported via FRED, got {query.country}")

        frequency = query.frequency.lower()
        series_id = FRED_SERIES_MAP.get(frequency, FRED_SERIES_MAP['final'])

        return await FredSeriesFetcher.fetch_series(
            series_id=series_id,
            api_key=api_key,
            start_date=query.start_date,
            end_date=query.end_date,
            limit=400,
        )

    @staticmethod
    def transform_data(
        query: ConsumerSentimentQueryParams,
        data: List[Dict[str, Any]],
        **kwargs: Any
    ) -> List[ConsumerSentimentData]:
        observations = data or []
        frequency = query.frequency.lower()
        country = query.country

        cs_data_list = []
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


                # 전월 대비 변화 계산
                change_from_previous = None
                if previous_value is not None:
                    change_from_previous = value - previous_value

                cs_obj = ConsumerSentimentData(
                    date=obs_date,
                    value=value,
                    country=country,
                    unit='Index',
                    change_from_previous=change_from_previous,
                    frequency_type=frequency
                )

                cs_data_list.append(cs_obj)
                previous_value = value

            except (ValueError, KeyError) as e:
                log.warning(f"Error parsing consumer sentiment observation {obs}: {e}")
                continue

        log.info(
            f"Filtered consumer sentiment data: {len(cs_data_list)} records "
            f"(start: {query.start_date}, end: {query.end_date})"
        )

        # 날짜순으로 정렬
        cs_data_list.sort(key=lambda x: x.date)

        return cs_data_list

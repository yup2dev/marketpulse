"""FRED API Interest Rate Data Fetcher"""
import logging
from datetime import datetime, date as date_type
from typing import Any, Dict, List, Optional

from data_fetcher.fetchers.base import Fetcher
from data_fetcher.fetchers.fred.series import FredSeriesFetcher
from data_fetcher.models.fred.interest_rate import InterestRateQueryParams, InterestRateData
from data_fetcher.utils.api_keys import CredentialsError, get_api_key

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
    def extract_data(
        query: InterestRateQueryParams,
        credentials: Optional[Dict[str, str]] = None,
        **kwargs: Any
    ) -> Dict[str, Any]:
        """
        FRED API에서 금리 데이터 추출

        Args:
            query: 쿼리 파라미터
            credentials: FRED API 키 포함 {"api_key": "..."}
            **kwargs: 추가 파라미터

        Returns:
            원시 데이터 딕셔너리

        Raises:
            CredentialsError: FRED API 키가 없을 경우
        """
        # API 키 필수 검증
        api_key = get_api_key(
            credentials=credentials,
            api_name="FRED",
            env_var="FRED_API_KEY"
        )

        # 금리 유형별 시리즈 ID 선택
        rate_type = query.rate_type.lower()
        if rate_type not in FRED_SERIES_MAP:
            raise ValueError(f"Unsupported interest rate type: {rate_type}")

        series_id = FRED_SERIES_MAP[rate_type]

        try:
            # FredSeriesFetcher를 사용하여 데이터 조회 (의존성 활용)
            observations = FredSeriesFetcher.fetch_series(
                series_id=series_id,
                api_key=api_key,
                start_date=query.start_date,
                end_date=query.end_date,
                limit=400
            )

            return {
                'observations': observations,
                'series_id': series_id,
                'rate_type': rate_type,
            }

        except Exception as e:
            log.error(f"Error fetching interest rate data from FRED: {e}")
            raise

    @staticmethod
    def transform_data(
        query: InterestRateQueryParams,
        data: Dict[str, Any],
        **kwargs: Any
    ) -> List[InterestRateData]:
        """
        원시 데이터를 표준 모델로 변환

        Args:
            query: 쿼리 파라미터
            data: 원시 데이터
            **kwargs: 추가 파라미터

        Returns:
            InterestRateData 리스트
        """
        observations = data.get('observations', [])
        rate_type = data.get('rate_type')

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

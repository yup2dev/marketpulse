"""Interest Rate Standard Model (금리)"""
import asyncio
import logging
from datetime import date as date_type, datetime
from typing import Optional, Any, Dict, List

from pydantic import Field

from data_fetcher.abstract_provider.abstract.base_fetchers import ApiFetcher
from data_fetcher.abstract_provider.standard_models.fred_series import (
    FredSeriesQueryParams,
    FredSeriesData,
)
from data_fetcher.providers.api.fred.utils.series import fred_series
from data_fetcher.providers.api.fred.utils.units import attach_units, with_units


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
        description="직전 관측 대비 변화 (베이시스 포인트, FRED units=chg). 일간 시리즈면 전일, 월간이면 전월"
    )


# ────────────────────────────────────────────────────────────────────────────
# FRED API Interest Rate Data Fetcher


log = logging.getLogger(__name__)

# 파생 칸은 FRED 가 계산해 준다 (units — utils/units.py)
_UNITS = {'change_day': 'chg'}

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


class FREDInterestRateFetcher(ApiFetcher[InterestRateQueryParams, InterestRateData]):
    """
    FRED (Federal Reserve Economic Data) Interest Rate Fetcher

    Uses fred_series (utils/series.py — the only FRED HTTP call) for observations.
    """

    api_name = "FRED"
    api_key_env = "FRED_API_KEY"

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
        rate_type = query.rate_type.lower()
        if rate_type not in FRED_SERIES_MAP:
            raise ValueError(f"Unsupported interest rate type: {rate_type}")

        return attach_units(await asyncio.gather(*[
            fred_series(p, credentials)
            for p in with_units(dict(
                series_id=FRED_SERIES_MAP[rate_type],
                start_date=query.start_date,
                end_date=query.end_date,
                limit=400,
                sort_order='desc',
            ), _UNITS)
        ], return_exceptions=True), _UNITS)

    @staticmethod
    def transform_data(
        query: InterestRateQueryParams,
        data: List[Dict[str, Any]],
        **kwargs: Any
    ) -> List[InterestRateData]:
        # 날짜 오름차순 (FRED 는 desc 로 받는다)
        observations = sorted(data or [], key=lambda o: o.get('date') or '')
        rate_type = query.rate_type.lower()

        interest_data_list = []

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


                # 직전 관측 대비 — FRED units=chg (%p) 를 bp 로
                chg = obs.get('change_day')
                change_day = chg * 100 if chg is not None else None

                interest_obj = InterestRateData(
                    date=obs_date,
                    rate=rate,
                    rate_type=rate_type,
                    change_day=change_day,
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

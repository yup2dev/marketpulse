"""Polygon.io Short Interest Model"""
from datetime import date as date_type
from typing import Optional
from pydantic import Field, model_validator
from data_fetcher.abstract_provider.standard_models import ShortInterestQueryParams as _StdShortInterestQueryParams
from data_fetcher.abstract_provider.standard_models import ShortInterestData


class ShortInterestQueryParams(_StdShortInterestQueryParams):
    """공매도 데이터 조회 파라미터"""

    ticker: Optional[str] = Field(
        default=None,
        description="종목 티커 (예: AAPL, TSLA). 미지정 시 표준 symbol에서 채운다."
    )

    @model_validator(mode="after")
    def _ticker_from_symbol(self):
        if not self.ticker:
            self.ticker = self.symbol
        return self
    start_date: Optional[str] = Field(
        default=None,
        description="조회 시작일 (YYYY-MM-DD)"
    )
    end_date: Optional[str] = Field(
        default=None,
        description="조회 종료일 (YYYY-MM-DD)"
    )
    limit: Optional[int] = Field(
        default=100,
        description="최대 결과 수"
    )


class PolygonShortInterestData(ShortInterestData):
    """Polygon 공매도 — 표준 ShortInterestData 상속"""
    pass
    shares_outstanding: Optional[int] = Field(
        default=None,
        description="발행주식 수"
    )

    # === 메타 데이터 ===
    market: Optional[str] = Field(
        default=None,
        description="시장 구분 (예: NASDAQ, NYSE)"
    )


"""Polygon.io Short Interest Fetcher"""
import logging
from datetime import datetime
from typing import Any, Dict, List, Optional

from data_fetcher.abstract_provider.abstract.base_fetchers import ApiFetcher
from data_fetcher.utils.api_keys import get_api_key
from data_fetcher.utils.provider_helpers import amake_json_request as amake_request, HTTPClientError

log = logging.getLogger(__name__)


class PolygonShortInterestFetcher(
    ApiFetcher[ShortInterestQueryParams, ShortInterestData]
):
    """Polygon.io 공매도 데이터 Fetcher"""

    api_name = "Polygon"
    api_key_env = "POLYGON_API_KEY"

    BASE_URL = "https://api.polygon.io"

    @staticmethod
    def transform_query(params: Dict[str, Any]) -> ShortInterestQueryParams:
        """쿼리 파라미터 변환"""
        return ShortInterestQueryParams(**params)

    @staticmethod
    async def aextract_data(
        query: ShortInterestQueryParams,
        credentials: Optional[Dict[str, str]] = None,
        **kwargs: Any
    ) -> Dict[str, Any]:
        """
        Polygon.io에서 공매도 데이터 추출

        Args:
            query: 쿼리 파라미터
            credentials: API 키 딕셔너리
            **kwargs: 추가 파라미터

        Returns:
            원시 데이터 딕셔너리
        """
        try:
            # API 키 조회
            api_key = get_api_key(
                credentials=credentials,
                api_name="Polygon.io",
                env_var="POLYGON_API_KEY"
            )

            # API 엔드포인트 (Massive/Polygon.io)
            url = f"{PolygonShortInterestFetcher.BASE_URL}/stocks/v1/short-interest"

            # 파라미터 설정
            params = {
                "apiKey": api_key,
                "ticker": query.ticker,
                "limit": query.limit or 100,
                "sort": "settlement_date.desc"  # 최신 데이터 먼저
            }

            # 날짜 필터는 settlement_date로 적용
            if query.start_date:
                params["settlement_date.gte"] = query.start_date
            if query.end_date:
                params["settlement_date.lte"] = query.end_date

            # API 호출
            data = await amake_request(url, params=params, timeout=30)

            if data.get("status") != "OK":
                log.warning(f"Polygon API returned status: {data.get('status')}")

            return data

        except HTTPClientError as e:
            log.error(f"Error fetching short interest from Polygon for {query.ticker}: {e}")
            raise
        except Exception as e:
            log.error(f"Unexpected error: {e}")
            raise

    @staticmethod
    def transform_data(
        query: ShortInterestQueryParams,
        data: Dict[str, Any],
        **kwargs: Any
    ) -> List[ShortInterestData]:
        """
        원시 데이터를 표준 모델로 변환

        Args:
            query: 쿼리 파라미터
            data: 원시 데이터
            **kwargs: 추가 파라미터

        Returns:
            ShortInterestData 리스트
        """
        results = data.get("results", [])

        if not results:
            log.info(f"No short interest data for {query.ticker}")
            return []

        short_interest_list = []
        prev_short_interest = None

        for item in results:
            try:
                settlement_date = datetime.strptime(
                    item["settlement_date"], "%Y-%m-%d"
                ).date()

                short_interest = item.get("short_interest")

                # 전기 대비 변화 계산
                short_interest_change = None
                short_interest_change_percent = None
                if prev_short_interest and short_interest:
                    short_interest_change = short_interest - prev_short_interest
                    if prev_short_interest > 0:
                        short_interest_change_percent = (
                            (short_interest_change / prev_short_interest) * 100
                        )

                # 유통주식 대비 비율 계산
                short_percent_of_float = None
                if "short_percent_of_float" in item:
                    short_percent_of_float = item["short_percent_of_float"]

                # Days to cover 계산
                days_to_cover = None
                avg_volume = item.get("average_daily_volume")
                if short_interest and avg_volume and avg_volume > 0:
                    days_to_cover = short_interest / avg_volume

                short_data = ShortInterestData(
                    ticker=query.ticker,
                    settlement_date=settlement_date,
                    short_interest=short_interest,
                    short_interest_change=short_interest_change,
                    short_interest_change_percent=short_interest_change_percent,
                    short_percent_of_float=short_percent_of_float,
                    days_to_cover=days_to_cover,
                    average_daily_volume=avg_volume,
                    shares_outstanding=item.get("shares_outstanding"),
                    market=item.get("market")
                )

                short_interest_list.append(short_data)
                prev_short_interest = short_interest

            except (KeyError, ValueError) as e:
                log.warning(f"Error parsing short interest data: {e}")
                continue

        log.info(f"Fetched {len(short_interest_list)} short interest records for {query.ticker}")
        return short_interest_list

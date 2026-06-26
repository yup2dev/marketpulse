"""Polygon.io Technical Indicators Model"""
from datetime import date as date_type
from typing import Optional
from pydantic import Field, model_validator
from data_fetcher.abstract_provider.standard_models import (
    TechnicalIndicatorQueryParams as _StdTIQueryParams,
    TechnicalIndicatorData,
    MACDData as _StdMACDData,
    BollingerBandsData as _StdBollingerBandsData,
)
from data_fetcher.abstract_provider.standard_models.technical_indicators import (
    TechnicalIndicatorsWideData,
)


class TechnicalIndicatorsQueryParams(_StdTIQueryParams):
    """기술적 지표 조회 파라미터"""

    ticker: Optional[str] = Field(
        default=None,
        description="종목 티커 (예: AAPL, TSLA). 미지정 시 표준 symbol에서 채운다."
    )

    @model_validator(mode="after")
    def _ticker_from_symbol(self):
        if not self.ticker:
            self.ticker = self.symbol
        return self
    indicator: str = Field(
        description="지표 유형 (sma, ema, rsi, macd)"
    )
    timespan: Optional[str] = Field(
        default="day",
        description="시간 단위 (minute, hour, day, week, month)"
    )
    adjusted: Optional[bool] = Field(
        default=True,
        description="조정 여부 (주식 분할 등)"
    )
    window: Optional[int] = Field(
        default=None,
        description="이동평균 기간 (SMA/EMA용)"
    )
    series_type: Optional[str] = Field(
        default="close",
        description="사용할 가격 유형 (close, open, high, low)"
    )
    timestamp_gte: Optional[str] = Field(
        default=None,
        description="타임스탬프 >= (YYYY-MM-DD)"
    )
    timestamp_lte: Optional[str] = Field(
        default=None,
        description="타임스탬프 <= (YYYY-MM-DD)"
    )
    limit: Optional[int] = Field(
        default=100,
        description="최대 결과 수"
    )


class SMAData(TechnicalIndicatorData):
    window: Optional[int] = Field(default=None, description="이동평균 기간")

class EMAData(TechnicalIndicatorData):
    window: Optional[int] = Field(default=None, description="이동평균 기간")

class RSIData(TechnicalIndicatorData):
    pass

class MACDData(_StdMACDData):
    pass

class BollingerBandsData(_StdBollingerBandsData):
    pass


class TechnicalIndicatorsData(TechnicalIndicatorsWideData):
    """통합 기술적 지표 데이터 (standard TechnicalIndicatorsWide 경유)"""


"""Polygon.io Technical Indicators Fetcher"""
import logging
from datetime import datetime
from typing import Any, Dict, List, Optional, Union

from data_fetcher.abstract_provider.abstract.fetcher import Fetcher
from data_fetcher.utils.api_keys import get_api_key
from data_fetcher.utils.async_http_client import amake_request, HTTPClientError

log = logging.getLogger(__name__)


class PolygonTechnicalIndicatorsFetcher(
    Fetcher[TechnicalIndicatorsQueryParams, Union[SMAData, EMAData, RSIData, MACDData]]
):
    """Polygon.io 기술적 지표 Fetcher"""

    BASE_URL = "https://api.polygon.io"

    @staticmethod
    def transform_query(params: Dict[str, Any]) -> TechnicalIndicatorsQueryParams:
        """쿼리 파라미터 변환"""
        return TechnicalIndicatorsQueryParams(**params)

    @staticmethod
    async def aextract_data(
        query: TechnicalIndicatorsQueryParams,
        credentials: Optional[Dict[str, str]] = None,
        **kwargs: Any
    ) -> Dict[str, Any]:
        """
        Polygon.io에서 기술적 지표 데이터 추출

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

            # 지표별 엔드포인트
            indicator = query.indicator.lower()
            url = f"{PolygonTechnicalIndicatorsFetcher.BASE_URL}/v1/indicators/{indicator}/{query.ticker}"

            # 공통 파라미터
            params = {
                "apiKey": api_key,
                "timespan": query.timespan or "day",
                "adjusted": str(query.adjusted).lower() if query.adjusted is not None else "true",
                "limit": query.limit or 100
            }

            # 지표별 추가 파라미터
            if indicator in ["sma", "ema"]:
                if query.window:
                    params["window"] = query.window
                else:
                    params["window"] = 20  # 기본값

            if query.series_type:
                params["series_type"] = query.series_type

            if query.timestamp_gte:
                params["timestamp.gte"] = query.timestamp_gte
            if query.timestamp_lte:
                params["timestamp.lte"] = query.timestamp_lte

            # API 호출
            data = await amake_request(url, params=params, timeout=30)

            if data.get("status") != "OK":
                log.warning(f"Polygon API returned status: {data.get('status')}")

            # 쿼리 정보 추가
            data["_query"] = {
                "ticker": query.ticker,
                "indicator": indicator,
                "window": params.get("window")
            }

            return data

        except HTTPClientError as e:
            log.error(f"Error fetching {query.indicator} from Polygon for {query.ticker}: {e}")
            raise
        except Exception as e:
            log.error(f"Unexpected error: {e}")
            raise

    @staticmethod
    def transform_data(
        query: TechnicalIndicatorsQueryParams,
        data: Dict[str, Any],
        **kwargs: Any
    ) -> List[Union[SMAData, EMAData, RSIData, MACDData]]:
        """
        원시 데이터를 표준 모델로 변환

        Args:
            query: 쿼리 파라미터
            data: 원시 데이터
            **kwargs: 추가 파라미터

        Returns:
            기술적 지표 데이터 리스트
        """
        results = data.get("results", {}).get("values", [])

        if not results:
            log.info(f"No {query.indicator} data for {query.ticker}")
            return []

        indicator = query.indicator.lower()
        ticker = data.get("_query", {}).get("ticker", query.ticker)
        window = data.get("_query", {}).get("window")

        indicator_list = []

        for item in results:
            try:
                # 타임스탬프 파싱 (밀리초 단위)
                timestamp_ms = item.get("timestamp")
                if timestamp_ms:
                    timestamp = datetime.fromtimestamp(timestamp_ms / 1000).date()
                else:
                    continue

                # 지표별 데이터 변환
                if indicator == "sma":
                    indicator_data = SMAData(
                        ticker=ticker,
                        timestamp=timestamp,
                        value=item["value"],
                        window=window or 20
                    )
                elif indicator == "ema":
                    indicator_data = EMAData(
                        ticker=ticker,
                        timestamp=timestamp,
                        value=item["value"],
                        window=window or 20
                    )
                elif indicator == "rsi":
                    indicator_data = RSIData(
                        ticker=ticker,
                        timestamp=timestamp,
                        value=item["value"]
                    )
                elif indicator == "macd":
                    indicator_data = MACDData(
                        ticker=ticker,
                        timestamp=timestamp,
                        macd=item.get("value"),
                        signal=item.get("signal"),
                        histogram=item.get("histogram")
                    )
                else:
                    log.warning(f"Unknown indicator type: {indicator}")
                    continue

                indicator_list.append(indicator_data)

            except (KeyError, ValueError) as e:
                log.warning(f"Error parsing {indicator} data: {e}")
                continue

        log.info(f"Fetched {len(indicator_list)} {indicator} records for {ticker}")
        return indicator_list

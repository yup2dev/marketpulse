"""Polygon.io Technical Indicators Fetcher"""
import logging
import requests
from datetime import datetime
from typing import Any, Dict, List, Optional, Union

from data_fetcher.fetchers.base import Fetcher
from data_fetcher.models.polygon.technical_indicators import (
    TechnicalIndicatorsQueryParams,
    SMAData,
    EMAData,
    RSIData,
    MACDData
)
from data_fetcher.utils.api_keys import get_api_key

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
    def extract_data(
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
            response = requests.get(url, params=params, timeout=30)
            response.raise_for_status()

            data = response.json()

            if data.get("status") != "OK":
                log.warning(f"Polygon API returned status: {data.get('status')}")

            # 쿼리 정보 추가
            data["_query"] = {
                "ticker": query.ticker,
                "indicator": indicator,
                "window": params.get("window")
            }

            return data

        except requests.exceptions.RequestException as e:
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

"""FMP Stock Quote Fetcher"""
import logging
import requests
from typing import Any, Dict, List, Optional

from data_fetcher.fetchers.base import Fetcher
from data_fetcher.models.fmp.quote import QuoteQueryParams, QuoteData
from data_fetcher.utils.api_keys import get_api_key

log = logging.getLogger(__name__)


class FMPQuoteFetcher(Fetcher[QuoteQueryParams, QuoteData]):
    """FMP 주식 시세 Fetcher"""

    BASE_URL = "https://financialmodelingprep.com/stable"

    @staticmethod
    def transform_query(params: Dict[str, Any]) -> QuoteQueryParams:
        """쿼리 파라미터 변환"""
        return QuoteQueryParams(**params)

    @staticmethod
    def extract_data(
        query: QuoteQueryParams,
        credentials: Optional[Dict[str, str]] = None,
        **kwargs: Any
    ) -> List[Dict[str, Any]]:
        """
        FMP에서 주식 시세 데이터 추출

        Args:
            query: 쿼리 파라미터
            credentials: API 키 딕셔너리
            **kwargs: 추가 파라미터

        Returns:
            원시 데이터 리스트
        """
        try:
            # API 키 조회
            api_key = get_api_key(
                credentials=credentials,
                api_name="FMP",
                env_var="FMP_API_KEY"
            )

            # API 엔드포인트 (최신 stable 엔드포인트)
            url = f"{FMPQuoteFetcher.BASE_URL}/quote"

            # 파라미터 설정
            params = {
                "symbol": query.symbol,
                "apikey": api_key
            }

            # API 호출
            response = requests.get(url, params=params, timeout=30)
            response.raise_for_status()

            data = response.json()

            if not isinstance(data, list):
                log.warning(f"Unexpected response format for {query.symbol}")
                return []

            return data

        except requests.exceptions.RequestException as e:
            log.error(f"Error fetching quote from FMP for {query.symbol}: {e}")
            raise
        except Exception as e:
            log.error(f"Unexpected error: {e}")
            raise

    @staticmethod
    def transform_data(
        query: QuoteQueryParams,
        data: List[Dict[str, Any]],
        **kwargs: Any
    ) -> List[QuoteData]:
        """
        원시 데이터를 표준 모델로 변환

        Args:
            query: 쿼리 파라미터
            data: 원시 데이터
            **kwargs: 추가 파라미터

        Returns:
            QuoteData 리스트
        """
        if not data:
            log.info(f"No quote data for {query.symbol}")
            return []

        quote_list = []

        for item in data:
            try:
                # Parse earnings announcement
                earnings_announcement = None
                if item.get("earningsAnnouncement"):
                    from datetime import datetime
                    try:
                        earnings_announcement = datetime.fromisoformat(
                            item["earningsAnnouncement"].replace("Z", "+00:00")
                        )
                    except (ValueError, AttributeError):
                        pass

                quote_data = QuoteData(
                    symbol=item.get("symbol", query.symbol),
                    name=item.get("name"),
                    price=item.get("price"),
                    change=item.get("change"),
                    change_percent=item.get("changesPercentage"),
                    day_low=item.get("dayLow"),
                    day_high=item.get("dayHigh"),
                    year_low=item.get("yearLow"),
                    year_high=item.get("yearHigh"),
                    market_cap=item.get("marketCap"),
                    price_avg_50=item.get("priceAvg50"),
                    price_avg_200=item.get("priceAvg200"),
                    volume=item.get("volume"),
                    avg_volume=item.get("avgVolume"),
                    exchange=item.get("exchange"),
                    open=item.get("open"),
                    previous_close=item.get("previousClose"),
                    eps=item.get("eps"),
                    pe=item.get("pe"),
                    earnings_announcement=earnings_announcement,
                    shares_outstanding=item.get("sharesOutstanding"),
                    timestamp=item.get("timestamp"),
                )

                quote_list.append(quote_data)

            except (KeyError, ValueError) as e:
                log.warning(f"Error parsing quote data: {e}")
                continue

        log.info(f"Fetched {len(quote_list)} quote records for {query.symbol}")
        return quote_list
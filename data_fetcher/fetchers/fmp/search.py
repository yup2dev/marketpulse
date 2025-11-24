"""FMP Stock Search Fetcher"""
import logging
import requests
from typing import Any, Dict, List, Optional

from data_fetcher.fetchers.base import Fetcher
from data_fetcher.utils.api_keys import get_api_key

log = logging.getLogger(__name__)


class SearchQueryParams:
    """Search query parameters"""

    def __init__(self, query: str = "", limit: int = 10):
        self.query = query
        self.limit = limit


class SearchResult:
    """Search result data"""

    def __init__(
        self,
        symbol: str,
        name: str,
        currency: Optional[str] = None,
        stock_exchange: Optional[str] = None,
        exchange_short_name: Optional[str] = None,
    ):
        self.symbol = symbol
        self.name = name
        self.currency = currency
        self.stock_exchange = stock_exchange
        self.exchange_short_name = exchange_short_name


class FMPSearchFetcher(Fetcher[SearchQueryParams, SearchResult]):
    """FMP 주식 검색 Fetcher"""

    BASE_URL = "https://financialmodelingprep.com/api/v3"

    @staticmethod
    def transform_query(params: Dict[str, Any]) -> SearchQueryParams:
        """쿼리 파라미터 변환"""
        return SearchQueryParams(**params)

    @staticmethod
    def extract_data(
        query: SearchQueryParams,
        credentials: Optional[Dict[str, str]] = None,
        **kwargs: Any
    ) -> List[Dict[str, Any]]:
        """
        FMP에서 주식 검색 데이터 추출

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

            # API 엔드포인트
            url = f"{FMPSearchFetcher.BASE_URL}/search"

            # 파라미터 설정
            params = {
                "query": query.query,
                "limit": query.limit,
                "apikey": api_key
            }

            # API 호출
            response = requests.get(url, params=params, timeout=30)
            response.raise_for_status()

            data = response.json()

            if not isinstance(data, list):
                log.warning(f"Unexpected response format for query: {query.query}")
                return []

            return data

        except requests.exceptions.RequestException as e:
            log.error(f"Error searching stocks from FMP for '{query.query}': {e}")
            raise
        except Exception as e:
            log.error(f"Unexpected error: {e}")
            raise

    @staticmethod
    def transform_data(
        query: SearchQueryParams,
        data: List[Dict[str, Any]],
        **kwargs: Any
    ) -> List[SearchResult]:
        """
        원시 데이터를 표준 모델로 변환

        Args:
            query: 쿼리 파라미터
            data: 원시 데이터
            **kwargs: 추가 파라미터

        Returns:
            SearchResult 리스트
        """
        if not data:
            log.info(f"No search results for query: {query.query}")
            return []

        results = []

        for item in data:
            try:
                result = SearchResult(
                    symbol=item.get("symbol", ""),
                    name=item.get("name", ""),
                    currency=item.get("currency"),
                    stock_exchange=item.get("stockExchange"),
                    exchange_short_name=item.get("exchangeShortName"),
                )

                results.append(result)

            except (KeyError, ValueError) as e:
                log.warning(f"Error parsing search result: {e}")
                continue

        log.info(f"Found {len(results)} search results for '{query.query}'")
        return results

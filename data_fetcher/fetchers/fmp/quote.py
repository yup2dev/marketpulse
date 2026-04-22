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
        """원시 데이터를 표준 모델로 변환"""
        return [QuoteData.model_validate(d) for d in data]

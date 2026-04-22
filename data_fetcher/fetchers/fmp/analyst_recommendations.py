"""FMP Analyst Recommendations Fetcher"""
import logging
import requests
from typing import Any, Dict, List, Optional

from data_fetcher.fetchers.base import Fetcher
from data_fetcher.models.fmp.analyst_recommendations import AnalystRecommendationsQueryParams, AnalystRecommendationsData
from data_fetcher.utils.api_keys import get_api_key

log = logging.getLogger(__name__)


class FMPAnalystRecommendationsFetcher(Fetcher[AnalystRecommendationsQueryParams, AnalystRecommendationsData]):
    """FMP 애널리스트 추천 등급 Fetcher"""

    BASE_URL = "https://financialmodelingprep.com/stable"

    @staticmethod
    def transform_query(params: Dict[str, Any]) -> AnalystRecommendationsQueryParams:
        """쿼리 파라미터 변환"""
        return AnalystRecommendationsQueryParams(**params)

    @staticmethod
    def extract_data(
        query: AnalystRecommendationsQueryParams,
        credentials: Optional[Dict[str, str]] = None,
        **kwargs: Any
    ) -> List[Dict[str, Any]]:
        """
        FMP에서 애널리스트 추천 등급 데이터 추출

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
            url = f"{FMPAnalystRecommendationsFetcher.BASE_URL}/grades"
            url_target = f"{FMPAnalystRecommendationsFetcher.BASE_URL}/price-target-consensus"

            # 파라미터 설정
            params = {
                "symbol": query.symbol,
                "apikey": api_key,
                "limit": query.limit or 100
            }

            # API 호출 - grade recommendations
            response = requests.get(url, params=params, timeout=30)
            response.raise_for_status()
            grade_data = response.json()

            # API 호출 - price target (쿼리 파라미터만 전달)
            target_params = {
                "symbol": query.symbol,
                "apikey": api_key
            }
            response_target = requests.get(url_target, params=target_params, timeout=30)
            response_target.raise_for_status()
            target_data = response_target.json()

            # Combine both data sources
            combined_data = []

            if isinstance(grade_data, list):
                for item in grade_data:
                    item['source'] = 'grade'
                    combined_data.append(item)

            if isinstance(target_data, list):
                for item in target_data:
                    item['source'] = 'price_target'
                    combined_data.append(item)

            return combined_data

        except requests.exceptions.RequestException as e:
            log.error(f"Error fetching analyst recommendations from FMP for {query.symbol}: {e}")
            raise
        except Exception as e:
            log.error(f"Unexpected error: {e}")
            raise

    @staticmethod
    def transform_data(
        query: AnalystRecommendationsQueryParams,
        data: List[Dict[str, Any]],
        **kwargs: Any
    ) -> List[AnalystRecommendationsData]:
        """원시 데이터를 표준 모델로 변환.

        두 엔드포인트(grades / price-target-consensus)가 섞여 들어오므로
        정규화된 dict로 먼저 변환한 뒤 model_validate에 맡긴다.
        """
        results: List[AnalystRecommendationsData] = []
        for item in data:
            # 날짜: date 우선, 없으면 publishedDate(앞 10자리)로 대체
            date_val = item.get("date") or (item.get("publishedDate") or "")[:10] or None
            if not date_val:
                continue

            normalized = {
                "symbol": item.get("symbol", query.symbol),
                "date": date_val,
                "analyst_name": item.get("gradingCompany") or item.get("analystName"),
                "analyst_company": item.get("gradingCompany") or item.get("analystCompany"),
                "consensus_grade": item.get("newGrade") or item.get("previousGrade"),
                "priceTarget": item.get("priceTarget") or item.get("adjPriceTarget"),
                "numberOfAnalysts": item.get("numberOfAnalysts") or item.get("numberOfAnalystsOpinions"),
            }
            results.append(AnalystRecommendationsData.model_validate(normalized))
        return results

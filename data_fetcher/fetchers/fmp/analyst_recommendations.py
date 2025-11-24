"""FMP Analyst Recommendations Fetcher"""
import logging
import requests
from datetime import datetime
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
        """
        원시 데이터를 표준 모델로 변환

        Args:
            query: 쿼리 파라미터
            data: 원시 데이터
            **kwargs: 추가 파라미터

        Returns:
            AnalystRecommendationsData 리스트
        """
        if not data:
            log.info(f"No analyst recommendations data for {query.symbol}")
            return []

        recommendations_list = []

        for item in data:
            try:
                # Parse date
                rec_date = None
                if item.get("date"):
                    try:
                        rec_date = datetime.strptime(item["date"], "%Y-%m-%d").date()
                    except (ValueError, AttributeError):
                        pass
                elif item.get("publishedDate"):
                    try:
                        rec_date = datetime.strptime(item["publishedDate"][:10], "%Y-%m-%d").date()
                    except (ValueError, AttributeError, IndexError):
                        pass

                if not rec_date:
                    continue

                # Extract analyst and company info
                analyst_name = item.get("gradingCompany") or item.get("analystName")
                analyst_company = item.get("gradingCompany") or item.get("analystCompany")

                # Parse price targets
                price_target = item.get("priceTarget") or item.get("adjPriceTarget")

                # Parse consensus from grade data
                consensus_grade = item.get("newGrade") or item.get("previousGrade")

                recommendations_data = AnalystRecommendationsData(
                    symbol=item.get("symbol", query.symbol),
                    date=rec_date,
                    analyst_name=analyst_name,
                    analyst_company=analyst_company,
                    analyst_rating_strong_buy=None,  # FMP doesn't provide count breakdown
                    analyst_rating_buy=None,
                    analyst_rating_hold=None,
                    analyst_rating_sell=None,
                    analyst_rating_strong_sell=None,
                    analyst_rating_consensus=consensus_grade,
                    analyst_target_price=price_target,
                    analyst_target_price_min=None,  # Available in separate endpoint
                    analyst_target_price_max=None,
                    analyst_target_price_avg=None,
                    analyst_target_price_median=None,
                    number_of_analysts=item.get("numberOfAnalysts") or item.get("numberOfAnalystsOpinions"),
                )

                recommendations_list.append(recommendations_data)

            except (KeyError, ValueError) as e:
                log.warning(f"Error parsing analyst recommendations data: {e}")
                continue

        log.info(f"Fetched {len(recommendations_list)} analyst recommendations records for {query.symbol}")
        return recommendations_list
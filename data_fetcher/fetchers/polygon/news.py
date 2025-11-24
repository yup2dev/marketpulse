"""Polygon.io News Fetcher"""
import logging
import requests
from datetime import datetime
from typing import Any, Dict, List, Optional

from data_fetcher.fetchers.base import Fetcher
from data_fetcher.models.polygon.news import (
    NewsQueryParams,
    NewsData
)
from data_fetcher.utils.api_keys import get_api_key

log = logging.getLogger(__name__)


class PolygonNewsFetcher(
    Fetcher[NewsQueryParams, NewsData]
):
    """Polygon.io 뉴스 데이터 Fetcher"""

    BASE_URL = "https://api.polygon.io"

    @staticmethod
    def transform_query(params: Dict[str, Any]) -> NewsQueryParams:
        """쿼리 파라미터 변환"""
        return NewsQueryParams(**params)

    @staticmethod
    def extract_data(
        query: NewsQueryParams,
        credentials: Optional[Dict[str, str]] = None,
        **kwargs: Any
    ) -> Dict[str, Any]:
        """
        Polygon.io에서 뉴스 데이터 추출

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

            # API 엔드포인트
            url = f"{PolygonNewsFetcher.BASE_URL}/v2/reference/news"

            # 파라미터 설정
            params = {
                "apiKey": api_key,
                "limit": query.limit or 100,
                "order": query.order or "desc"
            }

            if query.ticker:
                params["ticker"] = query.ticker
            if query.published_utc_gte:
                params["published_utc.gte"] = query.published_utc_gte
            if query.published_utc_lte:
                params["published_utc.lte"] = query.published_utc_lte

            # API 호출
            response = requests.get(url, params=params, timeout=30)
            response.raise_for_status()

            data = response.json()

            if data.get("status") != "OK":
                log.warning(f"Polygon API returned status: {data.get('status')}")

            return data

        except requests.exceptions.RequestException as e:
            log.error(f"Error fetching news from Polygon: {e}")
            raise
        except Exception as e:
            log.error(f"Unexpected error: {e}")
            raise

    @staticmethod
    def transform_data(
        query: NewsQueryParams,
        data: Dict[str, Any],
        **kwargs: Any
    ) -> List[NewsData]:
        """
        원시 데이터를 표준 모델로 변환

        Args:
            query: 쿼리 파라미터
            data: 원시 데이터
            **kwargs: 추가 파라미터

        Returns:
            NewsData 리스트
        """
        results = data.get("results", [])

        if not results:
            log.info("No news data found")
            return []

        news_list = []

        for item in results:
            try:
                # 발행일시 파싱
                published_utc = datetime.fromisoformat(
                    item["published_utc"].replace("Z", "+00:00")
                )

                # 관련 종목 추출
                tickers = None
                if item.get("tickers"):
                    tickers = item["tickers"]

                # 키워드 추출
                keywords = item.get("keywords")

                # 감성 분석 (있는 경우)
                sentiment = None
                sentiment_score = None
                if "insights" in item:
                    insights = item["insights"]
                    if isinstance(insights, list) and len(insights) > 0:
                        sentiment_data = insights[0].get("sentiment")
                        if sentiment_data:
                            sentiment = sentiment_data

                        # sentiment_reasoning은 string 형태
                        sentiment_reasoning = insights[0].get("sentiment_reasoning")
                        if sentiment_reasoning and isinstance(sentiment_reasoning, str):
                            # sentiment_reasoning에서 점수를 추출할 수 없으므로 None 유지
                            pass

                # Publisher 처리
                publisher = None
                publisher_data = item.get("publisher")
                if publisher_data:
                    if isinstance(publisher_data, dict):
                        publisher = publisher_data.get("name")
                    elif isinstance(publisher_data, str):
                        publisher = publisher_data

                news_data = NewsData(
                    id=item["id"],
                    title=item["title"],
                    description=item.get("description"),
                    article_url=item["article_url"],
                    author=item.get("author"),
                    publisher=publisher,
                    published_utc=published_utc,
                    tickers=tickers,
                    image_url=item.get("image_url"),
                    amp_url=item.get("amp_url"),
                    sentiment=sentiment,
                    sentiment_score=sentiment_score,
                    keywords=keywords,
                    article_type=None
                )

                news_list.append(news_data)

            except (KeyError, ValueError) as e:
                log.warning(f"Error parsing news data: {e}")
                continue

        log.info(f"Fetched {len(news_list)} news articles")
        return news_list

"""Polygon Stock Sentiment Model"""
from typing import Any, Dict, List
from pydantic import Field
from data_fetcher.abstract_provider.standard_models.stock_sentiment import (
    StockSentimentQueryParams,
    StockSentimentData,
)


class PolygonStockSentimentQueryParams(StockSentimentQueryParams):
    """뉴스 감성 조회 파라미터 (standard StockSentiment 경유)"""


class PolygonStockSentimentData(StockSentimentData):
    """뉴스 감성 데이터 (standard 경유, polygon 전용 news/trend 추가)"""
    news: List[Dict[str, Any]] = Field(default_factory=list)
    trend: List[Dict[str, Any]] = Field(default_factory=list)


"""Polygon Stock Sentiment Fetcher - keyword-based sentiment from news feed"""
import logging
from collections import defaultdict
from typing import Any, Dict, List, Optional

from data_fetcher.abstract_provider.abstract.fetcher import Fetcher
from data_fetcher.providers.polygon.news import PolygonNewsFetcher

log = logging.getLogger(__name__)

_POS_WORDS = ['beat', 'surge', 'rally', 'gain', 'rise', 'up', 'growth', 'profit', 'record', 'strong', 'bullish', 'upgrade', 'buy']
_NEG_WORDS = ['miss', 'fall', 'drop', 'decline', 'loss', 'down', 'weak', 'bearish', 'downgrade', 'sell', 'concern', 'risk', 'cut']


class PolygonStockSentimentFetcher(Fetcher[PolygonStockSentimentQueryParams, PolygonStockSentimentData]):

    @staticmethod
    def transform_query(params: Dict[str, Any]) -> PolygonStockSentimentQueryParams:
        return PolygonStockSentimentQueryParams(**params)

    @staticmethod
    async def aextract_data(
        query: PolygonStockSentimentQueryParams,
        credentials: Optional[Dict[str, str]] = None,
        **kwargs: Any,
    ) -> List[Dict[str, Any]]:
        result = await PolygonNewsFetcher.fetch_data({'ticker': query.symbol})
        if hasattr(result, 'result'):
            result = result.result
        return [item.model_dump(mode='json') for item in (result or [])[:50]]

    @staticmethod
    def transform_data(
        query: PolygonStockSentimentQueryParams,
        data: List[Dict[str, Any]],
        **kwargs: Any,
    ) -> List[PolygonStockSentimentData]:
        positive = negative = neutral = 0
        news_items = []

        for article in data:
            title = (article.get('title') or '').lower()
            pos_score = sum(1 for w in _POS_WORDS if w in title)
            neg_score = sum(1 for w in _NEG_WORDS if w in title)

            if pos_score > neg_score:
                sentiment, score = 'positive', min(100, 50 + pos_score * 10)
                positive += 1
            elif neg_score > pos_score:
                sentiment, score = 'negative', max(0, 50 - neg_score * 10)
                negative += 1
            else:
                sentiment, score = 'neutral', 50
                neutral += 1

            news_items.append({
                'title': article.get('title'),
                'published_at': article.get('published_utc'),
                'source': article.get('publisher_name'),
                'url': article.get('article_url'),
                'sentiment': sentiment,
                'sentiment_score': score,
            })

        total = len(news_items)
        overall_score = int((positive * 100 + neutral * 50) / total) if total else 50

        day_scores: Dict[str, list] = defaultdict(list)
        for item in news_items:
            if item['published_at']:
                day_scores[item['published_at'][:10]].append(item['sentiment_score'])

        trend = sorted(
            [{'date': d, 'score': round(sum(s) / len(s), 1)} for d, s in day_scores.items()],
            key=lambda x: x['date'],
        )

        return [PolygonStockSentimentData(
            symbol=query.symbol,
            news=news_items,
            aggregate={'positive': positive, 'negative': negative, 'neutral': neutral, 'overall_score': overall_score},
            trend=trend,
        )]

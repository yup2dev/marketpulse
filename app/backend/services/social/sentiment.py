"""소셜 심리 서비스 (Reddit, StockTwits)."""
from typing import Optional

from data_fetcher.query_executor import QueryExecutor
from data_fetcher.fetchers.base import AnnotatedResult
from data_fetcher.models.social.sentiment import SocialSentimentData


def _first(raw):
    result = raw.result if isinstance(raw, AnnotatedResult) else raw
    return result[0] if result else None


async def get_social_sentiment(symbol: str) -> Optional[SocialSentimentData]:
    return _first(await QueryExecutor.fetch("social", "sentiment", {"symbol": symbol}))

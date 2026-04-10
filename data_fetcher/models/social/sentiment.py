"""Social Sentiment Model (StockTwits + Reddit)"""
from typing import Any, Dict, List
from pydantic import Field
from data_fetcher.models.base import BaseQueryParams, BaseData


class SocialSentimentQueryParams(BaseQueryParams):
    symbol: str


class SocialSentimentData(BaseData):
    symbol: str
    stocktwits_messages: List[Dict[str, Any]] = Field(default_factory=list)
    reddit_posts: List[Dict[str, Any]] = Field(default_factory=list)
    aggregate: Dict[str, Any] = Field(default_factory=dict)
    has_reddit: bool = False

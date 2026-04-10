"""Polygon Stock Sentiment Model"""
from typing import Any, Dict, List
from pydantic import Field
from data_fetcher.models.base import BaseQueryParams, BaseData


class PolygonStockSentimentQueryParams(BaseQueryParams):
    ticker: str


class PolygonStockSentimentData(BaseData):
    symbol: str
    news: List[Dict[str, Any]] = Field(default_factory=list)
    aggregate: Dict[str, Any] = Field(default_factory=dict)
    trend: List[Dict[str, Any]] = Field(default_factory=list)

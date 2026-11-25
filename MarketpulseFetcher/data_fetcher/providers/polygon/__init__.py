"""Polygon.io Provider"""
from data_fetcher.abstract_provider.abstract.provider import Provider
from data_fetcher.providers.polygon.models.news import PolygonNewsFetcher
from data_fetcher.providers.polygon.models.earnings import PolygonEarningsFetcher
from data_fetcher.providers.polygon.models.insider_trading import PolygonInsiderTradingFetcher
from data_fetcher.providers.polygon.models.options import PolygonOptionsFetcher
from data_fetcher.providers.polygon.models.short_interest import PolygonShortInterestFetcher
from data_fetcher.providers.polygon.models.technical_indicators import PolygonTechnicalIndicatorsFetcher
from data_fetcher.providers.polygon.models.orderbook import PolygonOrderBookFetcher


polygon_provider = Provider(
    name="polygon",
    description="Polygon.io Market Data API",
    website="https://polygon.io",
    credentials=["api_key"],
    fetcher_dict={
        "news": PolygonNewsFetcher,
        "earnings": PolygonEarningsFetcher,
        "insider_trading": PolygonInsiderTradingFetcher,
        "options": PolygonOptionsFetcher,
        "short_interest": PolygonShortInterestFetcher,
        "technical_indicators": PolygonTechnicalIndicatorsFetcher,
        "orderbook": PolygonOrderBookFetcher,
    },
    metadata={
        "rate_limit": "5 requests/minute (free tier)",
        "data_coverage": "US stock market data, news, options",
    }
)

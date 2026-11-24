"""Social Sentiment Provider"""
from data_fetcher.abstract_provider.abstract.provider import Provider
from data_fetcher.providers.social.models.sentiment import SocialSentimentFetcher


social_provider = Provider(
    name="social",
    description="Social Sentiment (Reddit, StockTwits)",
    credentials=[],
    fetcher_dict={
        "sentiment": SocialSentimentFetcher,
    },
)

"""Social Sentiment Model (StockTwits + Reddit)"""
import datetime
import logging
import os
from typing import Any, Dict, List, Optional

from pydantic import Field

from data_fetcher.abstract_provider.abstract.base_fetchers import ApiFetcher
from data_fetcher.abstract_provider.standard_models.stock_sentiment import (
    StockSentimentQueryParams,
    StockSentimentData,
)
from data_fetcher.utils.provider_helpers import amake_json_request as amake_request


class SocialSentimentQueryParams(StockSentimentQueryParams):
    """소셜 감성 조회 파라미터 (standard StockSentiment 경유)"""


class SocialSentimentData(StockSentimentData):
    """소셜 감성 데이터 (standard 경유, StockTwits/Reddit 전용 필드 추가)"""
    stocktwits_messages: List[Dict[str, Any]] = Field(default_factory=list)
    reddit_posts: List[Dict[str, Any]] = Field(default_factory=list)
    has_reddit: bool = False


# ────────────────────────────────────────────────────────────────────────────
# Social Sentiment Fetcher - StockTwits + Reddit


log = logging.getLogger(__name__)


class SocialSentimentFetcher(ApiFetcher[SocialSentimentQueryParams, SocialSentimentData]):

    @staticmethod
    def transform_query(params: Dict[str, Any]) -> SocialSentimentQueryParams:
        return SocialSentimentQueryParams(**params)

    @staticmethod
    async def aextract_data(
        query: SocialSentimentQueryParams,
        credentials: Optional[Dict[str, str]] = None,
        **kwargs: Any,
    ) -> Dict[str, Any]:
        stocktwits_messages = []
        reddit_posts = []
        reddit_configured = False

        # ── StockTwits ────────────────────────────────────────────────────────
        try:
            st_data = await amake_request(
                f"https://api.stocktwits.com/api/2/streams/symbol/{query.symbol}.json",
                timeout=10,
            )
            if st_data:
                for msg in (st_data.get('messages') or [])[:30]:
                    body = msg.get('body', '')
                    basic_sent = (msg.get('entities', {}).get('sentiment', {}) or {}).get('basic', '')
                    sentiment = 'bullish' if basic_sent == 'Bullish' else ('bearish' if basic_sent == 'Bearish' else 'neutral')
                    stocktwits_messages.append({
                        'body': body,
                        'sentiment': sentiment,
                        'created_at': msg.get('created_at', ''),
                        'user': msg.get('user', {}).get('username', ''),
                    })
        except Exception as e:
            log.warning(f"StockTwits fetch failed for {query.symbol}: {e}")

        # ── Reddit ────────────────────────────────────────────────────────────
        client_id = os.environ.get('REDDIT_CLIENT_ID')
        client_secret = os.environ.get('REDDIT_CLIENT_SECRET')
        reddit_configured = bool(client_id and client_secret)

        if client_id and client_secret:
            try:
                token_data = await amake_request(
                    'https://www.reddit.com/api/v1/access_token',
                    method='POST',
                    auth=(client_id, client_secret),
                    data={'grant_type': 'client_credentials'},
                    headers={'User-Agent': 'MarketPulse/1.0'},
                    timeout=10,
                )
                token = (token_data or {}).get('access_token', '')
                if token:
                    headers = {'Authorization': f'bearer {token}', 'User-Agent': 'MarketPulse/1.0'}
                    for sub in ['stocks', 'investing', 'wallstreetbets']:
                        search_data = await amake_request(
                            f'https://oauth.reddit.com/r/{sub}/search',
                            params={'q': query.symbol, 'sort': 'new', 'limit': 10, 'restrict_sr': True},
                            headers=headers,
                            timeout=10,
                        )
                        if search_data:
                            for post in search_data.get('data', {}).get('children', []):
                                d = post.get('data', {})
                                created = datetime.datetime.fromtimestamp(d.get('created_utc', 0)).isoformat()
                                reddit_posts.append({
                                    'subreddit': sub,
                                    'title': d.get('title', ''),
                                    'score': d.get('score', 0),
                                    'num_comments': d.get('num_comments', 0),
                                    'created_utc': created,
                                    'url': f"https://reddit.com{d.get('permalink', '')}",
                                })
            except Exception as e:
                log.warning(f"Reddit fetch failed for {query.symbol}: {e}")

        return {
            'symbol': query.symbol,
            'stocktwits_messages': stocktwits_messages,
            'reddit_posts': reddit_posts,
            'reddit_configured': reddit_configured,
        }

    @staticmethod
    def transform_data(
        query: SocialSentimentQueryParams,
        data: Dict[str, Any],
        **kwargs: Any,
    ) -> List[SocialSentimentData]:
        # StockTwits 의 bullish/bearish 는 작성자가 단 표시라 그대로 둔다.
        # Reddit 글 분류 · 종합 비율(aggregate)은 백엔드 command(commands/sentiment.py)가 채운다.
        return [SocialSentimentData(
            symbol=data['symbol'],
            stocktwits_messages=data.get('stocktwits_messages', []),
            reddit_posts=data.get('reddit_posts', []),
            has_reddit=data.get('reddit_configured', False),
        )]

"""Social Sentiment Model (StockTwits + Reddit)"""
from typing import Any, Dict, List
from pydantic import Field
from data_fetcher.abstract_provider.standard_models.stock_sentiment import (
    StockSentimentQueryParams,
    StockSentimentData,
)


class SocialSentimentQueryParams(StockSentimentQueryParams):
    """소셜 감성 조회 파라미터 (standard StockSentiment 경유)"""


class SocialSentimentData(StockSentimentData):
    """소셜 감성 데이터 (standard 경유, StockTwits/Reddit 전용 필드 추가)"""
    stocktwits_messages: List[Dict[str, Any]] = Field(default_factory=list)
    reddit_posts: List[Dict[str, Any]] = Field(default_factory=list)
    has_reddit: bool = False


"""Social Sentiment Fetcher - StockTwits + Reddit"""
import datetime
import logging
import os
from typing import Any, Dict, List, Optional

from data_fetcher.abstract_provider.abstract.base_fetchers import ApiFetcher
from data_fetcher.utils.async_http_client import amake_request

log = logging.getLogger(__name__)

_POS_W = ['beat', 'bull', 'buy', 'moon', 'surge', 'gain']
_NEG_W = ['bear', 'sell', 'dump', 'crash', 'loss', 'miss']


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
                                title = d.get('title', '')
                                tl = title.lower()
                                ps = sum(1 for w in _POS_W if w in tl)
                                ns = sum(1 for w in _NEG_W if w in tl)
                                sentiment = 'positive' if ps > ns else ('negative' if ns > ps else 'neutral')
                                created = datetime.datetime.fromtimestamp(d.get('created_utc', 0)).isoformat()
                                reddit_posts.append({
                                    'subreddit': sub,
                                    'title': title,
                                    'score': d.get('score', 0),
                                    'num_comments': d.get('num_comments', 0),
                                    'created_utc': created,
                                    'sentiment': sentiment,
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
        stocktwits_messages = data.get('stocktwits_messages', [])
        reddit_posts = data.get('reddit_posts', [])
        reddit_configured = data.get('reddit_configured', False)

        all_sentiments = [m['sentiment'] for m in stocktwits_messages] + [p['sentiment'] for p in reddit_posts]
        bullish = sum(1 for s in all_sentiments if s in ('bullish', 'positive'))
        bearish = sum(1 for s in all_sentiments if s in ('bearish', 'negative'))
        neutral_count = len(all_sentiments) - bullish - bearish
        total = len(all_sentiments)

        return [SocialSentimentData(
            symbol=data['symbol'],
            stocktwits_messages=stocktwits_messages,
            reddit_posts=reddit_posts,
            aggregate={
                'bullish_pct': round(bullish / total * 100, 1) if total else 0,
                'bearish_pct': round(bearish / total * 100, 1) if total else 0,
                'neutral_pct': round(neutral_count / total * 100, 1) if total else 0,
                'message_volume': total,
            },
            has_reddit=reddit_configured,
        )]

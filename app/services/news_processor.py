"""
News Processor - 크롤링된 뉴스 처리 및 DB 저장
"""
import logging
from datetime import datetime
from typing import Dict, List
from sqlalchemy.orm import Session
import uuid

from app.models.database import NewsArticle, Ticker, NewsTicker
from app.services.ticker_extractor import TickerExtractor
from app.services.sentiment_analyzer import SentimentAnalyzer

log = logging.getLogger(__name__)


class NewsProcessor:
    """
    뉴스 처리 파이프라인:
    1. 티커 추출
    2. 감성 분석
    3. 중요도 점수 계산
    4. 데이터베이스 저장
    """

    def __init__(
        self,
        ticker_extractor: TickerExtractor,
        sentiment_analyzer: SentimentAnalyzer
    ):
        self.ticker_extractor = ticker_extractor
        self.sentiment_analyzer = sentiment_analyzer

    def process_article(self, article_data: Dict, session: Session) -> bool:
        """
        단일 기사 처리

        Args:
            article_data: 크롤링된 기사 데이터
            session: DB 세션

        Returns:
            성공 여부
        """
        try:
            url = article_data.get('url')
            if not url:
                log.warning("Article missing URL, skipping")
                return False

            # 중복 체크
            existing = session.query(NewsArticle).filter(NewsArticle.url == url).first()
            if existing:
                log.debug(f"Article already exists: {url}")
                return False

            title = article_data.get('title', '')
            content = article_data.get('text_preview', '') or article_data.get('content', '')

            if not title and not content:
                log.warning(f"Article has no content: {url}")
                return False

            # 1. 티커 추출
            tickers = self.ticker_extractor.extract(content, title)
            log.info(f"Extracted {len(tickers)} tickers from: {title[:50]}")

            # 2. 감성 분석
            sentiment = self.sentiment_analyzer.analyze(f"{title}. {content}")

            # 3. 중요도 점수 계산
            title_has_ticker = any(t['symbol'] in title.upper() for t in tickers)
            importance = self.sentiment_analyzer.get_importance_score(
                sentiment,
                ticker_count=sum(t.get('mention_count', 0) for t in tickers),
                title_included=title_has_ticker
            )

            # 4. NewsArticle 생성
            news = NewsArticle(
                id=uuid.uuid4(),
                url=url,
                title=title,
                summary=article_data.get('summary', ''),
                content=content,
                source=article_data.get('source', 'unknown'),
                author=article_data.get('author'),
                published_at=self._parse_datetime(article_data.get('published_time')),
                crawled_at=datetime.utcnow(),
                sentiment_score=sentiment['score'],
                sentiment_label=sentiment['label'],
                sentiment_confidence=sentiment['confidence'],
                importance_score=importance,
                category=article_data.get('category', '')
            )

            session.add(news)
            session.flush()  # ID 생성

            # 5. 티커 연결
            for ticker_data in tickers:
                symbol = ticker_data['symbol']

                # Ticker 마스터 확인/생성
                ticker = session.query(Ticker).filter(Ticker.symbol == symbol).first()
                if not ticker:
                    ticker = Ticker(
                        symbol=symbol,
                        name=ticker_data.get('name', ''),
                        exchange=ticker_data.get('exchange', '')
                    )
                    session.add(ticker)
                    session.flush()

                # NewsTicker 연결
                news_ticker = NewsTicker(
                    news_id=news.id,
                    ticker_symbol=symbol,
                    confidence=ticker_data.get('confidence', 0.0),
                    mention_count=ticker_data.get('mention_count', 0),
                    context_sentiment=sentiment['score']  # 전체 감성 사용 (개선 가능)
                )
                session.add(news_ticker)

            session.commit()
            log.info(f"Saved article: {title[:50]}... ({len(tickers)} tickers)")
            return True

        except Exception as e:
            log.error(f"Failed to process article: {e}")
            session.rollback()
            return False

    def process_batch(self, articles: List[Dict], session: Session) -> Dict[str, int]:
        """
        배치 처리

        Returns:
            {'success': N, 'failed': M, 'duplicates': K}
        """
        stats = {'success': 0, 'failed': 0, 'duplicates': 0}

        for article_data in articles:
            try:
                result = self.process_article(article_data, session)
                if result:
                    stats['success'] += 1
                else:
                    stats['duplicates'] += 1
            except Exception as e:
                log.error(f"Batch processing error: {e}")
                stats['failed'] += 1

        return stats

    def _parse_datetime(self, dt_string) -> datetime:
        """문자열을 datetime으로 변환"""
        if not dt_string:
            return datetime.utcnow()

        if isinstance(dt_string, datetime):
            return dt_string

        try:
            # ISO 8601 형식
            return datetime.fromisoformat(str(dt_string).replace('Z', '+00:00'))
        except:
            try:
                # 일반적인 형식들
                for fmt in ['%Y-%m-%d %H:%M:%S', '%Y-%m-%dT%H:%M:%S']:
                    try:
                        return datetime.strptime(str(dt_string), fmt)
                    except:
                        continue
            except:
                pass

        # 파싱 실패시 현재 시간
        return datetime.utcnow()

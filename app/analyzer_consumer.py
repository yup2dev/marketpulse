"""
Analyzer Consumer - Redis Stream 구독 및 분석 처리
D5: Analyzer Module (분석 수행)
D6: DB Writer (결과 저장)
"""
import logging
from typing import Dict
from pathlib import Path
from app.redis_bus import RedisEventBus
from app.models.database import get_sqlite_db, NewsArticle, NewsTicker
from app.services.ticker_extractor import TickerExtractor
from app.services.sentiment_analyzer import SentimentAnalyzer
from app.core.config import settings

log = logging.getLogger(__name__)


class AnalyzerConsumer:
    """
    Stream 기반 분석 Consumer

    흐름:
    1. Redis Stream에서 article_id 수신
    2. DB에서 article 조회
    3. 감성 분석 & 티커 추출
    4. DB 업데이트 (D6: DB Writer)
    5. 상태 발행 (옵션)
    """

    def __init__(self, event_bus: RedisEventBus):
        self.event_bus = event_bus

        # DB 연결
        db_path = Path(settings.SQLITE_PATH)
        db_path.parent.mkdir(parents=True, exist_ok=True)
        self.db = get_sqlite_db(str(db_path))

        # 분석 도구 초기화
        self.ticker_extractor = TickerExtractor()
        self.sentiment_analyzer = SentimentAnalyzer(use_transformers=settings.USE_TRANSFORMERS)

        log.info(f"[AnalyzerConsumer] Initialized with DB: {db_path}")

    def start(self):
        """
        Analyzer Consumer 시작
        Redis Stream 구독 및 메시지 처리
        """
        log.info("[AnalyzerConsumer] Starting stream consumer...")

        # Stream 구독 시작 (Blocking)
        self.event_bus.consume_stream(
            stream_name='stream:new_articles',
            consumer_group='analyzer-group',
            consumer_name='analyzer-1',
            callback=self.process_article,
            count=10,  # 한 번에 10개씩 처리
            block=5000  # 5초 대기
        )

    def process_article(self, message: Dict):
        """
        Stream 메시지 처리

        Args:
            message: {
                'article_id': str,
                'url': str,
                'timestamp': str
            }
        """
        article_id = message.get('article_id')
        url = message.get('url', 'unknown')

        log.info(f"[Analyzer] Processing article ID: {article_id}")

        try:
            # DB에서 article 조회
            session = self.db.get_session()
            article = session.query(NewsArticle).filter_by(id=int(article_id)).first()

            if not article:
                log.warning(f"[Analyzer] Article not found: {article_id}")
                session.close()
                return

            # 분석할 텍스트 준비
            text = f"{article.title} {article.summary}"

            # 1. 감성 분석
            sentiment = self.sentiment_analyzer.analyze(text)

            # 2. 티커 추출
            tickers = self.ticker_extractor.extract(text, title=article.title)

            # 3. 중요도 계산
            importance = self._calculate_importance(article, tickers, sentiment)

            # 4. DB 업데이트
            article.sentiment_score = sentiment['score']
            article.sentiment_label = sentiment['label']
            article.importance_score = importance

            # 5. 티커 연결 저장
            for ticker_info in tickers:
                news_ticker = NewsTicker(
                    news_id=article.id,
                    ticker_symbol=ticker_info['symbol'],
                    mention_count=ticker_info.get('count', 1),
                    confidence=ticker_info.get('confidence', 1.0)
                )
                session.add(news_ticker)

            session.commit()
            session.close()

            log.info(
                f"[Analyzer] Completed: {article.title[:60]}... "
                f"(Sentiment: {sentiment['label']}, Tickers: {len(tickers)})"
            )

        except Exception as e:
            log.error(f"[Analyzer] Error processing article {article_id}: {e}", exc_info=True)

    def _calculate_importance(
        self,
        article: NewsArticle,
        tickers: list,
        sentiment: dict
    ) -> float:
        """
        기사 중요도 계산 (0-10)

        Args:
            article: NewsArticle 객체
            tickers: 추출된 티커 리스트
            sentiment: 감성 분석 결과

        Returns:
            중요도 점수 (0-10)
        """
        score = 5.0  # 기본 점수

        # 티커 개수 (최대 +2점)
        if tickers:
            score += min(len(tickers) * 0.5, 2.0)

        # 감성 강도 (최대 +2점)
        sentiment_abs = abs(sentiment['score'])
        if sentiment_abs > 0.7:
            score += 2.0
        elif sentiment_abs > 0.4:
            score += 1.0

        # 제목 길이 (최대 +1점)
        if len(article.title) > 50:
            score += 0.5
        if len(article.title) > 100:
            score += 0.5

        # 본문 길이 (최대 +1점)
        if article.content and len(article.content) > 500:
            score += 0.5
        if article.content and len(article.content) > 1000:
            score += 0.5

        return min(score, 10.0)


def start_analyzer_consumer(event_bus: RedisEventBus):
    """
    Analyzer Consumer 시작 함수 (Thread에서 호출)

    Args:
        event_bus: RedisEventBus 인스턴스
    """
    consumer = AnalyzerConsumer(event_bus)
    consumer.start()  # Blocking call

"""
PROC Module - IN → PROC 변환 (실시간 Stream 처리)
D5: Analyzer Module (분석 수행)
D6: DB Writer (결과 저장)

역할:
- Redis Stream 'stream:new_articles' 구독
- MBS_IN_ARTICLE 읽기
- 감성 분석 + 티커 추출
- MBS_PROC_ARTICLE 저장

파이프라인: IN (Crawler) → Stream → PROC (Analyzer) → CALC → RCMD
"""
import logging
from typing import Dict
from pathlib import Path
from decimal import Decimal
from app.redis_bus import RedisEventBus
from app.models.database import (
    get_sqlite_db,
    MBS_IN_ARTICLE, MBS_PROC_ARTICLE,
    generate_id
)
from app.services.ticker_extractor import TickerExtractor
from app.services.sentiment_analyzer import SentimentAnalyzer
from app.core.config import settings

log = logging.getLogger(__name__)


class AnalyzerConsumer:
    """
    PROC 모듈: IN → PROC 변환 (실시간 Stream 기반)

    흐름:
    1. Redis Stream 'stream:new_articles'에서 news_id 수신
    2. MBS_IN_ARTICLE에서 기사 조회
    3. 감성 분석 (SentimentAnalyzer)
    4. 티커 추출 (TickerExtractor)
    5. MBS_PROC_ARTICLE에 저장
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
        Stream 메시지 처리 (IN → PROC 변환)

        Args:
            message: {
                'news_id': str,
                'url': str,
                'source_cd': str,
                'timestamp': str
            }
        """
        news_id = message.get('news_id')
        url = message.get('url', 'unknown')

        log.info(f"[Analyzer] Processing news_id: {news_id}")

        try:
            session = self.db.get_session()

            # MBS_IN_ARTICLE에서 읽기
            in_article = session.query(MBS_IN_ARTICLE).filter_by(news_id=news_id).first()

            if not in_article:
                log.warning(f"[Analyzer] Article not found in MBS_IN: {news_id}")
                session.close()
                return

            # 분석할 텍스트 준비
            text = f"{in_article.title} {in_article.content[:500]}"

            # 1. 감성 분석
            sentiment = self.sentiment_analyzer.analyze(text)

            # 2. 티커 추출 (가장 관련성 높은 티커 선택)
            tickers = self.ticker_extractor.extract(text, title=in_article.title)
            primary_ticker = tickers[0]['symbol'] if tickers else None

            # 3. 요약 생성 (간단한 추출 요약)
            summary_text = self._generate_summary(in_article.content)

            # 4. MBS_PROC_ARTICLE 생성
            proc_id = generate_id('PROC-')

            # DECIMAL 필드는 Decimal 타입으로 변환
            match_score = Decimal(str(tickers[0].get('confidence', 0.5))) if tickers else Decimal('0.0')
            sentiment_score = Decimal(str(sentiment['score']))
            price_impact = Decimal('0.0')  # TODO: 가격 영향도 계산

            proc_article = MBS_PROC_ARTICLE(
                proc_id=proc_id,
                news_id=news_id,
                stk_cd=primary_ticker,
                summary_text=summary_text,
                match_score=match_score,
                price_impact=price_impact,
                sentiment_score=sentiment_score,
                price=None,  # TODO: 해당 시점 가격 조회
                base_ymd=in_article.base_ymd,
                source_batch_id=in_article.ingest_batch_id
            )

            session.add(proc_article)
            session.commit()

            log.info(
                f"[Analyzer] IN → PROC: {in_article.title[:60]}... "
                f"(Sentiment: {sentiment['score']:.2f}, Ticker: {primary_ticker})"
            )

            session.close()

        except Exception as e:
            log.error(f"[Analyzer] Error processing news_id {news_id}: {e}", exc_info=True)

    def _generate_summary(self, content: str, max_length: int = 200) -> str:
        """
        간단한 추출 요약 생성

        Args:
            content: 원본 텍스트
            max_length: 최대 길이

        Returns:
            요약 텍스트
        """
        if not content:
            return ""

        # 첫 N 문자 추출
        summary = content[:max_length]

        # 마지막 문장 끝까지 포함
        if len(content) > max_length:
            last_period = summary.rfind('.')
            if last_period > 0:
                summary = summary[:last_period + 1]
            else:
                summary += "..."

        return summary


def start_analyzer_consumer(event_bus: RedisEventBus):
    """
    Analyzer Consumer 시작 함수 (Thread에서 호출)

    Args:
        event_bus: RedisEventBus 인스턴스
    """
    consumer = AnalyzerConsumer(event_bus)
    consumer.start()  # Blocking call

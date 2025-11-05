"""
Article Processor - MBS_IN_ARTICLE → MBS_PROC_ARTICLE 변환
Redis 없이도 작동하는 배치 처리 방식

사용:
1. 스케줄러에서 주기적으로 호출
2. CLI에서 수동 호출
"""
import logging
from typing import List, Dict, Optional
from pathlib import Path
from decimal import Decimal
from datetime import date
from sqlalchemy.orm import Session

from app.models.database import (
    get_sqlite_db,
    MBS_IN_ARTICLE, MBS_PROC_ARTICLE,
    generate_id
)
from app.services.ticker_extractor import TickerExtractor
from app.services.sentiment_analyzer import SentimentAnalyzer
from app.core.config import settings

log = logging.getLogger(__name__)


class ArticleProcessor:
    """MBS_IN_ARTICLE → MBS_PROC_ARTICLE 변환 프로세서"""

    def __init__(self, db_session: Session = None):
        """
        초기화

        Args:
            db_session: SQLAlchemy Session (None이면 새로 생성)
        """
        if db_session:
            self.session = db_session
            self.session_owner = False
        else:
            db_path = Path(settings.SQLITE_PATH)
            db_path.parent.mkdir(parents=True, exist_ok=True)
            self.db = get_sqlite_db(str(db_path))
            self.session = self.db.get_session()
            self.session_owner = True

        # 분석 도구 초기화
        self.ticker_extractor = TickerExtractor()
        self.sentiment_analyzer = SentimentAnalyzer(use_transformers=settings.USE_TRANSFORMERS)

        log.info("[ArticleProcessor] Initialized")

    def process_unprocessed_articles(self, limit: int = 100) -> int:
        """
        미처리 기사 처리 (IN → PROC 변환)

        Args:
            limit: 한 번에 처리할 최대 기사 수

        Returns:
            처리된 기사 수
        """
        try:
            log.info(f"[ArticleProcessor] Processing up to {limit} unprocessed articles...")

            # 미처리 기사 조회 (MBS_IN에는 있지만 MBS_PROC에 없는 것)
            unprocessed = self.session.query(MBS_IN_ARTICLE).filter(
                ~MBS_IN_ARTICLE.processed_articles.any()
            ).limit(limit).all()

            if not unprocessed:
                log.info("[ArticleProcessor] No unprocessed articles found")
                return 0

            log.info(f"[ArticleProcessor] Found {len(unprocessed)} unprocessed articles")

            processed_count = 0
            for article in unprocessed:
                try:
                    self._process_single_article(article)
                    processed_count += 1
                except Exception as e:
                    log.error(f"[ArticleProcessor] Error processing {article.news_id}: {e}")
                    continue

            self.session.commit()
            log.info(f"[ArticleProcessor] Successfully processed {processed_count} articles")

            return processed_count

        except Exception as e:
            log.error(f"[ArticleProcessor] Error in process_unprocessed_articles: {e}", exc_info=True)
            self.session.rollback()
            return 0

    def process_article_by_id(self, news_id: str) -> bool:
        """
        특정 기사 처리

        Args:
            news_id: 기사 ID

        Returns:
            성공 여부
        """
        try:
            in_article = self.session.query(MBS_IN_ARTICLE).filter_by(news_id=news_id).first()

            if not in_article:
                log.warning(f"[ArticleProcessor] Article not found: {news_id}")
                return False

            self._process_single_article(in_article)
            self.session.commit()

            log.info(f"[ArticleProcessor] Processed article: {news_id}")
            return True

        except Exception as e:
            log.error(f"[ArticleProcessor] Error processing {news_id}: {e}")
            self.session.rollback()
            return False

    def _process_single_article(self, in_article: MBS_IN_ARTICLE) -> Optional[str]:
        """
        단일 기사 처리 (내부 메소드)

        Args:
            in_article: MBS_IN_ARTICLE 객체

        Returns:
            생성된 proc_id 또는 None
        """
        news_id = in_article.news_id

        # 이미 처리된 기사는 스킵
        existing_proc = self.session.query(MBS_PROC_ARTICLE).filter_by(
            news_id=news_id
        ).first()

        if existing_proc:
            log.debug(f"[ArticleProcessor] Article already processed: {news_id}")
            return existing_proc.proc_id

        try:
            # 분석할 텍스트 준비
            text = f"{in_article.title} {in_article.content[:500]}" if in_article.content else in_article.title

            # 1. 감성 분석
            sentiment = self.sentiment_analyzer.analyze(text)

            # 2. 티커 추출 (가장 관련성 높은 티커 선택)
            tickers = self.ticker_extractor.extract(text, title=in_article.title)
            primary_ticker = tickers[0]['symbol'] if tickers else None

            # 3. 요약 생성
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

            self.session.add(proc_article)

            log.debug(
                f"[ArticleProcessor] IN → PROC: {in_article.title[:60]}... "
                f"(Sentiment: {sentiment['score']:.2f}, Ticker: {primary_ticker})"
            )

            return proc_id

        except Exception as e:
            log.error(f"[ArticleProcessor] Error processing {news_id}: {e}", exc_info=True)
            return None

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

    def close(self):
        """세션 종료"""
        if self.session_owner:
            self.session.close()


# =============================================================================
# 스케줄러용 함수
# =============================================================================

_processor: Optional[ArticleProcessor] = None


def get_article_processor() -> ArticleProcessor:
    """ArticleProcessor 싱글톤"""
    global _processor
    if _processor is None:
        _processor = ArticleProcessor()
    return _processor


def scheduled_process_articles(limit: int = 100) -> int:
    """
    스케줄러 작업 - IN → PROC 배치 변환

    Args:
        limit: 한 번에 처리할 최대 기사 수

    Returns:
        처리된 기사 수
    """
    try:
        log.info("[Scheduled Job] process_articles started")
        processor = get_article_processor()
        count = processor.process_unprocessed_articles(limit=limit)
        log.info(f"[Scheduled Job] process_articles completed: {count} articles processed")
        return count
    except Exception as e:
        log.error(f"[Scheduled Job] process_articles failed: {e}", exc_info=True)
        return 0

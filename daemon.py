"""
MarketPulse Daemon - Background News Crawler Service
스케줄러를 이용한 주기적 크롤링 데몬
"""
import sys
import signal
import logging
import time
from pathlib import Path
from datetime import datetime

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger

from index_analyzer.crawling.crawler import Crawler
from index_analyzer.crawling.url_classifier import URLClassifier
from index_analyzer.parsing.heuristics import ArticleHeuristics
from index_analyzer.parsing.parser import Parser
from index_analyzer.models.schemas import CrawlConfig
from index_analyzer.config.loader import ConfigLoader

from app.models.database import get_postgresql_db, get_sqlite_db
from app.services.ticker_extractor import TickerExtractor
from app.services.sentiment_analyzer import SentimentAnalyzer
from app.services.news_processor import NewsProcessor


# 로깅 설정
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('logs/daemon.log'),
        logging.StreamHandler(sys.stdout)
    ]
)
log = logging.getLogger(__name__)


class MarketPulseDaemon:
    """
    MarketPulse 백그라운드 데몬
    - 주기적으로 뉴스 크롤링
    - 티커 추출 및 감성 분석
    - DB에 저장
    """

    def __init__(self, config_path: str = "./sites.yaml", db_url: str = None):
        """
        Args:
            config_path: sites.yaml 경로
            db_url: PostgreSQL URL (예: postgresql://user:pass@localhost:5432/marketpulse)
                    None이면 SQLite 사용
        """
        self.config_path = config_path
        self.db_url = db_url
        self.scheduler = BackgroundScheduler()
        self.running = False

        # 로그 디렉토리 생성
        Path("logs").mkdir(exist_ok=True)

        # DB 초기화
        if db_url:
            log.info(f"Using PostgreSQL: {db_url}")
            self.db = get_postgresql_db(db_url)
        else:
            log.info("Using SQLite: data/marketpulse.db")
            DB_PATH = Path("data/marketpulse.db")
            DB_PATH.parent.mkdir(exist_ok=True)
            self.db = get_sqlite_db(str(DB_PATH))

        self.db.create_tables()

        # 서비스 초기화
        self.ticker_extractor = TickerExtractor()
        self.sentiment_analyzer = SentimentAnalyzer(use_transformers=False)
        self.news_processor = NewsProcessor(
            self.ticker_extractor,
            self.sentiment_analyzer
        )

        # 크롤러 설정
        self.crawler_config = CrawlConfig(
            max_total=100,
            max_depth=2,
            same_domain_only=True,
        )

        # Signal 핸들러 등록
        signal.signal(signal.SIGINT, self._signal_handler)
        signal.signal(signal.SIGTERM, self._signal_handler)

        log.info("MarketPulse Daemon initialized")

    def crawl_news(self):
        """
        뉴스 크롤링 작업
        스케줄러에 의해 주기적으로 실행됨
        """
        log.info("="*80)
        log.info("Starting scheduled crawl job")
        log.info("="*80)

        start_time = time.time()

        try:
            # Sites 설정 로드
            sites = ConfigLoader.load_sites(self.config_path)
            if not sites:
                log.error("No sites found in config")
                return

            total_processed = 0
            total_tickers = 0

            # 각 사이트별로 크롤링
            for site in sites:
                log.info(f"Crawling site: {site.name}")

                classifier = URLClassifier()
                heuristics = ArticleHeuristics(allow=(), deny=())

                crawler = Crawler(
                    ccfg=self.crawler_config,
                    heur=heuristics,
                    classifier=classifier,
                    max_depth=self.crawler_config.max_depth,
                )

                # URL 발견
                discovered_urls = list(crawler.discover(site.seed_urls))
                log.info(f"Discovered {len(discovered_urls)} URLs from {site.name}")

                # 기사 파싱 및 처리
                session = self.db.get_session()
                try:
                    for url, depth in discovered_urls:
                        try:
                            # HTML 가져오기
                            html = crawler.http.get_html(url, timeout=10.0)
                            if not html:
                                continue

                            # 파싱
                            parser = Parser(url, html)
                            title = parser.extract_title()
                            published_time = parser.extract_published_time()
                            text = parser.extract_main_text()

                            # 기사 데이터 준비
                            article_data = {
                                'url': url,
                                'title': title,
                                'text_preview': text[:1000] if text else '',
                                'content': text,
                                'source': site.name,
                                'published_time': str(published_time) if published_time else None,
                                'depth': depth
                            }

                            # 티커 추출 + 감성 분석 + DB 저장
                            result = self.news_processor.process_article(article_data, session)

                            if result:
                                total_processed += 1

                                # 티커 개수 카운트
                                from app.models.database import NewsArticle
                                saved_article = session.query(NewsArticle).filter_by(url=url).first()
                                if saved_article:
                                    ticker_count = len(saved_article.tickers)
                                    total_tickers += ticker_count

                                    log.info(f"Processed: {title[:50]}... "
                                           f"({ticker_count} tickers, "
                                           f"sentiment: {saved_article.sentiment_label})")

                        except Exception as e:
                            log.error(f"Error processing {url}: {e}")
                            continue

                finally:
                    session.close()

            elapsed = time.time() - start_time
            log.info("="*80)
            log.info("Crawl job completed")
            log.info(f"Articles processed: {total_processed}")
            log.info(f"Tickers extracted: {total_tickers}")
            log.info(f"Time elapsed: {elapsed:.2f}s")
            log.info("="*80)

        except Exception as e:
            log.error(f"Crawl job failed: {e}", exc_info=True)

    def cleanup_old_news(self):
        """
        오래된 뉴스 정리 작업 (선택사항)
        30일 이상 된 뉴스 삭제
        """
        log.info("Running cleanup job...")
        try:
            session = self.db.get_session()
            try:
                from app.models.database import NewsArticle
                from datetime import timedelta

                cutoff_date = datetime.now() - timedelta(days=30)
                deleted = session.query(NewsArticle).filter(
                    NewsArticle.crawled_at < cutoff_date
                ).delete()

                session.commit()
                log.info(f"Cleaned up {deleted} old articles")
            finally:
                session.close()
        except Exception as e:
            log.error(f"Cleanup job failed: {e}")

    def start(self):
        """
        데몬 시작
        스케줄러 작업 등록 및 실행
        """
        if self.running:
            log.warning("Daemon is already running")
            return

        log.info("Starting MarketPulse Daemon...")

        # 작업 스케줄 등록

        # 1. 뉴스 크롤링 - 매 1시간마다
        self.scheduler.add_job(
            func=self.crawl_news,
            trigger=IntervalTrigger(hours=1),
            id='crawl_news',
            name='News Crawling Job',
            replace_existing=True
        )
        log.info("Scheduled: News crawling every 1 hour")

        # 2. 뉴스 크롤링 - 특정 시간대 (예: 매일 오전 9시, 오후 3시, 오후 9시)
        self.scheduler.add_job(
            func=self.crawl_news,
            trigger=CronTrigger(hour='9,15,21', minute=0),
            id='crawl_news_scheduled',
            name='Scheduled News Crawling',
            replace_existing=True
        )
        log.info("Scheduled: News crawling at 9AM, 3PM, 9PM")

        # 3. 정리 작업 - 매일 자정
        self.scheduler.add_job(
            func=self.cleanup_old_news,
            trigger=CronTrigger(hour=0, minute=0),
            id='cleanup_old_news',
            name='Cleanup Old News',
            replace_existing=True
        )
        log.info("Scheduled: Cleanup at midnight")

        # 스케줄러 시작
        self.scheduler.start()
        self.running = True

        log.info("="*80)
        log.info("MarketPulse Daemon is running")
        log.info("Press Ctrl+C to stop")
        log.info("="*80)

        # 즉시 한 번 실행 (선택사항)
        log.info("Running initial crawl...")
        self.crawl_news()

        # 메인 루프 (신호 대기)
        try:
            while self.running:
                time.sleep(1)
        except KeyboardInterrupt:
            self.stop()

    def stop(self):
        """데몬 중지"""
        if not self.running:
            return

        log.info("Stopping MarketPulse Daemon...")
        self.scheduler.shutdown()
        self.running = False
        log.info("Daemon stopped")

    def _signal_handler(self, signum, frame):
        """시그널 핸들러"""
        log.info(f"Received signal {signum}")
        self.stop()
        sys.exit(0)


def main():
    """
    메인 실행 함수
    """
    import argparse

    parser = argparse.ArgumentParser(description='MarketPulse News Crawler Daemon')
    parser.add_argument(
        '--db-url',
        type=str,
        default=None,
        help='PostgreSQL URL (예: postgresql://user:pass@localhost:5432/marketpulse)'
    )
    parser.add_argument(
        '--config',
        type=str,
        default='./sites.yaml',
        help='Sites configuration file path'
    )
    parser.add_argument(
        '--test',
        action='store_true',
        help='Run one-time crawl and exit (for testing)'
    )

    args = parser.parse_args()

    # 데몬 생성
    daemon = MarketPulseDaemon(
        config_path=args.config,
        db_url=args.db_url
    )

    if args.test:
        # 테스트 모드: 한 번만 실행
        log.info("Running in test mode (one-time crawl)")
        daemon.crawl_news()
        log.info("Test completed")
    else:
        # 데몬 모드: 계속 실행
        daemon.start()


if __name__ == "__main__":
    main()

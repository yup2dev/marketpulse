"""
Crawler Service - 뉴스 크롤링 통합 서비스
스케줄러에서 호출할 수 있는 고수준 크롤링 함수 제공
"""
import logging
import yaml
from pathlib import Path
from typing import List, Dict, Optional
from datetime import datetime
from sqlalchemy.orm import Session

from index_analyzer.models.schemas import CrawlConfig
from index_analyzer.crawling.crawler import Crawler
from index_analyzer.crawling.url_classifier import URLClassifier
from index_analyzer.parsing.heuristics import ArticleHeuristics
from index_analyzer.parsing.parser import Parser

from app.models.database import (
    get_sqlite_db,
    MBS_IN_ARTICLE, MBS_IN_STK_STBD, MBS_IN_ETF_STBD,
    generate_id, generate_batch_id
)
from app.services.ticker_extractor import TickerExtractor
from app.services.sentiment_analyzer import SentimentAnalyzer
from app.core.config import settings

log = logging.getLogger(__name__)


class CrawlerService:
    """뉴스 크롤링 서비스"""

    def __init__(self):
        """초기화"""
        self.sites_config_path = Path(__file__).parent.parent.parent / "sites.yaml"
        self.ticker_extractor = TickerExtractor()
        self.sentiment_analyzer = SentimentAnalyzer(use_transformers=settings.USE_TRANSFORMERS)

        # 데이터베이스 연결
        db_path = Path(settings.SQLITE_PATH)
        db_path.parent.mkdir(parents=True, exist_ok=True)
        self.db = get_sqlite_db(str(db_path))
        self.db.create_tables()

        # 배치 ID 생성 (세션당 한번)
        self.current_batch_id = generate_batch_id()

        log.info(f"CrawlerService initialized with DB: {db_path}")
        log.info(f"Current batch ID: {self.current_batch_id}")

    def load_sites_config(self) -> Dict[str, List[str]]:
        """
        sites.yaml 로드

        Returns:
            {site_name: [seed_urls]}
        """
        if not self.sites_config_path.exists():
            log.error(f"sites.yaml not found at {self.sites_config_path}")
            return {}

        with open(self.sites_config_path, 'r', encoding='utf-8') as f:
            config = yaml.safe_load(f)

        sites = {}
        for site_name, site_config in config.items():
            if not isinstance(site_config, dict):
                continue

            # seed_urls 또는 SEED_URLS 키 찾기 (대소문자 무관)
            seed_urls = site_config.get('seed_urls') or site_config.get('SEED_URLS') or []
            if seed_urls:
                sites[site_name] = seed_urls

        log.info(f"Loaded {len(sites)} sites: {list(sites.keys())}")
        return sites

    def _save_to_mbs_in_article(
        self,
        source_cd: str,
        url: str,
        title: str,
        content: str,
        published_time: Optional[datetime]
    ) -> Optional[str]:
        """
        MBS_IN_ARTICLE 테이블에 저장 (크롤러 입수 데이터)

        Args:
            source_cd: 출처 코드 (사이트명)
            url: 기사 URL
            title: 제목
            content: 본문
            published_time: 발행 시간

        Returns:
            저장된 news_id (중복이면 None)
        """
        session: Session = self.db.get_session()
        try:
            # news_id 생성
            news_id = generate_id('NEWS-')

            # 중복 체크 (URL 기반)
            existing = session.query(MBS_IN_ARTICLE).filter(
                MBS_IN_ARTICLE.title == title
            ).first()

            if existing:
                log.debug(f"Article already exists: {title[:60]}")
                session.close()
                return None

            # 발행 시간 처리
            published_dt = published_time if published_time else datetime.utcnow()
            base_ymd = published_dt.date()

            # MBS_IN_ARTICLE 생성
            article = MBS_IN_ARTICLE(
                news_id=news_id,
                base_ymd=base_ymd,
                source_cd=source_cd,
                title=title,
                content=content or "",
                publish_dt=published_dt,
                ingest_batch_id=self.current_batch_id
            )
            session.add(article)
            session.commit()

            log.info(f"[MBS_IN] Saved article (ID: {news_id}): {title[:60]}")

            session.close()
            return news_id

        except Exception as e:
            session.rollback()
            log.error(f"Failed to save to MBS_IN_ARTICLE: {e}")
            session.close()
            return None

# ===== 스케줄러에서 호출할 전역 함수 =====

_crawler_service: Optional[CrawlerService] = None


def get_crawler_service() -> CrawlerService:
    """크롤러 서비스 싱글톤 반환"""
    global _crawler_service
    if _crawler_service is None:
        _crawler_service = CrawlerService()
    return _crawler_service


def crawl_with_stream(event_bus):
    """
    Stream 기반 뉴스 크롤링 (D4: Crawler Module)

    흐름:
    1. 뉴스 크롤링
    2. 기본 정보만 DB 저장 (sentiment 제외)
    3. Redis Stream에 article_id 발행 → Analyzer가 처리

    Args:
        event_bus: RedisEventBus 인스턴스

    Returns:
        Stream에 발행된 기사 수
    """
    try:
        log.info("=" * 80)
        log.info("[Stream Crawler] Starting news crawl")
        log.info("=" * 80)

        service = get_crawler_service()
        sites = service.load_sites_config()

        if not sites:
            log.warning("[Stream Crawler] No sites to crawl")
            return 0

        published_count = 0

        for site_name, seed_urls in sites.items():
            log.info(f"[Stream Crawler] Crawling {site_name}...")

            try:
                # 크롤 설정
                crawl_cfg = CrawlConfig(
                    max_total=settings.CRAWLER_MAX_WORKERS * 2,
                    max_depth=2,
                    timeout_get=settings.CRAWLER_TIMEOUT,
                    same_domain_only=True,
                    user_agent="Mozilla/5.0 (MarketPulse Bot)"
                )

                # 크롤러 초기화
                heuristics = ArticleHeuristics(allow=(), deny=())
                classifier = URLClassifier()
                crawler = Crawler(crawl_cfg, heuristics, classifier, max_depth=2)

                # 크롤링 및 Stream 발행
                for url, depth in crawler.discover(seed_urls):
                    try:
                        # HTML 파싱
                        html = crawler.http.get_html(url, timeout=crawl_cfg.timeout_get)
                        if not html:
                            continue

                        parser = Parser(url, html)
                        title = parser.extract_title()

                        if not title:
                            continue

                        # MBS_IN_ARTICLE에 저장 (크롤러 입수)
                        news_id = service._save_to_mbs_in_article(
                            site_name,
                            url,
                            title,
                            parser.extract_main_text(),
                            parser.extract_published_time()
                        )

                        if news_id:
                            # Redis Stream에 발행 (Analyzer가 IN → PROC 처리)
                            msg_id = event_bus.publish_to_stream(
                                'stream:new_articles',
                                {
                                    'news_id': news_id,
                                    'url': url,
                                    'source_cd': site_name,
                                    'timestamp': datetime.utcnow().isoformat()
                                }
                            )

                            if msg_id:
                                published_count += 1
                                log.info(f"[Stream Crawler] Published: {title[:60]}... (ID: {news_id})")

                    except Exception as e:
                        log.error(f"[Stream Crawler] Error processing {url}: {e}")
                        continue

            except Exception as e:
                log.error(f"[Stream Crawler] Error crawling {site_name}: {e}")
                continue

        log.info("=" * 80)
        log.info(f"[Stream Crawler] Completed: {published_count} articles published to stream")
        log.info("=" * 80)

        return published_count

    except Exception as e:
        log.error(f"[Stream Crawler] Failed: {e}", exc_info=True)
        return 0

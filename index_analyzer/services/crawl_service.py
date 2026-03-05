"""
Crawl Service - 뉴스 입수 서비스
Extracted from: pipeline/in_module.py
"""
import yaml
from pathlib import Path
from typing import List, Dict, Optional
from datetime import datetime
from sqlalchemy.orm import Session

from ..models.schemas import CrawlConfig
from ..crawling.crawler import Crawler
from ..crawling.classifier import URLClassifier
from ..parsing.heuristics import ArticleHeuristics
from ..parsing.parser import Parser
from ..utils.db import get_sqlite_db, generate_id, generate_batch_id
from ..utils.logging import get_logger
from ..models.orm import MBS_IN_ARTICLE
from ..config.settings import settings
from .ticker_service import TickerExtractor
from .sentiment_service import SentimentAnalyzer

log = get_logger(__name__)


class CrawlerService:
    """
    IN 모듈: 뉴스 입수 (독립적으로 동작)
    - sites.yaml에서 사이트 목록 로드
    - 뉴스 크롤링 및 파싱
    - MBS_IN_ARTICLE 테이블에 저장
    """

    def __init__(self):
        self.sites_config_path = Path(__file__).parent.parent.parent / "sites.yaml"
        self.ticker_extractor = TickerExtractor()
        self.sentiment_analyzer = SentimentAnalyzer(use_transformers=settings.USE_TRANSFORMERS)

        db_path = Path(settings.SQLITE_PATH)
        db_path.parent.mkdir(parents=True, exist_ok=True)
        self.db = get_sqlite_db(str(db_path))
        self.db.create_tables()

        self.current_batch_id = generate_batch_id()

        log.info(f"CrawlerService initialized with DB: {db_path}")
        log.info(f"Current batch ID: {self.current_batch_id}")

    def load_sites_config(self) -> Dict[str, List[str]]:
        """sites.yaml 로드"""
        if not self.sites_config_path.exists():
            log.error(f"sites.yaml not found at {self.sites_config_path}")
            return {}

        with open(self.sites_config_path, 'r', encoding='utf-8') as f:
            config = yaml.safe_load(f)

        sites = {}
        for site_name, site_config in config.items():
            if not isinstance(site_config, dict):
                continue
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
        """MBS_IN_ARTICLE 테이블에 저장"""
        session: Session = self.db.get_session()
        try:
            news_id = generate_id('NEWS-')

            existing = session.query(MBS_IN_ARTICLE).filter(
                MBS_IN_ARTICLE.title == title
            ).first()

            if existing:
                log.debug(f"Article already exists: {title[:60]}")
                session.close()
                return None

            published_dt = published_time if published_time else datetime.utcnow()
            base_ymd = published_dt.date()

            article = MBS_IN_ARTICLE(
                news_id=news_id,
                base_ymd=base_ymd,
                source_cd=source_cd,
                url=url,
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


# ===== 싱글톤 =====

_crawler_service: Optional[CrawlerService] = None


def get_crawler_service() -> CrawlerService:
    """크롤러 서비스 싱글톤 반환"""
    global _crawler_service
    if _crawler_service is None:
        _crawler_service = CrawlerService()
    return _crawler_service


def crawl_with_stream(event_bus):
    """
    Stream 기반 뉴스 크롤링

    흐름:
    1. 뉴스 크롤링
    2. 기본 정보만 DB 저장 (sentiment 제외)
    3. Redis Stream에 article_id 발행 → Analyzer가 처리

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
                crawl_cfg = CrawlConfig(
                    max_total=settings.CRAWLER_MAX_WORKERS * 2,
                    max_depth=2,
                    timeout_get=settings.CRAWLER_TIMEOUT,
                    same_domain_only=True,
                    user_agent="Mozilla/5.0 (MarketPulse Bot)"
                )

                heuristics = ArticleHeuristics(allow=(), deny=())
                classifier = URLClassifier()
                crawler = Crawler(crawl_cfg, heuristics, classifier, max_depth=2)

                for url, depth in crawler.discover(seed_urls):
                    try:
                        html = crawler.http.get_html(url, timeout=crawl_cfg.timeout_get)
                        if not html:
                            continue

                        parser = Parser(url, html)
                        title = parser.extract_title()
                        content = parser.extract_main_text()

                        if not title or not content:
                            continue

                        log.info(f"[Crawl] Found: {title[:60]}...")

                        sentiment_result = service.sentiment_analyzer.analyze(content)
                        sentiment_score = sentiment_result.get('score', 0.0)
                        sentiment_label = sentiment_result.get('label', 'neutral')

                        tickers = service.ticker_extractor.extract(content, title)

                        summary = (
                            service.sentiment_analyzer.summarize(content)
                            if hasattr(service.sentiment_analyzer, 'summarize')
                            else content[:200]
                        )

                        log.info(f"[PROC] Sentiment: {sentiment_label} ({sentiment_score:.2f}), Tickers: {tickers}, Summary length: {len(summary)}")

                        news_id = service._save_to_mbs_in_article(
                            site_name, url, title, summary,
                            parser.extract_published_time()
                        )

                        if news_id:
                            published_count += 1
                            log.info(f"[IN] Saved: {news_id} - {title[:60]}...")

                    except Exception as e:
                        log.error(f"[Crawl] Error processing {url}: {e}")
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

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
from dataclasses import dataclass
from typing import Optional as Opt

from app.models.database import get_sqlite_db, NewsArticle, NewsTicker
from app.services.ticker_extractor import TickerExtractor
from app.services.sentiment_analyzer import SentimentAnalyzer
from app.core.config import settings

log = logging.getLogger(__name__)


@dataclass
class ParsedArticle:
    """파싱된 기사 정보"""
    url: str
    title: str
    content: str
    summary: Opt[str] = None
    published: Opt[datetime] = None
    author: Opt[str] = None


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

        log.info(f"CrawlerService initialized with DB: {db_path}")

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

    def crawl_site(
        self,
        site_name: str,
        seed_urls: List[str],
        max_articles: int = 10,
        max_depth: int = 2
    ) -> int:
        """
        특정 사이트 크롤링

        Args:
            site_name: 사이트 이름
            seed_urls: 시드 URL 목록
            max_articles: 최대 수집 기사 수
            max_depth: 크롤링 깊이

        Returns:
            수집된 기사 수
        """
        log.info(f"[{site_name}] Starting crawl with {len(seed_urls)} seed URLs")

        try:
            # 크롤 설정
            crawl_cfg = CrawlConfig(
                max_total=max_articles,
                max_depth=max_depth,
                timeout_get=settings.CRAWLER_TIMEOUT,
                same_domain_only=True,
                user_agent="Mozilla/5.0 (MarketPulse Bot)"
            )

            # 크롤러 초기화
            heuristics = ArticleHeuristics(allow=(), deny=())  # 기본 휴리스틱
            classifier = URLClassifier()
            crawler = Crawler(crawl_cfg, heuristics, classifier, max_depth=max_depth)

            # 크롤링 실행
            article_count = 0
            for url, depth in crawler.discover(seed_urls):
                try:
                    # HTML 파싱
                    html = crawler.http.get_html(url, timeout=crawl_cfg.timeout_get)
                    if not html:
                        continue

                    # Parser 인스턴스 생성 및 파싱
                    parser = Parser(url, html)

                    title = parser.extract_title()
                    if not title:
                        log.debug(f"[{site_name}] No title found: {url}")
                        continue

                    # 파싱 결과 생성
                    result = ParsedArticle(
                        url=url,
                        title=title,
                        content=parser.extract_main_text(),
                        summary=None,  # 요약은 content의 첫 200자 사용
                        published=parser.extract_published_time(),
                        author=None
                    )

                    # 요약 생성 (content의 첫 200자)
                    if result.content:
                        result.summary = result.content[:200] + "..." if len(result.content) > 200 else result.content

                    # 데이터베이스에 저장
                    saved = self._save_article(site_name, url, result)
                    if saved:
                        article_count += 1
                        log.info(f"[{site_name}] Saved: {result.title[:60]}...")

                except Exception as e:
                    log.error(f"[{site_name}] Error processing {url}: {e}")
                    continue

            log.info(f"[{site_name}] Crawl completed: {article_count} articles saved")
            return article_count

        except Exception as e:
            log.error(f"[{site_name}] Crawl failed: {e}", exc_info=True)
            return 0

    def _save_article(
        self,
        source: str,
        url: str,
        parsed_result
    ) -> bool:
        """
        기사 데이터베이스 저장

        Args:
            source: 출처 사이트
            url: 기사 URL
            parsed_result: 파싱 결과

        Returns:
            저장 성공 여부
        """
        session: Session = self.db.get_session()
        try:
            # 중복 체크
            existing = session.query(NewsArticle).filter(NewsArticle.url == url).first()
            if existing:
                log.debug(f"Article already exists: {url}")
                session.close()
                return False

            # 발행 시간 처리
            published_at = parsed_result.published if parsed_result.published else datetime.utcnow()

            # 티커 추출
            text = f"{parsed_result.title} {parsed_result.summary or ''}"
            tickers = self.ticker_extractor.extract(text, title=parsed_result.title)

            # 감성 분석
            sentiment = self.sentiment_analyzer.analyze(text)

            # 중요도 계산 (간단한 휴리스틱)
            importance = self._calculate_importance(parsed_result, tickers, sentiment)

            # NewsArticle 생성
            article = NewsArticle(
                title=parsed_result.title,
                summary=parsed_result.summary or "",
                content=parsed_result.content or "",
                url=url,
                source=source,
                author=parsed_result.author,
                published_at=published_at,
                sentiment_score=sentiment['score'],
                sentiment_label=sentiment['label'],
                importance_score=importance,
                crawled_at=datetime.utcnow()
            )
            session.add(article)
            session.flush()  # ID 생성

            # 티커 연결 (NewsTicker)
            for ticker_info in tickers:
                news_ticker = NewsTicker(
                    news_id=article.id,
                    ticker_symbol=ticker_info['symbol'],
                    mention_count=ticker_info.get('count', 1),
                    confidence=ticker_info.get('confidence', 1.0)
                )
                session.add(news_ticker)

            session.commit()
            log.debug(f"Saved article with {len(tickers)} tickers: {article.title[:60]}")
            return True

        except Exception as e:
            session.rollback()
            log.error(f"Failed to save article {url}: {e}")
            return False
        finally:
            session.close()

    def _calculate_importance(
        self,
        parsed_result,
        tickers: List[Dict],
        sentiment: Dict
    ) -> float:
        """
        기사 중요도 계산 (0-10)

        고려 요소:
        - 티커 개수
        - 감성 강도
        - 제목 길이
        - 요약 존재 여부
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
        if len(parsed_result.title) > 50:
            score += 0.5
        if len(parsed_result.title) > 100:
            score += 0.5

        # 요약 존재 (+1점)
        if parsed_result.summary and len(parsed_result.summary) > 100:
            score += 1.0

        return min(score, 10.0)

    def crawl_all_sites(
        self,
        max_articles_per_site: int = 10,
        max_depth: int = 2
    ) -> Dict[str, int]:
        """
        모든 사이트 크롤링

        Args:
            max_articles_per_site: 사이트당 최대 기사 수
            max_depth: 크롤링 깊이

        Returns:
            {site_name: article_count}
        """
        log.info("=" * 80)
        log.info("Starting scheduled news crawl")
        log.info("=" * 80)

        sites = self.load_sites_config()
        if not sites:
            log.warning("No sites to crawl")
            return {}

        results = {}
        total_articles = 0

        for site_name, seed_urls in sites.items():
            count = self.crawl_site(
                site_name,
                seed_urls,
                max_articles=max_articles_per_site,
                max_depth=max_depth
            )
            results[site_name] = count
            total_articles += count

        log.info("=" * 80)
        log.info(f"Crawl completed: {total_articles} total articles from {len(sites)} sites")
        log.info(f"Results: {results}")
        log.info("=" * 80)

        return results


# ===== 스케줄러에서 호출할 전역 함수 =====

_crawler_service: Optional[CrawlerService] = None


def get_crawler_service() -> CrawlerService:
    """크롤러 서비스 싱글톤 반환"""
    global _crawler_service
    if _crawler_service is None:
        _crawler_service = CrawlerService()
    return _crawler_service


def crawl_all_news():
    """
    전체 뉴스 크롤링 (스케줄러 작업)

    APScheduler에서 호출:
        scheduler.add_job(crawl_all_news, 'interval', hours=1)
    """
    try:
        log.info("⏰ Scheduled task: crawl_all_news started")
        service = get_crawler_service()
        results = service.crawl_all_sites(
            max_articles_per_site=settings.CRAWLER_MAX_WORKERS * 2,
            max_depth=2
        )
        log.info(f"✅ Scheduled task: crawl_all_news completed - {sum(results.values())} articles")
        return results
    except Exception as e:
        log.error(f"❌ Scheduled task: crawl_all_news failed - {e}", exc_info=True)
        return {}


def analyze_recent_news_sentiment():
    """
    최근 뉴스 감성 재분석 (스케줄러 작업)

    처리되지 않은 뉴스나 감성 점수가 없는 뉴스 재분석
    """
    try:
        log.info("⏰ Scheduled task: analyze_recent_news_sentiment started")
        service = get_crawler_service()
        session = service.db.get_session()

        # 감성 점수가 0인 최근 24시간 뉴스 조회
        from datetime import timedelta
        cutoff_time = datetime.utcnow() - timedelta(hours=24)

        articles = session.query(NewsArticle).filter(
            NewsArticle.sentiment_score == 0.0,
            NewsArticle.published_at >= cutoff_time
        ).limit(100).all()

        updated_count = 0
        for article in articles:
            text = f"{article.title} {article.summary}"
            sentiment = service.sentiment_analyzer.analyze(text)

            article.sentiment_score = sentiment['score']
            article.sentiment_label = sentiment['label']
            updated_count += 1

        session.commit()
        session.close()

        log.info(f"✅ Scheduled task: analyze_recent_news_sentiment completed - {updated_count} articles updated")
        return updated_count

    except Exception as e:
        log.error(f"❌ Scheduled task: analyze_recent_news_sentiment failed - {e}", exc_info=True)
        return 0

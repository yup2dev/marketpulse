"""
통합 크롤러 - 뉴스 수집 + 티커 추출 + 감성 분석 + DB 저장
"""
import io
import sys
import logging
import json
from datetime import datetime
from pathlib import Path

# Fix Windows encoding
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

from index_analyzer.crawling.crawler import Crawler
from index_analyzer.crawling.url_classifier import URLClassifier
from index_analyzer.parsing.heuristics import ArticleHeuristics
from index_analyzer.parsing.parser import Parser
from index_analyzer.models.schemas import CrawlConfig
from index_analyzer.config.loader import ConfigLoader

from app.models.database import get_sqlite_db
from app.services.ticker_extractor import TickerExtractor
from app.services.sentiment_analyzer import SentimentAnalyzer
from app.services.news_processor import NewsProcessor

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
log = logging.getLogger(__name__)


def main():
    print("=" * 80)
    print("MarketPulse 통합 크롤러")
    print("뉴스 크롤링 → 티커 추출 → 감성 분석 → 데이터베이스 저장")
    print("=" * 80)

    # 1. 데이터베이스 초기화
    log.info("Initializing database...")
    # Use absolute path to avoid "unable to open database file" errors
    DB_PATH = Path(__file__).parent / "data" / "marketpulse.db"
    DB_PATH.parent.mkdir(exist_ok=True)
    db = get_sqlite_db(str(DB_PATH))
    db.create_tables()
    log.info(f"Database: {DB_PATH}")

    # 2. 서비스 초기화
    log.info("Initializing services...")
    ticker_extractor = TickerExtractor()
    sentiment_analyzer = SentimentAnalyzer(use_transformers=False)
    news_processor = NewsProcessor(ticker_extractor, sentiment_analyzer)

    # 3. 크롤러 설정
    config = CrawlConfig(
        max_total=5,  # 테스트용 적은 개수
        max_depth=1,
        same_domain_only=True,
    )

    classifier = URLClassifier()
    heuristics = ArticleHeuristics(allow=(), deny=())

    crawler = Crawler(
        ccfg=config,
        heur=heuristics,
        classifier=classifier,
        max_depth=config.max_depth,
    )

    # 4. sites.yaml에서 seed URL 로드
    log.info("Loading sites configuration...")
    sites = ConfigLoader.load_sites("./sites.yaml")
    if not sites:
        log.error("No sites found in sites.yaml")
        return

    # 첫 번째 사이트 사용 (테스트)
    seed_urls = []
    site_name = ""
    if sites:
        site_name = sites[0].name
        seed_urls = sites[0].seed_urls
        log.info(f"Using site: {site_name}")

    if not seed_urls:
        log.error("No seed URLs found")
        return

    print(f"\nConfiguration:")
    print(f"  Seed URLs: {len(seed_urls)}")
    print(f"  Max articles: {config.max_total}")
    print(f"  Database: {DB_PATH}")
    print("=" * 80)

    # 5. 크롤링 시작
    log.info("Starting crawl...")
    discovered_urls = list(crawler.discover(seed_urls))
    log.info(f"Discovered {len(discovered_urls)} URLs")

    # 6. 기사 파싱 및 처리
    session = db.get_session()
    processed_count = 0
    ticker_count = 0

    try:
        for url, depth in discovered_urls:
            try:
                print(f"\n{'='*80}")
                print(f"[{processed_count + 1}] {url}")
                print(f"{'='*80}")

                # 6.1. HTML 가져오기
                html = crawler.http.get_html(url, timeout=10.0)
                if not html:
                    print("  ✗ Failed to fetch HTML")
                    continue

                # 6.2. 파싱
                parser = Parser(url, html)
                title = parser.extract_title()
                published_time = parser.extract_published_time()
                text = parser.extract_main_text()

                print(f"  Title: {title[:70]}")
                print(f"  Published: {published_time or 'N/A'}")
                print(f"  Text length: {len(text):,} chars")

                # 6.3. 기사 데이터 준비
                article_data = {
                    'url': url,
                    'title': title,
                    'text_preview': text[:1000] if text else '',
                    'content': text,
                    'source': site_name,
                    'published_time': str(published_time) if published_time else None,
                    'depth': depth
                }

                # 6.4. 티커 추출 + 감성 분석 + DB 저장
                result = news_processor.process_article(article_data, session)

                if result:
                    processed_count += 1
                    # 저장된 기사 정보 출력
                    from app.models.database import NewsArticle
                    saved_article = session.query(NewsArticle).filter_by(url=url).first()

                    if saved_article:
                        tickers = saved_article.tickers
                        ticker_count += len(tickers)

                        print(f"  ✓ Saved to database")
                        print(f"  Tickers: {len(tickers)}")
                        for t in tickers:
                            print(f"    - {t.ticker_symbol}: {t.ticker.name if t.ticker else 'N/A'} "
                                  f"(confidence: {t.confidence:.2f}, mentions: {t.mention_count})")
                        print(f"  Sentiment: {saved_article.sentiment_label} "
                              f"(score: {saved_article.sentiment_score:.2f})")
                        print(f"  Importance: {saved_article.importance_score:.1f}/10")
                else:
                    print("  ⚠ Skipped (duplicate or error)")

            except Exception as e:
                log.error(f"Error processing {url}: {e}")
                continue

    finally:
        session.close()

    # 7. 결과 출력
    print("\n" + "=" * 80)
    print("CRAWL COMPLETE")
    print("=" * 80)
    print(f"\nStatistics:")
    print(f"  URLs discovered: {len(discovered_urls)}")
    print(f"  Articles processed: {processed_count}")
    print(f"  Tickers extracted: {ticker_count}")
    print(f"  Average tickers/article: {ticker_count/processed_count:.1f}" if processed_count > 0 else "")

    # 8. 트렌딩 티커 출력
    print(f"\nTop Trending Tickers:")
    session = db.get_session()
    try:
        from sqlalchemy import func
        from app.models.database import NewsTicker, Ticker

        trending = session.query(
            NewsTicker.ticker_symbol,
            Ticker.name,
            func.count(NewsTicker.id).label('count')
        ).join(Ticker).group_by(
            NewsTicker.ticker_symbol, Ticker.name
        ).order_by(func.count(NewsTicker.id).desc()).limit(10).all()

        for i, (symbol, name, count) in enumerate(trending, 1):
            print(f"  {i}. {symbol} ({name}): {count} articles")

    finally:
        session.close()

    print("\n" + "=" * 80)
    print(f"Database saved: {DB_PATH}")
    print(f"Start API server: python -m app.main")
    print("=" * 80)

if __name__ == "__main__":
    main()

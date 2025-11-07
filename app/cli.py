"""
MarketPulse CLI - Manual Task Execution
각 모듈을 독립적으로 실행하기 위한 CLI 도구

Usage:
    python -m app.cli crawl          # 뉴스 크롤링 실행 (Redis 필요)
    python -m app.cli proc           # PROC 배치 처리 (IN → PROC)
    python -m app.cli calc           # CALC 배치 처리 (PROC → CALC)
    python -m app.cli rcmd           # RCMD 생성 (CALC → RCMD)
    python -m app.cli sync-market    # 마켓 데이터 동기화
    python -m app.cli cleanup        # 데이터 정리

파이프라인 흐름:
    crawl → proc → calc → rcmd
"""
import sys
import logging
from datetime import datetime, date

# 로깅 설정
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
log = logging.getLogger(__name__)


# =============================================================================
# 파이프라인 모듈 실행 명령어
# =============================================================================

def run_crawler():
    """뉴스 크롤링 실행 (IN 모듈)"""
    log.info("=" * 60)
    log.info("Manual Task: News Crawler (IN Module)")
    log.info("=" * 60)

    from app.core.config import settings
    from app.redis_bus import create_redis_event_bus
    from app.services.crawler_service import crawl_with_stream

    if not settings.REDIS_URL:
        log.error("Redis URL not configured. Cannot run crawler.")
        log.error("Please set REDIS_URL in environment or .env file")
        return 0

    # Redis Event Bus 초기화
    event_bus = create_redis_event_bus(settings.REDIS_URL)
    if not event_bus:
        log.error("Failed to create Redis Event Bus")
        return 0

    start_time = datetime.now()
    article_count = crawl_with_stream(event_bus)
    elapsed = (datetime.now() - start_time).total_seconds()

    log.info("=" * 60)
    log.info(f"Completed in {elapsed:.2f} seconds")
    log.info(f"Articles published to stream: {article_count}")
    log.info("=" * 60)
    return article_count


def run_proc():
    """PROC 배치 처리 실행 (IN → PROC 변환)"""
    log.info("=" * 60)
    log.info("Manual Task: PROC Batch Processing")
    log.info("=" * 60)

    from app.services.calc_processor import get_calc_processor
    from app.models.database import get_sqlite_db, MBS_IN_ARTICLE, MBS_PROC_ARTICLE, generate_id
    from app.services.ticker_extractor import TickerExtractor
    from app.services.sentiment_analyzer import SentimentAnalyzer
    from app.core.config import settings
    from pathlib import Path
    from decimal import Decimal

    db_path = Path(settings.SQLITE_PATH)
    db = get_sqlite_db(str(db_path))
    session = db.get_session()

    # 분석 도구 초기화
    ticker_extractor = TickerExtractor()
    sentiment_analyzer = SentimentAnalyzer(use_transformers=settings.USE_TRANSFORMERS)

    # 미처리 IN_ARTICLE 조회 (PROC가 없는 것)
    in_articles = session.query(MBS_IN_ARTICLE).filter(
        ~MBS_IN_ARTICLE.proc_articles.any()
    ).limit(100).all()

    processed = 0
    failed = 0

    start_time = datetime.now()

    for in_article in in_articles:
        try:
            # 분석할 텍스트 준비
            text = f"{in_article.title} {in_article.content[:500]}"

            # 1. 감성 분석
            sentiment = sentiment_analyzer.analyze(text)

            # 2. 티커 추출
            tickers = ticker_extractor.extract(text, title=in_article.title)
            primary_ticker = tickers[0]['symbol'] if tickers else None

            # 3. 요약 생성
            summary_text = in_article.content[:200] if in_article.content else ""
            if len(in_article.content or "") > 200:
                summary_text += "..."

            # 4. MBS_PROC_ARTICLE 생성
            proc_id = generate_id('PROC-')
            match_score = Decimal(str(tickers[0].get('confidence', 0.5))) if tickers else Decimal('0.0')
            sentiment_score = Decimal(str(sentiment['score']))

            proc_article = MBS_PROC_ARTICLE(
                proc_id=proc_id,
                news_id=in_article.news_id,
                stk_cd=primary_ticker,
                summary_text=summary_text,
                match_score=match_score,
                price_impact=Decimal('0.0'),
                sentiment_score=sentiment_score,
                price=None,
                base_ymd=in_article.base_ymd,
                source_batch_id=in_article.ingest_batch_id
            )

            session.add(proc_article)
            session.commit()
            processed += 1

        except Exception as e:
            log.error(f"Error processing {in_article.news_id}: {e}")
            failed += 1
            session.rollback()
            continue

    session.close()
    elapsed = (datetime.now() - start_time).total_seconds()

    log.info("=" * 60)
    log.info(f"Completed in {elapsed:.2f} seconds")
    log.info(f"Processed: {processed}, Failed: {failed}")
    log.info("=" * 60)
    return {'processed': processed, 'failed': failed}


def run_calc():
    """CALC 배치 처리 실행 (PROC → CALC 변환)"""
    log.info("=" * 60)
    log.info("Manual Task: CALC Batch Processing")
    log.info("=" * 60)

    from app.services.calc_processor import get_calc_processor

    start_time = datetime.now()
    processor = get_calc_processor()
    results = processor.batch_process(limit=100)
    elapsed = (datetime.now() - start_time).total_seconds()

    log.info("=" * 60)
    log.info(f"Completed in {elapsed:.2f} seconds")
    log.info(f"Processed: {results['processed']}, Metrics created: {results['metrics_created']}")
    log.info("=" * 60)
    return results


def run_rcmd():
    """RCMD 생성 실행 (CALC → RCMD 변환)"""
    log.info("=" * 60)
    log.info("Manual Task: RCMD Generation")
    log.info("=" * 60)

    from app.services.rcmd_generator import get_rcmd_generator

    start_time = datetime.now()
    generator = get_rcmd_generator()
    results = generator.batch_generate(base_ymd=date.today())
    elapsed = (datetime.now() - start_time).total_seconds()

    log.info("=" * 60)
    log.info(f"Completed in {elapsed:.2f} seconds")
    log.info(f"NEWS: {results['news']}, STOCK: {results['stock']}, PORTFOLIO: {results['portfolio']}")
    log.info("=" * 60)
    return results


# =============================================================================
# 기타 유틸리티 명령어
# =============================================================================

def sync_market_data():
    """마켓 데이터 동기화 실행"""
    log.info("=" * 60)
    log.info("Manual Task: Market Data Sync")
    log.info("=" * 60)

    from app.services.market_data_sync import sync_market_data

    start_time = datetime.now()
    results = sync_market_data()
    elapsed = (datetime.now() - start_time).total_seconds()

    log.info("=" * 60)
    log.info(f"Completed in {elapsed:.2f} seconds")
    log.info(f"Results: {results}")
    log.info("=" * 60)
    return results


def daily_cleanup():
    """일일 정리 작업 실행"""
    log.info("=" * 60)
    log.info("Manual Task: Daily Cleanup")
    log.info("=" * 60)

    from app.scheduler import daily_cleanup

    start_time = datetime.now()
    deleted = daily_cleanup()
    elapsed = (datetime.now() - start_time).total_seconds()

    log.info("=" * 60)
    log.info(f"Completed in {elapsed:.2f} seconds")
    log.info(f"Deleted {deleted} old articles")
    log.info("=" * 60)
    return deleted


def print_usage():
    """사용법 출력"""
    print("""
MarketPulse CLI - Manual Task Execution

Usage:
    python -m app.cli <command>

Pipeline Commands (IN → PROC → CALC → RCMD):
    crawl         뉴스 크롤링 실행 (IN 모듈, Redis 필요)
    proc          PROC 배치 처리 (IN → PROC 변환)
    calc          CALC 배치 처리 (PROC → CALC 변환)
    rcmd          RCMD 생성 (CALC → RCMD 변환)

Utility Commands:
    sync-market   마켓 데이터 동기화 실행
    cleanup       오래된 데이터 정리 실행
    help          이 도움말 출력

Examples:
    # 파이프라인 순차 실행
    python -m app.cli crawl
    python -m app.cli proc
    python -m app.cli calc
    python -m app.cli rcmd

    # 유틸리티
    python -m app.cli sync-market
    python -m app.cli cleanup

Note:
    - crawl 명령은 Redis 연결이 필요합니다.
    - 자동 파이프라인은 백그라운드 워커(python app/worker.py)로 실행됩니다.
    - CLI는 수동/테스트 용도로 사용하세요.
    """)


def main():
    """CLI 진입점"""
    if len(sys.argv) < 2:
        print("Error: Command required")
        print_usage()
        sys.exit(1)

    command = sys.argv[1].lower()

    commands = {
        # Pipeline commands
        'crawl': run_crawler,
        'proc': run_proc,
        'calc': run_calc,
        'rcmd': run_rcmd,
        # Utility commands
        'sync-market': sync_market_data,
        'cleanup': daily_cleanup,
        # Help
        'help': print_usage,
        '--help': print_usage,
        '-h': print_usage
    }

    if command not in commands:
        print(f"Error: Unknown command '{command}'")
        print_usage()
        sys.exit(1)

    try:
        result = commands[command]()
        sys.exit(0)
    except KeyboardInterrupt:
        log.info("\nTask interrupted by user")
        sys.exit(130)
    except Exception as e:
        log.error(f"Task failed: {e}", exc_info=True)
        sys.exit(1)


if __name__ == "__main__":
    main()
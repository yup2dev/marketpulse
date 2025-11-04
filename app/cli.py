"""
MarketPulse CLI - Manual Task Execution
스케줄 작업을 수동으로 실행하기 위한 CLI 도구

Usage:
    python -m app.cli crawl          # 뉴스 크롤링
    python -m app.cli sentiment      # 감성 분석
    python -m app.cli sync-market    # 마켓 데이터 동기화
    python -m app.cli cleanup        # 데이터 정리
    python -m app.cli all            # 모든 작업 실행
"""
import sys
import logging
from datetime import datetime

# 로깅 설정
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
log = logging.getLogger(__name__)


def crawl_news():
    """뉴스 크롤링 실행"""
    log.info("=" * 60)
    log.info("Manual Task: News Crawling")
    log.info("=" * 60)

    from app.services.crawler_service import crawl_all_news

    start_time = datetime.now()
    results = crawl_all_news()
    elapsed = (datetime.now() - start_time).total_seconds()

    log.info("=" * 60)
    log.info(f"Completed in {elapsed:.2f} seconds")
    log.info(f"Results: {results}")
    log.info("=" * 60)
    return results


def analyze_sentiment():
    """감성 분석 실행"""
    log.info("=" * 60)
    log.info("Manual Task: Sentiment Analysis")
    log.info("=" * 60)

    from app.services.crawler_service import analyze_recent_news_sentiment

    start_time = datetime.now()
    count = analyze_recent_news_sentiment()
    elapsed = (datetime.now() - start_time).total_seconds()

    log.info("=" * 60)
    log.info(f"Completed in {elapsed:.2f} seconds")
    log.info(f"Updated {count} articles")
    log.info("=" * 60)
    return count


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


def run_all():
    """모든 작업 순차 실행"""
    log.info("=" * 60)
    log.info("Running All Tasks")
    log.info("=" * 60)

    start_time = datetime.now()

    log.info("\n[1/4] Crawling news...")
    crawl_results = crawl_news()

    log.info("\n[2/4] Analyzing sentiment...")
    sentiment_count = analyze_sentiment()

    log.info("\n[3/4] Syncing market data...")
    sync_results = sync_market_data()

    log.info("\n[4/4] Cleaning up old data...")
    cleanup_count = daily_cleanup()

    elapsed = (datetime.now() - start_time).total_seconds()

    log.info("\n" + "=" * 60)
    log.info("All Tasks Completed")
    log.info(f"Total time: {elapsed:.2f} seconds")
    log.info("=" * 60)

    return {
        'crawl': crawl_results,
        'sentiment': sentiment_count,
        'sync': sync_results,
        'cleanup': cleanup_count
    }


def print_usage():
    """사용법 출력"""
    print("""
MarketPulse CLI - Manual Task Execution

Usage:
    python -m app.cli <command>

Commands:
    crawl         크롤링 작업 실행 (뉴스 수집)
    sentiment     감성 분석 작업 실행
    sync-market   마켓 데이터 동기화 실행
    cleanup       오래된 데이터 정리 실행
    all           모든 작업 순차 실행
    help          이 도움말 출력

Examples:
    python -m app.cli crawl
    python -m app.cli sentiment
    python -m app.cli all
    """)


def main():
    """CLI 진입점"""
    if len(sys.argv) < 2:
        print("Error: Command required")
        print_usage()
        sys.exit(1)

    command = sys.argv[1].lower()

    commands = {
        'crawl': crawl_news,
        'sentiment': analyze_sentiment,
        'sync-market': sync_market_data,
        'cleanup': daily_cleanup,
        'all': run_all,
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

"""
MarketPulse CLI - Manual Task Execution
스케줄 작업을 수동으로 실행하기 위한 CLI 도구

Usage:
    python -m app.cli sync-market    # 마켓 데이터 동기화
    python -m app.cli cleanup        # 데이터 정리

Note:
    뉴스 크롤링과 감성 분석은 Stream 기반 아키텍처로 전환되었습니다.
    app.worker.py (백그라운드 워커)를 통해 자동으로 실행됩니다.
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


def sync_market_data():
    """마켓 데이터 동기화 실행"""
    log.info("=" * 60)
    log.info("Manual Task: Market Data Sync")
    log.info("=" * 60)

    from app.services.market_data_sync import

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

Available Commands:
    sync-market   마켓 데이터 동기화 실행
    cleanup       오래된 데이터 정리 실행
    help          이 도움말 출력

Examples:
    python -m app.cli sync-market
    python -m app.cli cleanup

Note:
    뉴스 크롤링과 감성 분석은 Stream 기반 아키텍처로 전환되었습니다.
    백그라운드 워커(python -m app.main)를 통해 자동으로 실행됩니다.
    """)


def main():
    """CLI 진입점"""
    if len(sys.argv) < 2:
        print("Error: Command required")
        print_usage()
        sys.exit(1)

    command = sys.argv[1].lower()

    commands = {
        'sync-market': sync_market_data,
        'cleanup': daily_cleanup,
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
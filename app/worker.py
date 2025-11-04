"""
Python Background Worker - Hybrid Mode
1. APScheduler: 자동 스케줄링
2. Redis Queue Consumer: Spring Boot 트리거 작업
"""
import logging
import signal
import sys
import threading
from app.scheduler import start_scheduler, stop_scheduler
from app.queue_consumer import start_queue_consumer, get_redis_client
from app.core.config import settings

# 로깅 설정
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(settings.LOG_FILE),
        logging.StreamHandler(sys.stdout)
    ]
)
log = logging.getLogger(__name__)

# Global threads
queue_thread = None


def signal_handler(signum, frame):
    """Graceful shutdown"""
    log.info("Received shutdown signal. Stopping worker...")
    stop_scheduler()
    # Queue consumer는 daemon thread라 자동 종료됨
    sys.exit(0)


def main():
    """백그라운드 워커 시작 (하이브리드 모드)"""
    global queue_thread

    log.info("=" * 80)
    log.info("MarketPulse Background Worker Starting (Hybrid Mode)")
    log.info(f"Database: {settings.db_url}")
    log.info(f"APScheduler: {'Enabled' if settings.SCHEDULER_ENABLED else 'Disabled'}")
    log.info(f"Redis Queue: {'Enabled' if settings.QUEUE_ENABLED and settings.REDIS_URL else 'Disabled'}")
    log.info("=" * 80)

    # 시그널 핸들러 등록 (Ctrl+C 처리)
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)

    try:
        # 1. APScheduler 시작 (자동 스케줄링)
        if settings.SCHEDULER_ENABLED:
            start_scheduler()
        else:
            log.warning("APScheduler is disabled")

        # 2. Redis Queue Consumer 시작 (별도 스레드)
        if settings.QUEUE_ENABLED and settings.REDIS_URL:
            redis_client = get_redis_client()
            if redis_client:
                log.info("Starting Redis Queue Consumer in background thread...")
                queue_thread = threading.Thread(
                    target=start_queue_consumer,
                    daemon=True,  # 메인 스레드 종료 시 자동 종료
                    name="QueueConsumer"
                )
                queue_thread.start()
                log.info("Redis Queue Consumer started")
            else:
                log.warning("Redis Queue Consumer not started (connection failed)")
        else:
            if not settings.QUEUE_ENABLED:
                log.info("Redis Queue Consumer disabled in settings")
            if not settings.REDIS_URL:
                log.info("Redis URL not configured")

        log.info("\n" + "=" * 80)
        log.info("Background Worker is running...")
        log.info("  - APScheduler: Auto-scheduling tasks")
        if queue_thread and queue_thread.is_alive():
            log.info("  - Redis Queue: Listening for Spring Boot triggers")
        log.info("Press Ctrl+C to stop")
        log.info("=" * 80 + "\n")

        # 메인 스레드를 계속 실행
        try:
            signal.pause()  # Unix/Linux
        except AttributeError:
            # Windows에서는 signal.pause()가 없음
            import time
            while True:
                time.sleep(1)

    except KeyboardInterrupt:
        signal_handler(None, None)
    except Exception as e:
        log.error(f"Failed to start worker: {e}", exc_info=True)
        sys.exit(1)


if __name__ == "__main__":
    main()
"""
Python Background Worker - Automatic Pipeline Chain Architecture
D1: Systemd / Docker Daemon (항상 실행 유지)
D2: Orchestrator (APScheduler + Stream Consumer)

파이프라인: Crawler → Stream → PROC → CALC → RCMD (자동 체인 실행)
"""
import signal
import sys
import threading

from .scheduler import start_scheduler, stop_scheduler
from .redis_bus import create_redis_event_bus, RedisEventBus
from .command_handler import CommandHandler
from .consumer import start_analyzer_consumer
from ..services.crawl_service import crawl_with_stream
from ..config.settings import settings
from ..utils.logging import configure_logging, get_logger

configure_logging(log_file=settings.LOG_FILE)
log = get_logger(__name__)

# Global threads and state management
command_thread = None
analyzer_thread = None
event_bus = None
shutdown_event = threading.Event()


def signal_handler(signum, frame):
    """Graceful shutdown with proper cleanup"""
    log.info(f"Received shutdown signal ({signum}). Stopping worker...")
    shutdown_event.set()
    stop_scheduler()

    if event_bus:
        try:
            event_bus.stop_queue_listener()
            event_bus.stop_stream_consumer()
            log.info("Event Bus listeners stopped")
        except Exception as e:
            log.error(f"Error stopping event bus: {e}")

    threads_to_wait = []
    if command_thread and command_thread.is_alive():
        threads_to_wait.append(('CommandListener', command_thread))
    if analyzer_thread and analyzer_thread.is_alive():
        threads_to_wait.append(('AnalyzerConsumer', analyzer_thread))

    for thread_name, thread in threads_to_wait:
        try:
            thread.join(timeout=10)
            if thread.is_alive():
                log.warning(f"{thread_name} did not stop within timeout")
            else:
                log.info(f"{thread_name} stopped")
        except Exception as e:
            log.error(f"Error stopping {thread_name}: {e}")

    log.info("=" * 80)
    log.info("Worker stopped gracefully")
    log.info("=" * 80)
    sys.exit(0)


def start_command_listener(event_bus: RedisEventBus):
    """D3: Redis Listener — Spring에서 보낸 명령 처리"""
    handler = CommandHandler(event_bus)
    log.info("[CommandListener] Starting...")
    event_bus.listen_command_queue(
        queue_name=settings.REDIS_QUEUE_NAME,
        callback=handler.handle_command,
        timeout=5
    )


def run_crawler(event_bus: RedisEventBus = None) -> int:
    """크롤러 수동 실행"""
    try:
        log.info("=" * 80)
        log.info("Starting manual crawler execution...")
        log.info("=" * 80)

        if not event_bus:
            log.error("Redis Event Bus not available - cannot publish to stream")
            return 0

        article_count = crawl_with_stream(event_bus)
        log.info(f"Manual crawler completed: {article_count} articles published")
        return article_count

    except Exception as e:
        log.error(f"Failed to run crawler: {e}", exc_info=True)
        return 0


def main():
    """백그라운드 워커 시작 (Stream-based Architecture)"""
    global command_thread, analyzer_thread, event_bus

    log.info("=" * 80)
    log.info("MarketPulse Background Worker Starting (Stream Architecture)")
    log.info(f"Database: {settings.DATABASE_URL or settings.SQLITE_PATH}")
    log.info(f"APScheduler: {'Enabled' if settings.SCHEDULER_ENABLED else 'Disabled'}")
    log.info(f"Redis Queue: {'Enabled' if settings.QUEUE_ENABLED and settings.REDIS_URL else 'Disabled'}")
    log.info("=" * 80)

    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)

    try:
        if settings.REDIS_URL:
            event_bus = create_redis_event_bus(settings.REDIS_URL)

            if not event_bus:
                log.error("Failed to create Redis Event Bus. Exiting...")
                sys.exit(1)

            log.info("Redis Event Bus initialized successfully")

            log.info("[Thread 1] Starting Analyzer Consumer...")
            analyzer_thread = threading.Thread(
                target=start_analyzer_consumer,
                args=(event_bus,),
                daemon=True,
                name="AnalyzerConsumer"
            )
            analyzer_thread.start()
            log.info("[Thread 1] Analyzer Consumer started")

            if settings.QUEUE_ENABLED:
                log.info("[Thread 2] Starting Command Listener...")
                command_thread = threading.Thread(
                    target=start_command_listener,
                    args=(event_bus,),
                    daemon=True,
                    name="CommandListener"
                )
                command_thread.start()
                log.info("[Thread 2] Command Listener started")
            else:
                log.info("Command Listener disabled in settings")

        else:
            log.warning("Redis URL not configured. Redis-based features disabled.")

        if settings.SCHEDULER_ENABLED:
            start_scheduler(event_bus=event_bus)
        else:
            log.warning("APScheduler is disabled")

        if event_bus:
            log.info("INITIAL CRAWL - Running pipeline on startup")
            import time
            time.sleep(2)
            initial_count = run_crawler(event_bus)
            log.info(f"INITIAL CRAWL COMPLETED: {initial_count} articles sent to pipeline")
        else:
            log.warning("Skipping initial crawl (Redis not available)")

        log.info("Background Worker is running (Automatic Pipeline Chain)")
        log.info("Press Ctrl+C to stop")

        try:
            signal.pause()
        except AttributeError:
            import time
            while True:
                time.sleep(60)
                if not (command_thread and command_thread.is_alive()) and \
                   not (analyzer_thread and analyzer_thread.is_alive()):
                    log.warning("All threads stopped. Exiting...")
                    break

    except KeyboardInterrupt:
        signal_handler(None, None)
    except Exception as e:
        log.error(f"Failed to start worker: {e}", exc_info=True)
        sys.exit(1)


if __name__ == "__main__":
    main()

"""
Python Background Worker - Stream-based Architecture
D1: Systemd / Docker Daemon (항상 실행 유지)
D2: Orchestrator (APScheduler + Listener)

구조:
- Main Thread: APScheduler (자동 스케줄링)
- Thread 1: Command Listener (Spring → Python 명령 수신)
- Thread 2: Analyzer Consumer (Crawler → Analyzer 파이프라인)
"""
import logging
import signal
import sys
import threading
from app.scheduler import start_scheduler, stop_scheduler
from app.redis_bus import create_redis_event_bus, RedisEventBus
from app.command_handler import CommandHandler
from app.analyzer_consumer import start_analyzer_consumer
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
command_thread = None
analyzer_thread = None
event_bus = None


def signal_handler(signum, frame):
    """Graceful shutdown"""
    log.info("Received shutdown signal. Stopping worker...")

    # APScheduler 중지
    stop_scheduler()

    # Event Bus 리스너 중지
    if event_bus:
        event_bus.stop_queue_listener()
        event_bus.stop_stream_consumer()

    # Thread들이 종료될 때까지 대기 (최대 5초)
    if command_thread and command_thread.is_alive():
        log.info("Waiting for Command Listener to stop...")
        command_thread.join(timeout=5)

    if analyzer_thread and analyzer_thread.is_alive():
        log.info("Waiting for Analyzer Consumer to stop...")
        analyzer_thread.join(timeout=5)

    log.info("Worker stopped gracefully")
    sys.exit(0)


def start_command_listener(event_bus: RedisEventBus):
    """
    D3: Redis Listener (명령 수신)
    Spring에서 보낸 명령 처리
    """
    handler = CommandHandler(event_bus)

    log.info("[CommandListener] Starting...")

    event_bus.listen_command_queue(
        queue_name=settings.REDIS_QUEUE_NAME,
        callback=handler.handle_command,
        timeout=5
    )


def main():
    """
    백그라운드 워커 시작 (Stream-based Architecture)

    구조:
    1. APScheduler: 자동 스케줄링 (매 1시간, 2시간 등)
    2. Command Listener: Spring → Python 명령 수신
    3. Analyzer Consumer: Stream 기반 분석 파이프라인
    """
    global command_thread, analyzer_thread, event_bus

    log.info("=" * 80)
    log.info("MarketPulse Background Worker Starting (Stream Architecture)")
    log.info(f"Database: {settings.DATABASE_URL or settings.SQLITE_PATH}")
    log.info(f"APScheduler: {'Enabled' if settings.SCHEDULER_ENABLED else 'Disabled'}")
    log.info(f"Redis Queue: {'Enabled' if settings.QUEUE_ENABLED and settings.REDIS_URL else 'Disabled'}")
    log.info("=" * 80)

    # 시그널 핸들러 등록 (Ctrl+C 처리)
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)

    try:
        # ===================================================================
        # 1. APScheduler 시작 (자동 스케줄링)
        # ===================================================================
        if settings.SCHEDULER_ENABLED:
            start_scheduler()
        else:
            log.warning("APScheduler is disabled")

        # ===================================================================
        # 2. Redis Event Bus 초기화
        # ===================================================================
        if settings.REDIS_URL:
            event_bus = create_redis_event_bus(settings.REDIS_URL)

            if not event_bus:
                log.error("Failed to create Redis Event Bus. Exiting...")
                sys.exit(1)

            log.info("\n" + "=" * 80)
            log.info("Redis Event Bus initialized successfully")
            log.info("=" * 80)

            # ===================================================================
            # 3. Command Listener 시작 (Thread 1)
            # D3: Redis Listener (Spring → Python 명령)
            # ===================================================================
            if settings.QUEUE_ENABLED:
                log.info("\n[Thread 1] Starting Command Listener...")
                command_thread = threading.Thread(
                    target=start_command_listener,
                    args=(event_bus,),
                    daemon=True,
                    name="CommandListener"
                )
                command_thread.start()
                log.info("[Thread 1] Command Listener started")
            else:
                log.info("Command Listener disabled in settings")

            # ===================================================================
            # 4. Analyzer Consumer 시작 (Thread 2)
            # D5: Analyzer Module (Stream 구독)
            # ===================================================================
            log.info("\n[Thread 2] Starting Analyzer Consumer...")
            analyzer_thread = threading.Thread(
                target=start_analyzer_consumer,
                args=(event_bus,),
                daemon=True,
                name="AnalyzerConsumer"
            )
            analyzer_thread.start()
            log.info("[Thread 2] Analyzer Consumer started")

        else:
            log.warning("Redis URL not configured. Redis-based features disabled.")

        # ===================================================================
        # Status Summary
        # ===================================================================
        log.info("\n" + "=" * 80)
        log.info("Background Worker is running...")
        log.info("  - APScheduler: Auto-scheduling tasks")

        if command_thread and command_thread.is_alive():
            log.info(f"  - Command Listener: Listening on '{settings.REDIS_QUEUE_NAME}'")

        if analyzer_thread and analyzer_thread.is_alive():
            log.info("  - Analyzer Consumer: Consuming 'stream:new_articles'")

        log.info("Press Ctrl+C to stop")
        log.info("=" * 80 + "\n")

        # ===================================================================
        # Keep main thread alive
        # ===================================================================
        try:
            signal.pause()  # Unix/Linux
        except AttributeError:
            # Windows에서는 signal.pause()가 없음
            import time
            while True:
                time.sleep(60)  # CPU 사용률 감소를 위해 1초 → 60초로 변경
                # Thread 상태 체크 (선택적 디버깅용)
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

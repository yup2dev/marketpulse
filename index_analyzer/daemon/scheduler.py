"""
APScheduler - 스케줄링 모듈
"""
import logging
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.interval import IntervalTrigger

log = logging.getLogger(__name__)

scheduler = None
event_bus_ref = None


def start_scheduler(event_bus=None):
    """
    APScheduler 시작

    Args:
        event_bus: RedisEventBus 인스턴스
    """
    global scheduler, event_bus_ref
    event_bus_ref = event_bus

    try:
        from index_analyzer.core.config import settings
        from index_analyzer.pipeline.in_module import crawl_with_stream

        scheduler = BackgroundScheduler()

        # 크롤러 작업 등록 (매 1시간)
        scheduler.add_job(
            func=lambda: crawl_with_stream(event_bus_ref) if event_bus_ref else None,
            trigger=IntervalTrigger(hours=settings.CRAWL_INTERVAL_HOURS),
            id='crawler_job',
            name='News Crawler',
            replace_existing=True
        )

        scheduler.start()
        log.info(f"APScheduler started (Crawl interval: {settings.CRAWL_INTERVAL_HOURS}h)")

    except Exception as e:
        log.error(f"Failed to start scheduler: {e}", exc_info=True)


def stop_scheduler():
    """APScheduler 중지"""
    global scheduler

    if scheduler:
        try:
            scheduler.shutdown(wait=False)
            log.info("APScheduler stopped")
        except Exception as e:
            log.error(f"Error stopping scheduler: {e}")

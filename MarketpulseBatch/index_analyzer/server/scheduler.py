"""
APScheduler - 스케줄링 모듈

Job 목록:
  crawler_job        - 뉴스 크롤링 (매 CRAWL_INTERVAL_HOURS 시간) — Redis 이벤트 버스가 필요해 worker 안에서 돈다

적재 배치(universe·시세·환율·13F·동기화)는 여기서 돌리지 않는다 — MarketpulseBatch/run_job.py
(daily 묶음, Windows 작업 스케줄러가 호출)가 종료 코드·lock·로그와 함께 실행한다.
예전에는 universe 수집이 여기서 돌면서 실패를 로그로만 남기고 삼켰다.
"""
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.interval import IntervalTrigger

from marketpulse_common.utils.logging import get_logger

log = get_logger(__name__)

scheduler = None
event_bus_ref = None


# ── 스케줄러 시작/종료 ────────────────────────────────────────────────────────

def start_scheduler(event_bus=None):
    """APScheduler 시작"""
    global scheduler, event_bus_ref
    event_bus_ref = event_bus

    try:
        from ..config.settings import settings
        from ..services.crawl_service import crawl_with_stream

        scheduler = BackgroundScheduler()

        scheduler.add_job(
            func=lambda: crawl_with_stream(event_bus_ref) if event_bus_ref else None,
            trigger=IntervalTrigger(hours=settings.CRAWL_INTERVAL_HOURS),
            id='crawler_job',
            name='News Crawler',
            replace_existing=True,
        )

        scheduler.start()
        log.info(
            f"APScheduler 시작 (뉴스크롤: {settings.CRAWL_INTERVAL_HOURS}h; "
            f"적재 배치는 MarketpulseBatch/run_job.py daily)"
        )

    except Exception as e:
        log.error(f"APScheduler 시작 실패: {e}", exc_info=True)


def stop_scheduler():
    """APScheduler 중지"""
    global scheduler

    if scheduler:
        try:
            scheduler.shutdown(wait=False)
            log.info("APScheduler 중지")
        except Exception as e:
            log.error(f"APScheduler 중지 오류: {e}")

"""
APScheduler - 스케줄링 모듈

Job 목록:
  crawler_job          - 뉴스 크롤링       (매 1시간)
  daily_stock_job      - 주식 가격/시총 갱신 (매 24시간, 오전 6시)
  weekly_relations_job - Peer/경쟁사 갱신   (매주 일요일 오전 2시)
  monthly_collect_job  - S&P 500 전체 수집  (매월 1일 오전 1시)
"""
import logging
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.interval import IntervalTrigger
from apscheduler.triggers.cron import CronTrigger

log = logging.getLogger(__name__)

scheduler = None
event_bus_ref = None


# ── Job 함수들 ────────────────────────────────────────────────────────────────

def _daily_stock_job():
    """일별 주식 가격·시총 갱신 Job"""
    try:
        from index_analyzer.pipeline.stock_collect_module import run_daily_profile_update
        stats = run_daily_profile_update()
        log.info(f"[Scheduler] daily_stock_job 완료: {stats}")
    except Exception as e:
        log.error(f"[Scheduler] daily_stock_job 실패: {e}", exc_info=True)


def _weekly_relations_job():
    """주별 Peer/경쟁사 관계 갱신 Job"""
    try:
        from index_analyzer.pipeline.stock_collect_module import run_weekly_relations_refresh
        stats = run_weekly_relations_refresh()
        log.info(f"[Scheduler] weekly_relations_job 완료: {stats}")
    except Exception as e:
        log.error(f"[Scheduler] weekly_relations_job 실패: {e}", exc_info=True)


def _monthly_collect_job():
    """월별 S&P 500 전체 재수집 Job"""
    try:
        from index_analyzer.pipeline.stock_collect_module import run_sp500_initial_collection
        stats = run_sp500_initial_collection()
        log.info(f"[Scheduler] monthly_collect_job 완료: {stats}")
    except Exception as e:
        log.error(f"[Scheduler] monthly_collect_job 실패: {e}", exc_info=True)


# ── 스케줄러 시작/종료 ────────────────────────────────────────────────────────

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

        # ── 뉴스 크롤러 (매 1시간) ──────────────────────────────────────────
        scheduler.add_job(
            func=lambda: crawl_with_stream(event_bus_ref) if event_bus_ref else None,
            trigger=IntervalTrigger(hours=settings.CRAWL_INTERVAL_HOURS),
            id='crawler_job',
            name='News Crawler',
            replace_existing=True,
        )

        # ── 일별 주식 가격 업데이트 (매일 오전 6시) ─────────────────────────
        scheduler.add_job(
            func=_daily_stock_job,
            trigger=CronTrigger(hour=6, minute=0),
            id='daily_stock_job',
            name='Daily Stock Price Update',
            replace_existing=True,
        )

        # ── 주별 Peer/경쟁사 갱신 (매주 일요일 오전 2시) ─────────────────────
        scheduler.add_job(
            func=_weekly_relations_job,
            trigger=CronTrigger(day_of_week='sun', hour=2, minute=0),
            id='weekly_relations_job',
            name='Weekly Relations Refresh',
            replace_existing=True,
        )

        # ── 월별 S&P 500 전체 수집 (매월 1일 오전 1시) ───────────────────────
        scheduler.add_job(
            func=_monthly_collect_job,
            trigger=CronTrigger(day=1, hour=1, minute=0),
            id='monthly_collect_job',
            name='Monthly S&P 500 Full Collection',
            replace_existing=True,
        )

        scheduler.start()
        log.info(
            f"APScheduler 시작 ("
            f"뉴스크롤: {settings.CRAWL_INTERVAL_HOURS}h, "
            f"주가갱신: daily@06:00, "
            f"관계갱신: weekly@Sun 02:00, "
            f"전체수집: monthly@1st 01:00)"
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

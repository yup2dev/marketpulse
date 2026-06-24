"""
APScheduler - 스케줄링 모듈

Job 목록:
  crawler_job        - 뉴스 크롤링                    (매 1시간)
  universe_kr_job    - KOSPI/KOSDAQ 종목 + ETF + 국고채 (매일 새벽 5시, pykrx)
  universe_us_job    - NYSE/NASDAQ 종목 + ETF(전 venue) (매주 일요일 새벽 4시, NASDAQ Trader)
"""
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.interval import IntervalTrigger
from apscheduler.triggers.cron import CronTrigger

from ..utils.logging import get_logger

log = get_logger(__name__)

scheduler = None
event_bus_ref = None


# ── Job 함수들 ────────────────────────────────────────────────────────────────

def _universe_kr_job():
    """KR 유니버스 수집 Job — 종목(KOSPI/KOSDAQ) + ETF + 국고채"""
    try:
        from ..collectors import KRUniverseCollector, KRETFCollector, KRBondCollector
        summary = [
            KRUniverseCollector().run(),
            KRETFCollector().run(),
            KRBondCollector().run(),
        ]
        log.info(f"[Scheduler] universe_kr_job 완료: {summary}")
    except Exception as e:
        log.error(f"[Scheduler] universe_kr_job 실패: {e}", exc_info=True)


def _universe_us_job():
    """US 유니버스 수집 Job — 종목(NYSE/NASDAQ) + ETF(전 venue)"""
    try:
        from ..collectors import USUniverseCollector, USETFCollector
        summary = [
            USUniverseCollector().run(),
            USETFCollector().run(),
        ]
        log.info(f"[Scheduler] universe_us_job 완료: {summary}")
    except Exception as e:
        log.error(f"[Scheduler] universe_us_job 실패: {e}", exc_info=True)


def _institutional_13f_job():
    """13F 기관 보유 수집 Job — 기관목록(전체) + featured 20 holdings → DB 캐싱.

    13F는 분기 공시라 주 1회로 충분. whalewisdom(=SEC EDGAR)을 데몬에서 직접 호출.
    """
    try:
        from ..collectors import Institutional13FCollector
        summary = Institutional13FCollector().run()
        log.info(f"[Scheduler] institutional_13f_job 완료: {summary}")
    except Exception as e:
        log.error(f"[Scheduler] institutional_13f_job 실패: {e}", exc_info=True)


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

        scheduler.add_job(
            func=_universe_kr_job,
            trigger=CronTrigger(hour=5, minute=0),
            id='universe_kr_job',
            name='KR Universe (KOSPI/KOSDAQ)',
            replace_existing=True,
        )

        scheduler.add_job(
            func=_universe_us_job,
            trigger=CronTrigger(day_of_week='sun', hour=4, minute=0),
            id='universe_us_job',
            name='US Universe (NYSE/NASDAQ)',
            replace_existing=True,
        )

        scheduler.add_job(
            func=_institutional_13f_job,
            trigger=CronTrigger(day_of_week='sun', hour=6, minute=0),
            id='institutional_13f_job',
            name='13F Institutional Holdings',
            replace_existing=True,
        )

        scheduler.start()
        log.info(
            f"APScheduler 시작 ("
            f"뉴스크롤: {settings.CRAWL_INTERVAL_HOURS}h, "
            f"KR유니버스: daily@05:00, "
            f"US유니버스: weekly@Sun 04:00, "
            f"13F: weekly@Sun 06:00)"
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

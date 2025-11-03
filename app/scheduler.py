"""
APScheduler Configuration
자동 스케줄링 작업 설정 및 관리
"""
import logging
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.interval import IntervalTrigger
from apscheduler.triggers.cron import CronTrigger
from apscheduler.events import EVENT_JOB_EXECUTED, EVENT_JOB_ERROR
from datetime import datetime

from app.core.config import settings

log = logging.getLogger(__name__)

# 전역 스케줄러 인스턴스
_scheduler: BackgroundScheduler = None


def get_scheduler() -> BackgroundScheduler:
    """스케줄러 싱글톤 반환"""
    global _scheduler
    if _scheduler is None:
        _scheduler = BackgroundScheduler(
            timezone='UTC',
            job_defaults={
                'coalesce': True,  # 놓친 작업을 한 번만 실행
                'max_instances': 1,  # 동시 실행 방지
                'misfire_grace_time': 300  # 5분 이내 놓친 작업 실행
            }
        )
        # 이벤트 리스너 등록
        _scheduler.add_listener(job_listener, EVENT_JOB_EXECUTED | EVENT_JOB_ERROR)
    return _scheduler


def job_listener(event):
    """작업 실행 이벤트 리스너"""
    if event.exception:
        log.error(
            f"Job {event.job_id} failed: {event.exception}",
            exc_info=True
        )
    else:
        log.info(f"Job {event.job_id} completed successfully")


def register_jobs(scheduler: BackgroundScheduler):
    """
    스케줄 작업 등록

    작업 목록:
    1. 뉴스 크롤링 (매 N시간)
    2. 감성 분석 (매 N시간)
    3. 마켓 데이터 동기화 (매일 자정)
    """
    log.info("Registering scheduled jobs...")

    # ===== 1. 뉴스 크롤링 =====
    if settings.CRAWL_INTERVAL_HOURS > 0:
        from app.services.crawler_service import crawl_all_news

        scheduler.add_job(
            func=crawl_all_news,
            trigger=IntervalTrigger(hours=settings.CRAWL_INTERVAL_HOURS),
            id='crawl_news',
            name='Crawl Financial News',
            replace_existing=True,
            next_run_time=datetime.utcnow()  # 즉시 한 번 실행
        )
        log.info(f"✓ Registered: News Crawler (every {settings.CRAWL_INTERVAL_HOURS}h)")

    # ===== 2. 감성 분석 =====
    if settings.SENTIMENT_INTERVAL_HOURS > 0:
        from app.services.crawler_service import analyze_recent_news_sentiment

        scheduler.add_job(
            func=analyze_recent_news_sentiment,
            trigger=IntervalTrigger(hours=settings.SENTIMENT_INTERVAL_HOURS),
            id='analyze_sentiment',
            name='Analyze News Sentiment',
            replace_existing=True
        )
        log.info(f"✓ Registered: Sentiment Analyzer (every {settings.SENTIMENT_INTERVAL_HOURS}h)")

    # ===== 3. 마켓 데이터 동기화 =====
    if settings.MARKET_DATA_INTERVAL_HOURS > 0:
        from app.services.market_data_sync import sync_market_data

        scheduler.add_job(
            func=sync_market_data,
            trigger=IntervalTrigger(hours=settings.MARKET_DATA_INTERVAL_HOURS),
            id='sync_market_data',
            name='Sync Market Data',
            replace_existing=True
        )
        log.info(f"✓ Registered: Market Data Sync (every {settings.MARKET_DATA_INTERVAL_HOURS}h)")

    # ===== 4. 일일 클린업 (선택) =====
    # 오래된 뉴스 삭제, 통계 집계 등
    scheduler.add_job(
        func=daily_cleanup,
        trigger=CronTrigger(hour=0, minute=0),  # 매일 자정 UTC
        id='daily_cleanup',
        name='Daily Cleanup Task',
        replace_existing=True
    )
    log.info("✓ Registered: Daily Cleanup (00:00 UTC)")

    log.info(f"All jobs registered. Total: {len(scheduler.get_jobs())} jobs")


def daily_cleanup():
    """
    일일 정리 작업
    - 90일 이상 오래된 뉴스 삭제
    - 임시 파일 정리
    - 통계 로깅
    """
    try:
        log.info("Daily cleanup task started")
        from datetime import timedelta
        from sqlalchemy import func
        from app.models.database import get_sqlite_db, NewsArticle
        from app.core.config import settings

        db_path = settings.SQLITE_PATH
        db = get_sqlite_db(db_path)
        session = db.get_session()

        # 통계 로깅
        total_news = session.query(func.count(NewsArticle.id)).scalar()
        recent_24h = session.query(func.count(NewsArticle.id)).filter(
            NewsArticle.published_at >= datetime.utcnow() - timedelta(hours=24)
        ).scalar()

        log.info(f"Statistics: Total news={total_news}, Last 24h={recent_24h}")

        # 오래된 뉴스 삭제 (90일 이상)
        cutoff_date = datetime.utcnow() - timedelta(days=90)
        deleted = session.query(NewsArticle).filter(
            NewsArticle.published_at < cutoff_date
        ).delete()

        session.commit()
        session.close()

        log.info(f"Daily cleanup completed: {deleted} old articles deleted")
        return deleted

    except Exception as e:
        log.error(f"Daily cleanup failed: {e}", exc_info=True)
        return 0


def start_scheduler():
    """
    스케줄러 시작

    FastAPI 앱 시작 시 호출:
        @app.on_event("startup")
        async def startup_event():
            start_scheduler()
    """
    if not settings.SCHEDULER_ENABLED:
        log.warning("Scheduler is disabled in settings")
        return

    scheduler = get_scheduler()

    if scheduler.running:
        log.warning("Scheduler is already running")
        return

    try:
        # 작업 등록
        register_jobs(scheduler)

        # 스케줄러 시작
        scheduler.start()
        log.info("=" * 80)
        log.info("Scheduler started successfully")
        log.info(f"Active jobs: {len(scheduler.get_jobs())}")
        log.info("=" * 80)

        # 등록된 작업 출력
        for job in scheduler.get_jobs():
            log.info(f"  - {job.name} (ID: {job.id}, Next: {job.next_run_time})")

    except Exception as e:
        log.error(f"Failed to start scheduler: {e}", exc_info=True)
        raise


def stop_scheduler():
    """
    스케줄러 중지

    FastAPI 앱 종료 시 호출:
        @app.on_event("shutdown")
        async def shutdown_event():
            stop_scheduler()
    """
    scheduler = get_scheduler()

    if not scheduler.running:
        log.warning("Scheduler is not running")
        return

    try:
        scheduler.shutdown(wait=True)
        log.info("Scheduler stopped successfully")
    except Exception as e:
        log.error(f"Failed to stop scheduler: {e}", exc_info=True)


def get_scheduler_status() -> dict:
    """
    스케줄러 상태 조회

    Returns:
        {
            "running": bool,
            "jobs": [{"id", "name", "next_run", "trigger"}]
        }
    """
    scheduler = get_scheduler()

    jobs_info = []
    for job in scheduler.get_jobs():
        # 스케줄러가 시작되지 않았을 때 next_run_time이 없을 수 있음
        try:
            next_run = job.next_run_time.isoformat() if hasattr(job, 'next_run_time') and job.next_run_time else None
        except:
            next_run = None

        jobs_info.append({
            "id": job.id,
            "name": job.name,
            "next_run": next_run,
            "trigger": str(job.trigger)
        })

    return {
        "running": scheduler.running,
        "job_count": len(jobs_info),
        "jobs": jobs_info
    }


def trigger_job_now(job_id: str) -> bool:
    """
    작업 즉시 실행

    Args:
        job_id: 작업 ID (예: 'crawl_news', 'analyze_sentiment')

    Returns:
        실행 성공 여부
    """
    scheduler = get_scheduler()

    job = scheduler.get_job(job_id)
    if not job:
        log.error(f"Job not found: {job_id}")
        return False

    try:
        job.modify(next_run_time=datetime.utcnow())
        log.info(f"Job {job_id} scheduled to run immediately")
        return True
    except Exception as e:
        log.error(f"Failed to trigger job {job_id}: {e}")
        return False

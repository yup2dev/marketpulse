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


def register_jobs(scheduler: BackgroundScheduler, event_bus=None):
    """
    스케줄 작업 등록

    MBS 파이프라인 작업 (IN → PROC → CALC → RCMD):
    0. IN 입수 - 뉴스 크롤링 (매 1시간) → Stream으로 발행 → AnalyzerConsumer가 PROC 처리
    1. PROC → CALC 변환 (매 1시간)
    2. CALC → RCMD 생성 (매 2시간)
    3. 마켓 데이터 동기화 (매 6시간)
    4. 일일 클린업 (매일 자정)
    """
    log.info("Registering scheduled jobs...")

    # ===== 0. IN 입수 - 뉴스 크롤링 (Stream 발행) =====
    def scheduled_crawl_news():
        """
        스케줄된 크롤링 작업 (IN 모듈)
        - 뉴스 크롤링 → MBS_IN_ARTICLE 저장 → Stream 발행
        - AnalyzerConsumer가 Stream 구독하여 PROC 처리
        """
        try:
            log.info("[Scheduled Job] crawl_news (IN Module) started")
            from app.services.crawler_service import crawl_with_stream

            if not event_bus:
                log.error("[Scheduled Job] Redis Event Bus not available - cannot publish to stream")
                return 0

            # Stream 기반 크롤링 (IN → Stream → PROC 파이프라인)
            article_count = crawl_with_stream(event_bus)
            log.info(f"[Scheduled Job] crawl_news completed: {article_count} articles published to stream")
            return article_count

        except Exception as e:
            log.error(f"[Scheduled Job] crawl_news failed: {e}", exc_info=True)
            return 0

    scheduler.add_job(
        func=scheduled_crawl_news,
        trigger=IntervalTrigger(hours=1),
        id='crawl_news',
        name='IN - News Crawling',
        replace_existing=True,
        next_run_time=datetime.utcnow()  # 즉시 한 번 실행
    )
    log.info("Registered: IN → News Crawling (every 1h)")
    log.info("  └─ Pipeline chain: Crawler → Stream → PROC → CALC → RCMD (automatic)")

    # ===== PROC, CALC, RCMD는 파이프라인 체인으로 자동 실행됨 =====
    # - Crawler 완료 → Redis Stream 발행
    # - AnalyzerConsumer(PROC) → 각 기사 분석 후 CALC 트리거
    # - CalcProcessor(CALC) → 메트릭 계산 후 RCMD 트리거
    # - RcmdGenerator(RCMD) → 추천 생성
    # 별도 스케줄 등록 불필요!

    # ===== 3. 마켓 데이터 동기화 (옵션) =====
    if hasattr(settings, 'MARKET_DATA_INTERVAL_HOURS') and settings.MARKET_DATA_INTERVAL_HOURS > 0:
        try:
            from app.services.market_data_sync import sync_market_data

            scheduler.add_job(
                func=sync_market_data,
                trigger=IntervalTrigger(hours=settings.MARKET_DATA_INTERVAL_HOURS),
                id='sync_market_data',
                name='Sync Market Data',
                replace_existing=True
            )
            log.info(f"Registered: Market Data Sync (every {settings.MARKET_DATA_INTERVAL_HOURS}h)")
        except ImportError:
            log.warning("Market data sync not available")

    # ===== 4. 매일 S&P 500 종목 업로드 =====
    scheduler.add_job(
        func=daily_sp500_sync,
        trigger=CronTrigger(hour=0, minute=0),  # 매일 자정 UTC
        id='daily_sp500_sync',
        name='Daily S&P 500 Sync',
        replace_existing=True
    )
    log.info("Registered: Daily S&P 500 Sync (00:00 UTC)")

    # ===== 4-1. 매일 가격 데이터 수집 =====
    scheduler.add_job(
        func=daily_price_sync,
        trigger=CronTrigger(hour=21, minute=30),  # 미국 시장 마감 후 (21:30 UTC = 16:30 EST)
        id='daily_price_sync',
        name='Daily Price Data Sync',
        replace_existing=True
    )
    log.info("Registered: Daily Price Sync (21:30 UTC, after US market close)")

    # ===== 5. 일일 클린업 =====
    scheduler.add_job(
        func=daily_cleanup,
        trigger=CronTrigger(hour=0, minute=30),  # 매일 자정 30분 UTC (S&P 500 sync 후)
        id='daily_cleanup',
        name='Daily Cleanup Task',
        replace_existing=True
    )
    log.info("Registered: Daily Cleanup (00:30 UTC)")

    log.info(f"All jobs registered. Total: {len(scheduler.get_jobs())} jobs")


def daily_sp500_sync():
    """
    매일 S&P 500 종목 동기화
    - Wikipedia에서 최신 S&P 500 종목 리스트 가져오기
    - MBS_IN_STBD_MST 마스터 테이블에 저장
    """
    try:
        log.info("Daily S&P 500 sync task started")
        from app.models.database import get_sqlite_db
        from app.services.market_data_sync import MarketDataSync
        from app.core.config import settings

        db_path = settings.SQLITE_PATH
        db = get_sqlite_db(db_path)
        session = db.get_session()

        try:
            # MarketDataSync 서비스 초기화
            sync_service = MarketDataSync(session)

            # S&P 500 종목 동기화 (Wikipedia에서 가져오기)
            log.info("Fetching S&P 500 constituents from Wikipedia...")
            sp500_tickers = sync_service.sync_sp500_from_wikipedia()

            if sp500_tickers:
                from app.models.database import generate_batch_id
                batch_id = generate_batch_id()

                # MBS_IN_STBD_MST에 저장 (enrichment는 하지 않음 - 빠르게 처리)
                count = sync_service.sync_tickers_to_db(
                    sp500_tickers,
                    asset_type='stock',
                    batch_id=batch_id,
                    enrich=False  # 매일 자정 작업이므로 빠르게 처리
                )
                log.info(f"Daily S&P 500 sync completed: {count} stocks synchronized")
                return count
            else:
                log.warning("No S&P 500 data available from Wikipedia")
                return 0

        finally:
            session.close()

    except Exception as e:
        log.error(f"Daily S&P 500 sync failed: {e}", exc_info=True)
        return 0


def daily_price_sync():
    """
    매일 가격 데이터 동기화
    - MBS_IN_STBD_MST 마스터 테이블에서 활성 종목 조회
    - Yahoo Finance API로 가격 데이터 수집
    - 각 IN 테이블에 저장 (STK, ETF, BOND, CMDTY)
    """
    try:
        log.info("Daily price sync task started")
        from app.models.database import get_sqlite_db
        from app.services.market_data_sync import MarketDataSync
        from app.core.config import settings

        db_path = settings.SQLITE_PATH
        db = get_sqlite_db(db_path)
        session = db.get_session()

        try:
            # MarketDataSync 서비스 초기화
            sync_service = MarketDataSync(session)

            # MST 테이블 기반 가격 수집
            log.info("Syncing prices from MBS_IN_STBD_MST...")
            results = sync_service.sync_prices_from_mst()

            log.info(f"Daily price sync completed: {results['total']} prices synchronized")
            return results

        finally:
            session.close()

    except Exception as e:
        log.error(f"Daily price sync failed: {e}", exc_info=True)
        return {'total': 0}


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
        from app.models.database import get_sqlite_db, MBS_IN_ARTICLE
        from app.core.config import settings

        db_path = settings.SQLITE_PATH
        db = get_sqlite_db(db_path)
        session = db.get_session()

        # 통계 로깅
        total_news = session.query(func.count(MBS_IN_ARTICLE.news_id)).scalar()
        recent_24h = session.query(func.count(MBS_IN_ARTICLE.news_id)).filter(
            MBS_IN_ARTICLE.publish_dt >= datetime.utcnow() - timedelta(hours=24)
        ).scalar()

        log.info(f"Statistics: Total news={total_news}, Last 24h={recent_24h}")

        # 오래된 뉴스 삭제 (90일 이상)
        cutoff_date = datetime.utcnow() - timedelta(days=90)
        deleted = session.query(MBS_IN_ARTICLE).filter(
            MBS_IN_ARTICLE.publish_dt < cutoff_date
        ).delete()

        session.commit()
        session.close()

        log.info(f"Daily cleanup completed: {deleted} old articles deleted")
        return deleted

    except Exception as e:
        log.error(f"Daily cleanup failed: {e}", exc_info=True)
        return 0


def start_scheduler(event_bus=None):
    """
    스케줄러 시작

    Args:
        event_bus: RedisEventBus 인스턴스 (크롤링 작업용)

    FastAPI 앱 시작 시 호출:
        @app.on_event("startup")
        async def startup_event():
            start_scheduler(event_bus)
    """
    if not settings.SCHEDULER_ENABLED:
        log.warning("Scheduler is disabled in settings")
        return

    scheduler = get_scheduler()

    if scheduler.running:
        log.warning("Scheduler is already running")
        return

    try:
        # 작업 등록 (event_bus 전달)
        register_jobs(scheduler, event_bus=event_bus)

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

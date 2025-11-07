"""
Command Handler - Spring에서 받은 명령 처리
D3: Redis Listener (명령 수신) 구현
"""
import logging
from typing import Dict, Any
from app.redis_bus import RedisEventBus
from app.core.config import settings

log = logging.getLogger(__name__)


class CommandHandler:
    """Spring 명령 처리 핸들러"""

    def __init__(self, event_bus: RedisEventBus):
        self.event_bus = event_bus

    def handle_command(self, command: Dict[str, Any]):
        """
        명령 처리 및 상태 발행

        Args:
            command: {
                'task_type': str,
                'params': dict
            }
        """
        task_type = command.get('task_type')
        params = command.get('params', {})

        log.info(f"[CommandHandler] Processing: {task_type}")

        # 시작 상태 발행
        self.event_bus.publish_status(
            channel='marketpulse:status',
            status='started',
            task_type=task_type,
            data={'params': params}
        )

        try:
            # 작업 실행
            result = self.execute_task(task_type, params)

            # 완료 상태 발행
            self.event_bus.publish_status(
                channel='marketpulse:status',
                status='completed',
                task_type=task_type,
                data={'result': result}
            )

            log.info(f"[CommandHandler] Completed: {task_type}")

        except Exception as e:
            # 실패 상태 발행
            self.event_bus.publish_status(
                channel='marketpulse:status',
                status='failed',
                task_type=task_type,
                data={'error': str(e)}
            )

            log.error(f"[CommandHandler] Failed: {task_type} - {e}", exc_info=True)

    def execute_task(self, task_type: str, params: Dict[str, Any]) -> Any:
        """작업 실행"""

        if task_type == "crawl_news":
            return self._execute_crawl_news(params)

        elif task_type == "process_to_calc":
            return self._execute_process_to_calc(params)

        elif task_type == "generate_recommendations":
            return self._execute_generate_recommendations(params)

        elif task_type == "sync_market_data":
            return self._execute_market_sync(params)

        elif task_type == "cleanup":
            return self._execute_cleanup(params)

        else:
            raise ValueError(f"Unknown task type: {task_type}")

    def _execute_crawl_news(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """
        뉴스 크롤링 실행
        D4: Crawler Module → Stream 발행
        """
        from app.services.crawler_service import crawl_with_stream

        log.info("[Task] Executing: News Crawling")

        # Stream 기반 크롤링 (Crawler → Analyzer 파이프라인)
        article_count = crawl_with_stream(self.event_bus)

        return {
            "task": "crawl_news",
            "articles_published": article_count,
            "stream": "stream:new_articles"
        }

    def _execute_process_to_calc(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """
        PROC → CALC 변환 실행
        """
        from app.services.calc_processor import scheduled_calc_processing

        log.info("[Task] Executing: PROC to CALC Processing")
        results = scheduled_calc_processing()

        return {
            "task": "process_to_calc",
            "processed": results.get('processed', 0),
            "metrics_created": results.get('metrics_created', 0)
        }

    def _execute_generate_recommendations(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """
        CALC → RCMD 추천 생성 실행
        """
        from app.services.rcmd_generator import scheduled_rcmd_generation

        log.info("[Task] Executing: Recommendation Generation")
        results = scheduled_rcmd_generation()

        return {
            "task": "generate_recommendations",
            "news": results.get('news', 0),
            "stock": results.get('stock', 0),
            "portfolio": results.get('portfolio', 0)
        }

    def _execute_market_sync(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """마켓 데이터 동기화 실행"""
        from app.services.market_data_sync import sync_market_data

        log.info("[Task] Executing: Market Data Sync")
        results = sync_market_data()

        return {
            "task": "sync_market_data",
            "results": results
        }

    def _execute_cleanup(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """데이터 정리 실행"""
        from app.scheduler import daily_cleanup

        log.info("[Task] Executing: Daily Cleanup")
        deleted = daily_cleanup()

        return {
            "task": "cleanup",
            "deleted_count": deleted
        }

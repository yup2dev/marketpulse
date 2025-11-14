"""
Command Handler - Redis Queue에서 Spring 명령 수신 및 처리
"""
import logging
import json

log = logging.getLogger(__name__)


class CommandHandler:
    """Spring에서 보낸 명령 처리"""

    def __init__(self, event_bus):
        """
        Args:
            event_bus: RedisEventBus 인스턴스
        """
        self.event_bus = event_bus

    def handle_command(self, message: dict):
        """
        명령 처리

        Args:
            message: Redis Queue에서 받은 메시지

        Expected format:
            {
                "command": "crawl" | "analyze" | "status",
                "params": {...}
            }
        """
        try:
            command = message.get('command')
            params = message.get('params', {})

            log.info(f"Received command: {command} with params: {params}")

            if command == 'crawl':
                self._handle_crawl(params)
            elif command == 'analyze':
                self._handle_analyze(params)
            elif command == 'status':
                self._handle_status(params)
            else:
                log.warning(f"Unknown command: {command}")

        except Exception as e:
            log.error(f"Error handling command: {e}", exc_info=True)

    def _handle_crawl(self, params: dict):
        """크롤링 명령 처리"""
        try:
            from index_analyzer.pipeline.in_module import crawl_with_stream

            log.info("Starting manual crawl...")
            count = crawl_with_stream(self.event_bus)
            log.info(f"Crawl completed: {count} articles")

            # 상태 발행
            self.event_bus.publish_status({
                'command': 'crawl',
                'status': 'completed',
                'count': count
            })

        except Exception as e:
            log.error(f"Crawl failed: {e}", exc_info=True)
            self.event_bus.publish_status({
                'command': 'crawl',
                'status': 'failed',
                'error': str(e)
            })

    def _handle_analyze(self, params: dict):
        """분석 명령 처리"""
        log.info("Analyze command received (not implemented)")

    def _handle_status(self, params: dict):
        """상태 조회 명령 처리"""
        log.info("Status command received")
        self.event_bus.publish_status({
            'command': 'status',
            'status': 'running',
            'message': 'Worker is running'
        })

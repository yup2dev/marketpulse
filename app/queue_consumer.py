"""
Redis Queue Consumer
Spring Boot에서 발행한 메시지를 구독하여 작업 실행
"""
import json
import logging
import time
from typing import Optional, Dict, Any
import redis
from app.core.config import settings

log = logging.getLogger(__name__)


class RedisQueueConsumer:
    """Redis Queue 구독 및 작업 실행"""

    def __init__(self, redis_client: redis.Redis):
        self.redis = redis_client
        self.running = False

    def start(self):
        """Queue 구독 시작"""
        self.running = True
        log.info("=" * 60)
        log.info("Redis Queue Consumer Started")
        log.info(f"Listening on queue: {settings.REDIS_QUEUE_NAME}")
        log.info("=" * 60)

        while self.running:
            try:
                # BLPOP: Blocking left pop (대기하다가 메시지 오면 처리)
                message = self.redis.blpop(settings.REDIS_QUEUE_NAME, timeout=5)

                if message:
                    queue_name, raw_data = message
                    self.process_message(raw_data)

            except redis.ConnectionError as e:
                log.error(f"Redis connection error: {e}")
                time.sleep(5)  # 5초 대기 후 재연결
            except Exception as e:
                log.error(f"Error in queue consumer: {e}", exc_info=True)
                time.sleep(1)

    def stop(self):
        """Queue 구독 중지"""
        self.running = False
        log.info("Redis Queue Consumer stopped")

    def process_message(self, raw_data: bytes):
        """메시지 처리"""
        try:
            # JSON 파싱
            data = json.loads(raw_data.decode('utf-8'))
            task_type = data.get('task_type')
            params = data.get('params', {})

            log.info(f"Received task: {task_type} with params: {params}")

            # 작업 타입에 따라 실행
            result = self.execute_task(task_type, params)

            log.info(f"Task {task_type} completed: {result}")

        except json.JSONDecodeError as e:
            log.error(f"Invalid JSON message: {e}")
        except Exception as e:
            log.error(f"Error processing message: {e}", exc_info=True)

    def execute_task(self, task_type: str, params: Dict[str, Any]) -> Any:
        """작업 실행"""

        if task_type == "crawl_news":
            return self._execute_crawl_news(params)

        elif task_type == "analyze_sentiment":
            return self._execute_sentiment_analysis(params)

        elif task_type == "sync_market_data":
            return self._execute_market_sync(params)

        elif task_type == "cleanup":
            return self._execute_cleanup(params)

        else:
            log.warning(f"Unknown task type: {task_type}")
            return {"error": f"Unknown task: {task_type}"}

    def _execute_crawl_news(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """뉴스 크롤링 실행"""
        from app.services.crawler_service import crawl_all_news

        log.info("Executing: News Crawling")
        results = crawl_all_news()
        return {"task": "crawl_news", "results": results}

    def _execute_sentiment_analysis(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """감성 분석 실행"""
        from app.services.crawler_service import analyze_recent_news_sentiment

        log.info("Executing: Sentiment Analysis")
        count = analyze_recent_news_sentiment()
        return {"task": "analyze_sentiment", "updated_count": count}

    def _execute_market_sync(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """마켓 데이터 동기화 실행"""
        from app.services.market_data_sync import sync_market_data

        log.info("Executing: Market Data Sync")
        results = sync_market_data()
        return {"task": "sync_market_data", "results": results}

    def _execute_cleanup(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """데이터 정리 실행"""
        from app.scheduler import daily_cleanup

        log.info("Executing: Daily Cleanup")
        deleted = daily_cleanup()
        return {"task": "cleanup", "deleted_count": deleted}


def get_redis_client() -> Optional[redis.Redis]:
    """Redis 클라이언트 생성"""
    if not settings.REDIS_URL:
        log.warning("REDIS_URL not configured. Queue consumer disabled.")
        return None

    try:
        client = redis.from_url(
            settings.REDIS_URL,
            decode_responses=False,  # bytes로 받기
            socket_timeout=5,
            socket_connect_timeout=5
        )

        # 연결 테스트
        client.ping()
        log.info(f"Redis connected: {settings.REDIS_URL}")
        return client

    except redis.ConnectionError as e:
        log.error(f"Failed to connect to Redis: {e}")
        return None
    except Exception as e:
        log.error(f"Redis client error: {e}")
        return None


def start_queue_consumer():
    """
    Queue Consumer 시작

    Worker에서 호출:
        from app.queue_consumer import start_queue_consumer
        thread = Thread(target=start_queue_consumer, daemon=True)
        thread.start()
    """
    redis_client = get_redis_client()

    if not redis_client:
        log.warning("Queue consumer not started (Redis not available)")
        return

    consumer = RedisQueueConsumer(redis_client)
    consumer.start()  # Blocking call

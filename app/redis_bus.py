"""
Redis Event Bus - 통합 메시징 시스템
Queue, Stream, Pub/Sub 패턴 통합 관리

Flowchart 매핑:
- R1: queue:manual_command (Spring → Python)
- R2: stream:new_task (Crawler → Analyzer)
- R3: pub:status_update (Python → Spring)
"""
import json
import logging
import time
from typing import Optional, Dict, Any, Callable, List, Tuple
from datetime import datetime
import redis

log = logging.getLogger(__name__)


class RedisEventBus:
    """통합 Redis 이벤트 버스"""

    def __init__(self, redis_client: redis.Redis):
        self.redis = redis_client
        self.running = False

    # ===================================================================
    # R1: Queue Pattern (Spring → Python 명령)
    # ===================================================================

    def listen_command_queue(
        self,
        queue_name: str,
        callback: Callable[[Dict], Any],
        timeout: int = 5
    ):
        """
        명령 Queue 구독 (BLPOP)

        Args:
            queue_name: Queue 이름 (예: 'marketpulse:commands')
            callback: 메시지 처리 함수
            timeout: BLPOP 타임아웃 (초)
        """
        self.running = True
        log.info(f"[Queue] Listening on: {queue_name}")

        while self.running:
            try:
                message = self.redis.blpop(queue_name, timeout=timeout)

                if message:
                    queue, raw_data = message
                    data = json.loads(raw_data.decode('utf-8'))

                    log.info(f"[Queue] Received: {data.get('task_type')}")
                    callback(data)

            except redis.ConnectionError as e:
                log.error(f"[Queue] Connection error: {e}")
                time.sleep(5)
            except json.JSONDecodeError as e:
                log.error(f"[Queue] Invalid JSON: {e}")
            except Exception as e:
                log.error(f"[Queue] Error: {e}", exc_info=True)
                time.sleep(1)

    def send_command(self, queue_name: str, command: Dict[str, Any]) -> bool:
        """
        명령 Queue에 메시지 발행 (RPUSH)

        Args:
            queue_name: Queue 이름
            command: 명령 딕셔너리

        Returns:
            성공 여부
        """
        try:
            self.redis.rpush(queue_name, json.dumps(command))
            log.debug(f"[Queue] Sent command: {command.get('task_type')}")
            return True
        except Exception as e:
            log.error(f"[Queue] Failed to send command: {e}")
            return False

    def stop_queue_listener(self):
        """Queue 리스너 중지"""
        self.running = False
        log.info("[Queue] Listener stopped")

    # ===================================================================
    # R2: Stream Pattern (Crawler → Analyzer 파이프라인)
    # ===================================================================

    def publish_to_stream(
        self,
        stream_name: str,
        data: Dict[str, Any],
        maxlen: int = 10000
    ) -> Optional[str]:
        """
        Stream에 메시지 발행 (XADD)

        Args:
            stream_name: Stream 이름 (예: 'stream:new_articles')
            data: 발행할 데이터
            maxlen: 최대 길이 (오래된 메시지 자동 삭제)

        Returns:
            메시지 ID (예: '1234567890-0')
        """
        try:
            # 모든 값을 문자열로 변환
            str_data = {k: str(v) for k, v in data.items()}

            msg_id = self.redis.xadd(
                stream_name,
                str_data,
                maxlen=maxlen,
                approximate=True  # 성능 최적화
            )

            log.debug(f"[Stream] Published to {stream_name}: {msg_id}")
            return msg_id.decode('utf-8') if isinstance(msg_id, bytes) else msg_id

        except Exception as e:
            log.error(f"[Stream] Failed to publish: {e}")
            return None

    def consume_stream(
        self,
        stream_name: str,
        consumer_group: str,
        consumer_name: str,
        callback: Callable[[Dict], None],
        count: int = 10,
        block: int = 5000
    ):
        """
        Stream 구독 및 처리 (Consumer Group)

        Args:
            stream_name: Stream 이름
            consumer_group: Consumer Group 이름
            consumer_name: Consumer 이름
            callback: 메시지 처리 함수
            count: 한 번에 읽을 메시지 수
            block: 대기 시간 (밀리초)
        """
        self.running = True

        # Consumer Group 생성 (이미 존재하면 무시)
        try:
            self.redis.xgroup_create(
                stream_name,
                consumer_group,
                id='0',
                mkstream=True
            )
            log.info(f"[Stream] Created consumer group: {consumer_group}")
        except redis.ResponseError as e:
            if "BUSYGROUP" not in str(e):
                log.error(f"[Stream] Error creating group: {e}")

        log.info(f"[Stream] Consuming {stream_name} as {consumer_name} in {consumer_group}")

        while self.running:
            try:
                # XREADGROUP으로 메시지 읽기
                messages = self.redis.xreadgroup(
                    consumer_group,
                    consumer_name,
                    {stream_name: '>'},  # '>'는 아직 전달되지 않은 메시지
                    count=count,
                    block=block
                )

                if not messages:
                    continue

                for stream, msg_list in messages:
                    for msg_id, data in msg_list:
                        try:
                            # bytes to str 변환
                            decoded_data = {
                                k.decode('utf-8') if isinstance(k, bytes) else k:
                                v.decode('utf-8') if isinstance(v, bytes) else v
                                for k, v in data.items()
                            }

                            msg_id_str = msg_id.decode('utf-8') if isinstance(msg_id, bytes) else msg_id

                            log.debug(f"[Stream] Processing message: {msg_id_str}")

                            # 메시지 처리
                            callback(decoded_data)

                            # ACK (처리 완료 확인)
                            self.redis.xack(stream_name, consumer_group, msg_id)

                        except Exception as e:
                            log.error(f"[Stream] Error processing message {msg_id}: {e}", exc_info=True)
                            # 실패한 메시지는 ACK하지 않음 (재처리 가능)

            except redis.ConnectionError as e:
                log.error(f"[Stream] Connection error: {e}")
                time.sleep(5)
            except Exception as e:
                log.error(f"[Stream] Error: {e}", exc_info=True)
                time.sleep(1)

    def stop_stream_consumer(self):
        """Stream Consumer 중지"""
        self.running = False
        log.info("[Stream] Consumer stopped")

    # ===================================================================
    # R3: Pub/Sub Pattern (Python → Spring 상태 전송)
    # ===================================================================

    def publish_status(
        self,
        channel: str,
        status: str,
        task_type: Optional[str] = None,
        data: Optional[Dict] = None
    ) -> bool:
        """
        상태 업데이트 발행 (PUBLISH)

        Args:
            channel: 채널 이름 (예: 'marketpulse:status')
            status: 상태 (started, progress, completed, failed)
            task_type: 작업 유형
            data: 추가 데이터

        Returns:
            성공 여부
        """
        try:
            message = {
                'status': status,
                'task_type': task_type,
                'timestamp': datetime.utcnow().isoformat(),
                'data': data or {}
            }

            # Pub/Sub 채널로 발행
            subscribers = self.redis.publish(channel, json.dumps(message))

            log.debug(f"[Pub/Sub] Published status '{status}' to {subscribers} subscribers")

            # 영속적 저장 (선택적)
            if task_type:
                self.redis.hset(
                    f'task:status:{task_type}',
                    mapping={
                        'status': status,
                        'timestamp': message['timestamp'],
                        'data': json.dumps(data or {})
                    }
                )
                self.redis.expire(f'task:status:{task_type}', 3600)  # 1시간 TTL

            return True

        except Exception as e:
            log.error(f"[Pub/Sub] Failed to publish status: {e}")
            return False

    def subscribe_status(
        self,
        channel: str,
        callback: Callable[[Dict], None]
    ):
        """
        상태 채널 구독 (SUBSCRIBE)

        Args:
            channel: 채널 이름
            callback: 메시지 처리 함수
        """
        try:
            pubsub = self.redis.pubsub()
            pubsub.subscribe(channel)

            log.info(f"[Pub/Sub] Subscribed to: {channel}")

            for message in pubsub.listen():
                if message['type'] == 'message':
                    try:
                        data = json.loads(message['data'])
                        callback(data)
                    except json.JSONDecodeError as e:
                        log.error(f"[Pub/Sub] Invalid JSON: {e}")
                    except Exception as e:
                        log.error(f"[Pub/Sub] Error in callback: {e}", exc_info=True)

        except redis.ConnectionError as e:
            log.error(f"[Pub/Sub] Connection error: {e}")
        except Exception as e:
            log.error(f"[Pub/Sub] Error: {e}", exc_info=True)

    # ===================================================================
    # Utility Methods
    # ===================================================================

    def get_task_status(self, task_type: str) -> Optional[Dict]:
        """
        작업 상태 조회

        Args:
            task_type: 작업 유형

        Returns:
            상태 딕셔너리
        """
        try:
            status_data = self.redis.hgetall(f'task:status:{task_type}')
            if not status_data:
                return None

            return {
                k.decode('utf-8') if isinstance(k, bytes) else k:
                v.decode('utf-8') if isinstance(v, bytes) else v
                for k, v in status_data.items()
            }
        except Exception as e:
            log.error(f"Error getting task status: {e}")
            return None

    def get_stream_info(self, stream_name: str) -> Optional[Dict]:
        """
        Stream 정보 조회

        Args:
            stream_name: Stream 이름

        Returns:
            Stream 정보
        """
        try:
            info = self.redis.xinfo_stream(stream_name)
            return {
                k.decode('utf-8') if isinstance(k, bytes) else k: v
                for k, v in info.items()
            }
        except redis.ResponseError:
            return None
        except Exception as e:
            log.error(f"Error getting stream info: {e}")
            return None

    def get_pending_messages(
        self,
        stream_name: str,
        consumer_group: str
    ) -> List[Tuple]:
        """
        미처리 메시지 조회

        Args:
            stream_name: Stream 이름
            consumer_group: Consumer Group

        Returns:
            미처리 메시지 리스트
        """
        try:
            pending = self.redis.xpending(stream_name, consumer_group)
            return pending
        except Exception as e:
            log.error(f"Error getting pending messages: {e}")
            return []


def create_redis_event_bus(redis_url: str, max_connections: int = 50) -> Optional[RedisEventBus]:
    """
    RedisEventBus 인스턴스 생성 (Connection Pooling 적용)

    Args:
        redis_url: Redis 연결 URL
        max_connections: Connection Pool 최대 연결 수

    Returns:
        RedisEventBus 인스턴스
    """
    try:
        # Connection Pool 생성 (재사용 가능한 연결 관리)
        pool = redis.ConnectionPool.from_url(
            redis_url,
            max_connections=max_connections,
            socket_timeout=5,
            socket_connect_timeout=5,
            socket_keepalive=True,
            socket_keepalive_options={
                1: 1,  # TCP_KEEPIDLE (Linux)
                2: 1,  # TCP_KEEPINTVL (Linux)
                3: 3   # TCP_KEEPCNT (Linux)
            },
            decode_responses=False,  # bytes로 받기 (수동 디코딩)
            retry_on_timeout=True,
            health_check_interval=30  # 30초마다 연결 상태 체크
        )

        # Redis 클라이언트 생성 (Pool 사용)
        redis_client = redis.Redis(connection_pool=pool)

        # 연결 테스트
        redis_client.ping()
        log.info(f"Redis Event Bus connected with connection pool (max={max_connections}): {redis_url}")

        return RedisEventBus(redis_client)

    except redis.ConnectionError as e:
        log.error(f"Failed to connect to Redis: {e}")
        return None
    except Exception as e:
        log.error(f"Redis Event Bus error: {e}")
        return None

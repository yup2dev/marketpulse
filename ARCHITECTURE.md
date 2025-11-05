# MarketPulse Stream Architecture

## 시스템 플로우

```
┌─────────────────────────────────────────────────────────────────────┐
│                  🧑‍💻 Spring API / Portal (Control Layer)              │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐      │
│  │  사용자   │ →  │   REST   │ →  │  Redis   │    │  Redis   │      │
│  │  요청    │    │Controller│    │Publisher │    │Subscriber│      │
│  └──────────┘    └──────────┘    └──────────┘    └──────────┘      │
└──────────────────────────┼───────────┼──────────────┼────────────────┘
                           │           │              │
                           │           │              │
                           ▼           ▼              ▲
┌─────────────────────────────────────────────────────────────────────┐
│                         🔁 Redis (Message / Event Bus)              │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ R1: queue:manual_command  (Spring → Python 명령 전송)       │   │
│  │ R2: stream:new_articles   (Crawler → Analyzer 파이프라인)   │   │
│  │ R3: pub:status_update     (Python → Spring 상태 전송)       │   │
│  └─────────────────────────────────────────────────────────────┘   │
└──────────────────────────┼───────────┼──────────────┼────────────────┘
                           │           │              │
                           ▼           ▼              ▲
┌─────────────────────────────────────────────────────────────────────┐
│                  🐍 Python Service (Daemon Layer)                   │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ D1: Systemd / Docker Daemon (항상 실행 유지)                 │  │
│  │     └─ D2: Orchestrator (APScheduler + Listener)            │  │
│  │          ├─ Main Thread: APScheduler (자동 스케줄링)         │  │
│  │          ├─ Thread 1: Command Listener (명령 수신)           │  │
│  │          └─ Thread 2: Analyzer Consumer (분석 파이프라인)    │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐            │
│  │ D4: Crawler  │ → │ D5: Analyzer │ → │ D6: DB Writer│            │
│  │   Module     │   │    Module    │   │              │            │
│  └──────────────┘   └──────────────┘   └──────────────┘            │
│                                              │                       │
│  ┌──────────────────────────────────────────┘                       │
│  │ D7: Redis Publisher (상태/결과 전송)                             │
│  └─────────────────────────────────────────────────────────────────┘
└──────────────────────────┼──────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│                  🗄️ Database (Persistent Layer)                     │
│                     PostgreSQL / SQLite                              │
└─────────────────────────────────────────────────────────────────────┘
```

## 컴포넌트 상세

### 1. Redis Event Bus (메시지 허브)

**파일:** `app/redis_bus.py`

3가지 메시징 패턴 통합:

#### R1: Queue Pattern (Spring → Python 명령)
```python
# Spring → Python
redis.rpush('marketpulse:commands', {
    'task_type': 'crawl_news',
    'params': {}
})

# Python이 BLPOP으로 대기하다가 처리
```

**용도:** Spring에서 수동 트리거 (예: "지금 크롤링" 버튼)

#### R2: Stream Pattern (Crawler → Analyzer 파이프라인)
```python
# Crawler가 발행
redis.xadd('stream:new_articles', {
    'article_id': '123',
    'url': 'https://...'
})

# Analyzer Consumer Group이 구독
redis.xreadgroup('analyzer-group', 'consumer-1', ...)
```

**장점:**
- Crawler와 Analyzer 분리 (느슨한 결합)
- 여러 Analyzer Worker 병렬 처리 가능
- 메시지 재처리 (ACK 실패 시)

#### R3: Pub/Sub Pattern (Python → Spring 상태)
```python
# Python이 발행
redis.publish('marketpulse:status', {
    'status': 'completed',
    'task_type': 'crawl_news',
    'data': {...}
})

# Spring이 구독 (실시간 상태 업데이트)
```

**용도:** 실시간 진행률, 완료/실패 알림

---

### 2. Command Handler (D3: Redis Listener)

**파일:** `app/command_handler.py`

Spring 명령을 받아 처리:

```python
def handle_command(command):
    task_type = command['task_type']

    # 시작 상태 발행
    publish_status('started', task_type)

    try:
        result = execute_task(task_type)
        publish_status('completed', task_type, result)
    except Exception as e:
        publish_status('failed', task_type, error)
```

---

### 3. Crawler Module (D4)

**파일:** `app/services/crawler_service.py`

#### 기존 방식 (동기식)
```python
def crawl_all_news():
    # 크롤링 + 분석을 한번에 처리
    for article in crawl():
        analyze_and_save(article)
```

#### 새 방식 (Stream 기반)
```python
def crawl_with_stream(event_bus):
    for article in crawl():
        # 1. 기본 정보만 DB 저장
        article_id = save_basic_info(article)

        # 2. Stream에 발행 (Analyzer가 처리)
        event_bus.publish_to_stream('stream:new_articles', {
            'article_id': article_id
        })
```

**장점:**
- 크롤링 속도 향상 (분석 대기 불필요)
- 크롤링과 분석 독립적 확장

---

### 4. Analyzer Consumer (D5, D6)

**파일:** `app/analyzer_consumer.py`

Stream에서 기사를 받아 분석:

```python
class AnalyzerConsumer:
    def process_article(self, message):
        article_id = message['article_id']

        # DB에서 article 조회
        article = db.query(NewsArticle).get(article_id)

        # 감성 분석 & 티커 추출
        sentiment = sentiment_analyzer.analyze(article.text)
        tickers = ticker_extractor.extract(article.text)

        # DB 업데이트 (D6: DB Writer)
        article.sentiment_score = sentiment['score']
        article.save_tickers(tickers)
        db.commit()
```

**Consumer Group 사용:**
- 여러 Analyzer Worker 병렬 처리 가능
- 메시지 중복 처리 방지
- 실패 시 재처리

---

### 5. Orchestrator (D2)

**파일:** `app/worker.py`

3개의 실행 스레드 관리:

```python
# Main Thread: APScheduler
scheduler.add_job(crawl_all_news, 'interval', hours=1)

# Thread 1: Command Listener
Thread(target=listen_commands).start()

# Thread 2: Analyzer Consumer
Thread(target=consume_stream).start()
```

---

## 데이터 플로우

### 자동 크롤링 (APScheduler)
```
1. APScheduler → crawl_all_news() (매 1시간)
2. Crawler → Redis Stream ('stream:new_articles')
3. Analyzer Consumer → 감성 분석 + 티커 추출
4. DB Writer → PostgreSQL/SQLite
```

### 수동 크롤링 (Spring 트리거)
```
1. Spring → Redis Queue ('marketpulse:commands')
2. Command Handler → crawl_with_stream()
3. Crawler → Redis Stream
4. Analyzer Consumer → 분석
5. Python → Redis Pub/Sub ('marketpulse:status')
6. Spring → 상태 수신 → WebSocket → 프론트엔드
```

---

## 실행 방법

### 1. Redis 시작
```bash
# Docker
docker run -d -p 6379:6379 redis:7-alpine

# 또는 로컬
redis-server
```

### 2. 환경 변수 설정
```bash
# .env
REDIS_URL=redis://localhost:6379/0
REDIS_QUEUE_NAME=marketpulse:commands
REDIS_STATUS_CHANNEL=marketpulse:status
SCHEDULER_ENABLED=true
QUEUE_ENABLED=true
```

### 3. Worker 실행
```bash
python -m app.main
```

**예상 출력:**
```
================================================================================
MarketPulse Background Worker Starting (Stream Architecture)
Database: sqlite:///data/marketpulse.db
APScheduler: Enabled
Redis Queue: Enabled
================================================================================

[Thread 1] Starting Command Listener...
[Thread 1] Command Listener started

[Thread 2] Starting Analyzer Consumer...
[Thread 2] Analyzer Consumer started

================================================================================
Background Worker is running...
  - APScheduler: Auto-scheduling tasks
  - Command Listener: Listening on 'marketpulse:commands'
  - Analyzer Consumer: Consuming 'stream:new_articles'
Press Ctrl+C to stop
================================================================================
```

### 4. 수동 명령 발송 (Redis CLI)
```bash
# Spring 대신 Redis CLI로 테스트
redis-cli RPUSH marketpulse:commands '{"task_type":"crawl_news","params":{}}'

# 로그 확인
tail -f logs/app.log
```

---

## 모니터링

### Redis Stream 확인
```bash
# Stream 길이 확인
redis-cli XLEN stream:new_articles

# Consumer Group 정보
redis-cli XINFO GROUPS stream:new_articles

# 미처리 메시지 확인
redis-cli XPENDING stream:new_articles analyzer-group
```

### 상태 구독 (Spring 시뮬레이션)
```bash
redis-cli SUBSCRIBE marketpulse:status
```

---

## 확장 가능성

### 여러 Analyzer Worker 병렬 실행
```bash
# Worker 1
python -m app.main

# Worker 2 (다른 터미널)
python -m app.main
```

**자동 분산 처리:**
- Redis Consumer Group이 메시지를 자동 분배
- 각 Worker가 다른 기사 처리
- 처리량 2배 증가

### Kubernetes 배포
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: marketpulse-worker
spec:
  replicas: 3  # 3개의 Worker 실행
  template:
    spec:
      containers:
      - name: worker
        image: marketpulse-python:latest
        command: ["python", "-m", "app.main"]
```

---

## 기존 아키텍처와의 차이

| 항목 | 기존 (Threading) | 새 아키텍처 (Stream) |
|------|------------------|---------------------|
| Crawler-Analyzer 연결 | 직접 함수 호출 | Redis Stream |
| 확장성 | 단일 프로세스 제한 | 여러 Worker 가능 |
| 실패 처리 | 재시도 없음 | Stream ACK 기반 재처리 |
| Spring 상태 전송 | 없음 | Pub/Sub 실시간 전송 |
| 모니터링 | 로그만 | Redis 명령어로 확인 가능 |

---

## 다음 단계

### 우선순위 1: Spring Boot 연동
- RedisTemplate으로 명령 발행
- MessageListener로 상태 구독
- WebSocket으로 프론트엔드에 전달

### 우선순위 2: 모니터링
- Grafana + Prometheus
- Redis Stream 메트릭
- Worker 상태 대시보드

### 우선순위 3: 프로덕션 배포
- Systemd Service 설정
- Docker Compose 통합
- Kubernetes Deployment

---

## 참고 문서

- [Redis Streams 공식 문서](https://redis.io/docs/data-types/streams/)
- [APScheduler 문서](https://apscheduler.readthedocs.io/)
- [Python Threading](https://docs.python.org/3/library/threading.html)

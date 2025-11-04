
📨 Message Queue 사용 가이드

## 아키텍처

```
┌─────────────────────────┐
│  Spring Boot API        │
│  (추후 구현)            │
└────┬────────────────────┘
     │
     │ RPUSH message
     ▼
┌─────────────────────────┐
│  Redis Queue            │
│  Queue: marketpulse:tasks│
└────┬────────────────────┘
     │
     │ BLPOP (blocking)
     ▼
┌─────────────────────────┐
│  Python Worker          │
│  • APScheduler          │
│  • Queue Consumer       │
└─────────────────────────┘
```

---

## 메시지 포맷

### 크롤링 트리거

```json
{
  "task_type": "crawl_news",
  "params": {
    "source": "yahoo",
    "max_articles": 20
  }
}
```

### 감성 분석 트리거

```json
{
  "task_type": "analyze_sentiment",
  "params": {
    "article_ids": [1, 2, 3, 4, 5]
  }
}
```

### 마켓 데이터 동기화

```json
{
  "task_type": "sync_market_data",
  "params": {
    "enrich": false
  }
}
```

### 데이터 정리

```json
{
  "task_type": "cleanup",
  "params": {
    "days": 90
  }
}
```

---

## Spring Boot에서 메시지 발행

### 1. Redis 의존성 추가 (pom.xml)

```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-data-redis</artifactId>
</dependency>
```

### 2. Redis 설정 (application.yml)

```yaml
spring:
  data:
    redis:
      host: localhost
      port: 6379
      password: ${REDIS_PASSWORD}  # 선택적
```

### 3. Message Publisher 구현

```java
package com.marketpulse.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.Map;

@Service
public class PythonTaskPublisher {

    private final RedisTemplate<String, String> redisTemplate;
    private final ObjectMapper objectMapper;
    private static final String QUEUE_NAME = "marketpulse:tasks";

    public PythonTaskPublisher(
            RedisTemplate<String, String> redisTemplate,
            ObjectMapper objectMapper) {
        this.redisTemplate = redisTemplate;
        this.objectMapper = objectMapper;
    }

    /**
     * 뉴스 크롤링 트리거
     */
    public void triggerCrawlNews() {
        Map<String, Object> message = new HashMap<>();
        message.put("task_type", "crawl_news");
        message.put("params", new HashMap<String, Object>() {{
            put("source", "all");
        }});

        publishMessage(message);
    }

    /**
     * 감성 분석 트리거
     */
    public void triggerSentimentAnalysis() {
        Map<String, Object> message = new HashMap<>();
        message.put("task_type", "analyze_sentiment");
        message.put("params", new HashMap<>());

        publishMessage(message);
    }

    /**
     * 마켓 데이터 동기화 트리거
     */
    public void triggerMarketDataSync() {
        Map<String, Object> message = new HashMap<>();
        message.put("task_type", "sync_market_data");
        message.put("params", new HashMap<String, Object>() {{
            put("enrich", false);
        }});

        publishMessage(message);
    }

    /**
     * Redis Queue에 메시지 발행
     */
    private void publishMessage(Map<String, Object> message) {
        try {
            String json = objectMapper.writeValueAsString(message);
            redisTemplate.opsForList().rightPush(QUEUE_NAME, json);
            System.out.println("Published message: " + json);
        } catch (Exception e) {
            throw new RuntimeException("Failed to publish message", e);
        }
    }
}
```

### 4. REST Controller 예시

```java
package com.marketpulse.controller;

import com.marketpulse.service.PythonTaskPublisher;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/admin/tasks")
public class TaskController {

    private final PythonTaskPublisher taskPublisher;

    public TaskController(PythonTaskPublisher taskPublisher) {
        this.taskPublisher = taskPublisher;
    }

    /**
     * 뉴스 크롤링 즉시 실행
     */
    @PostMapping("/crawl")
    public String triggerCrawl() {
        taskPublisher.triggerCrawlNews();
        return "Crawl task triggered";
    }

    /**
     * 감성 분석 즉시 실행
     */
    @PostMapping("/sentiment")
    public String triggerSentiment() {
        taskPublisher.triggerSentimentAnalysis();
        return "Sentiment analysis task triggered";
    }

    /**
     * 마켓 데이터 동기화 즉시 실행
     */
    @PostMapping("/sync-market")
    public String triggerMarketSync() {
        taskPublisher.triggerMarketDataSync();
        return "Market data sync task triggered";
    }
}
```

---

## Python에서 테스트

### Redis CLI로 메시지 발행

```bash
# Redis에 접속
redis-cli

# 크롤링 작업 발행
RPUSH marketpulse:tasks '{"task_type": "crawl_news", "params": {}}'

# 감성 분석 작업 발행
RPUSH marketpulse:tasks '{"task_type": "analyze_sentiment", "params": {}}'
```

### Python 스크립트로 테스트

```python
# test_queue.py
import redis
import json

# Redis 연결
r = redis.Redis(host='localhost', port=6379, db=0)

# 크롤링 작업 발행
message = {
    "task_type": "crawl_news",
    "params": {}
}
r.rpush("marketpulse:tasks", json.dumps(message))
print("Message sent!")

# Queue 길이 확인
queue_length = r.llen("marketpulse:tasks")
print(f"Queue length: {queue_length}")
```

---

## 설정

### Python Worker (.env)

```bash
# Redis 활성화
REDIS_URL=redis://localhost:6379/0

# Queue Consumer 활성화
QUEUE_ENABLED=true
REDIS_QUEUE_NAME=marketpulse:tasks
```

### Docker Compose (docker-compose.yml)

```yaml
services:
  redis:
    image: redis:7-alpine
    container_name: marketpulse-redis
    ports:
      - "6379:6379"
    command: redis-server
    volumes:
      - redis_data:/data
    restart: unless-stopped

  python-worker:
    build: .
    environment:
      REDIS_URL: redis://redis:6379/0
      QUEUE_ENABLED: "true"
      REDIS_QUEUE_NAME: marketpulse:tasks
    depends_on:
      - redis

volumes:
  redis_data:
```

---

## 실행 및 테스트

### 1. Redis 시작

```bash
# Docker로 실행
docker run -d -p 6379:6379 redis:7-alpine

# 또는 로컬에 설치된 Redis 실행
redis-server
```

### 2. Python Worker 시작

```bash
# .env에서 Redis 설정 활성화
REDIS_URL=redis://localhost:6379/0
QUEUE_ENABLED=true

# Worker 실행
python -m app.main
```

**로그 예시:**
```
MarketPulse Background Worker Starting (Hybrid Mode)
APScheduler: Enabled
Redis Queue: Enabled
================================================================================
Starting Redis Queue Consumer in background thread...
Redis connected: redis://localhost:6379/0
Redis Queue Consumer started
Background Worker is running...
  - APScheduler: Auto-scheduling tasks
  - Redis Queue: Listening for Spring Boot triggers
```

### 3. 메시지 발행 테스트

```bash
# Redis CLI로 테스트
redis-cli RPUSH marketpulse:tasks '{"task_type": "crawl_news", "params": {}}'

# Python Worker 로그 확인
# Received task: crawl_news with params: {}
# Executing: News Crawling
# Task crawl_news completed: {...}
```

---

## 동작 모드

### Mode 1: APScheduler Only (기본)
```bash
QUEUE_ENABLED=false
```

- APScheduler만 실행 (자동 스케줄링)
- Redis 불필요

### Mode 2: Hybrid Mode (권장)
```bash
QUEUE_ENABLED=true
REDIS_URL=redis://localhost:6379/0
```

- APScheduler: 자동 스케줄링
- Redis Queue: Spring Boot 트리거 작업
- 양쪽 모두 동시 실행

### Mode 3: Queue Only
```bash
SCHEDULER_ENABLED=false
QUEUE_ENABLED=true
```

- Redis Queue만 실행
- Spring Boot에서만 작업 트리거

---

## 장점

✅ **비동기 처리**: Spring Boot와 Python이 독립적으로 동작
✅ **확장 가능**: Worker를 여러 개 실행 가능
✅ **신뢰성**: Redis가 메시지 큐 역할 (재시도 가능)
✅ **유연성**: 자동 스케줄링 + 수동 트리거 병행 가능

---

## 모니터링

### Queue 길이 확인

```bash
redis-cli LLEN marketpulse:tasks
```

### Queue 내용 확인 (삭제 없이)

```bash
redis-cli LRANGE marketpulse:tasks 0 -1
```

### Queue 비우기

```bash
redis-cli DEL marketpulse:tasks
```

---

## Troubleshooting

### Worker가 메시지를 받지 못함

1. Redis 연결 확인
   ```bash
   redis-cli ping
   # 응답: PONG
   ```

2. Queue 이름 확인
   ```python
   # Python
   print(settings.REDIS_QUEUE_NAME)

   # Spring Boot
   System.out.println(QUEUE_NAME);
   ```

3. Worker 로그 확인
   ```bash
   tail -f logs/app.log | grep "Redis Queue"
   ```

### Redis 연결 실패

```bash
# .env 확인
cat .env | grep REDIS_URL

# Redis 실행 확인
redis-cli ping
```

---

**현재 상태**: Message Queue 구현 완료! 🎉

**다음 단계**: Spring Boot API 구현 시 위 가이드대로 메시지 발행하면 됩니다.

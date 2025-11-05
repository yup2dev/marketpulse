    # MarketPulse - AI-Powered Financial Intelligence Platform

실시간 금융 뉴스 분석과 포트폴리오 최적화를 제공하는 마이크로서비스 플랫폼

[![Spring Boot](https://img.shields.io/badge/Spring%20Boot-3.2-green.svg)](https://spring.io/projects/spring-boot)
[![Python 3.9+](https://img.shields.io/badge/python-3.9+-blue.svg)](https://www.python.org/downloads/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-blue.svg)](https://www.postgresql.org/)
[![APScheduler](https://img.shields.io/badge/APScheduler-3.10-orange.svg)](https://apscheduler.readthedocs.io/)

---

## 📋 목차

- [시스템 아키텍처](#-시스템-아키텍처)
- [주요 기능](#-주요-기능)
- [기술 스택](#-기술-스택)
- [빠른 시작](#-빠른-시작)
- [프로젝트 구조](#-프로젝트-구조)
- [API 문서](#-api-문서)
- [배포 가이드](#-배포-가이드)
- [개발 로드맵](#-개발-로드맵)

---

## 🏗️ 시스템 아키텍처

### Python 데이터 파이프라인 (하이브리드 모드)


``` 시스템 플로우
flowchart LR
 subgraph subGraph0["🧑‍💻 Spring API / Portal (Control Layer)"]
        S1["사용자 요청<br>수동 트리거 or 상태조회"]
        S2["REST Controller / Service"]
        S3["Redis Publisher<br>(RPush / Pub)"]
        S4["Redis Subscriber<br>(결과/상태 구독)"]
  end
 subgraph subGraph1["🐍 Python Service (Daemon Layer)"]
        D1["Systemd / Docker Daemon<br>항상 실행 유지"]
        D2["Orchestrator (APScheduler + Listener)"]
        D3["Redis Listener<br>(명령 수신)"]
        D4["Crawler Module<br>(신규 기사 감시)"]
        D5["Analyzer Module<br>(분석 수행)"]
        D6["DB Writer<br>(결과 저장)"]
        D7["Redis Publisher<br>(상태/결과 전송)"]
  end
 subgraph subGraph2["🔁 Redis (Message / Event Bus)"]
        R1["queue:manual_command<br>(Spring→Python)"]
        R2["stream:new_task<br>(Crawler→Analyzer)"]
        R3["pub:status_update<br>(Python→Spring)"]
  end
 subgraph subGraph3["🗄️ Database (Persistent Layer)"]
        DB1[("Timescale / PostgreSQL")]
  end
    S1 --> S2
    S2 --> S3
    S4 --> S2
    D1 --> D2
    D2 --> D3 & D4
    D4 -- 신규기사 감지 --> D5
    D5 --> D6 & D7
    S3 -- 명령 푸시 --> R1
    D3 -- 명령 구독 --> R1
    D4 -- 신규 기사 이벤트 --> R2
    D5 -- 결과 저장 --> DB1
    D7 -- 상태 발행 --> R3
    R3 -- 구독 --> S4
```


### 데이터 플로우

```
1. 자동 데이터 수집 (Python APScheduler)
   외부 API → APScheduler 크롤러 → PostgreSQL
   (매 1시간 자동 실행)

2. 수동 데이터 수집 (Spring Boot 트리거)
   사용자 요청 → Spring Boot → Redis Queue → Python Worker → PostgreSQL
   ("지금 크롤링" 버튼 클릭 시)

3. 데이터 처리 (Python)
   PostgreSQL → 감성분석/티커추출 → PostgreSQL

4. API 제공 (Spring Boot - 추후 구현)
   Frontend → Spring API → PostgreSQL → JSON 응답

5. 포트폴리오 관리 (Spring Boot - 추후 구현)
   User 요청 → Spring Service → 계산 → PostgreSQL
```

---

## ✨ 주요 기능

### ☕ Spring Boot (메인 API 서버)

#### 1. REST API
- **사용자 관리**: 회원가입, 로그인, 프로필
- **포트폴리오 API**: CRUD, 성과 조회, 리밸런싱
- **뉴스 API**: 뉴스 조회, 필터링, 검색
- **알림 API**: WebSocket 실시간 알림

#### 2. 포트폴리오 관리
- **자산 배분**: 현대 포트폴리오 이론 (MPT)
- **리스크 분석**: VaR, Sharpe Ratio, Beta 계산
- **백테스팅**: 전략 시뮬레이션
- **리밸런싱**: 자동/수동 비율 조정

#### 3. 인증/권한
- **JWT 토큰**: Access/Refresh 토큰
- **Spring Security**: 역할 기반 접근 제어 (RBAC)
- **OAuth2**: 소셜 로그인 (Google, GitHub)

#### 4. 캐싱 전략
- **Spring Boot API** (추후 구현): API 응답, 뉴스 데이터, 가격 데이터
- **캐시 무효화**: 실시간 데이터 업데이트 시

### 🐍 Python (데이터 파이프라인)

#### 1. 데이터 수집
- **뉴스 크롤러**: Bloomberg, Reuters, BBC, CNBC
- **가격 데이터**: Yahoo Finance, Alpha Vantage
- **소셜 데이터**: Twitter API (선택)
- **스케줄링**: APScheduler (자동) + Redis Queue (수동 트리거)

#### 2. ML/NLP 분석
- **감성 분석**: FinBERT (transformers)
- **키워드 추출**: TF-IDF, RAKE
- **엔티티 인식**: spaCy NER
- **토픽 모델링**: LDA

#### 3. 기술적 지표
- **트렌드**: SMA, EMA, MACD
- **모멘텀**: RSI, Stochastic
- **변동성**: Bollinger Bands, ATR

#### 4. Vector DB (Phase 2)
- **임베딩**: Sentence-BERT
- **유사도 검색**: Qdrant
- **RAG**: 뉴스 기반 질의응답

---

## 🛠️ 기술 스택

### Backend

| 서비스 | 기술 | 버전 | 역할 |
|--------|------|------|------|
| **Main API** | Spring Boot | 3.2+ | REST API, 비즈니스 로직 (추후 구현) |
| **Web Framework** | Spring WebFlux | 6.1+ | 리액티브 웹 (추후 구현) |
| **Security** | Spring Security | 6.2+ | 인증/권한, JWT (추후 구현) |
| **Data Access** | Spring Data JPA | 3.2+ | ORM, Repository (추후 구현) |
| **Validation** | Bean Validation | 3.0+ | 입력 검증 (추후 구현) |
| **Monitoring** | Spring Actuator | 3.2+ | 헬스체크, 메트릭 (추후 구현) |
| | | | |
| **Data Pipeline** | Python | 3.9+ | 크롤링, ML |
| **Scheduler** | APScheduler | 3.10+ | 자동 스케줄링 |
| **Message Queue** | Redis | 7+ | Spring ↔ Python 통신 |
| **ML/NLP** | transformers | 4.35+ | FinBERT |
| **Data Science** | pandas, numpy | latest | 데이터 처리 |
| | | | |
| **Database** | PostgreSQL | 15+ | 메인 데이터 저장소 |
| **DB (Dev)** | SQLite | 3+ | 개발용 로컬 DB |
| **Reverse Proxy** | Nginx | 1.24+ | SSL, 로드밸런싱 (추후) |
| **Container** | Docker | 24+ | 서비스 격리 (추후) |

### Phase 2 추가 예정
- **Message Queue**: Kafka (이벤트 스트리밍)
- **Vector DB**: Qdrant (유사도 검색)
- **Search**: Elasticsearch (전문 검색)
- **Monitoring**: Prometheus + Grafana

---

## 🚀 빠른 시작

### 요구사항

- Docker 24+
- Docker Compose 2.20+
- Java 17+ (로컬 개발용)
- Python 3.9+ (로컬 개발용)
- 8GB RAM 이상

### 1. 저장소 클론

```bash
git clone https://github.com/yourusername/marketpulse.git
cd marketpulse
```

### 2. 환경 변수 설정

```bash
cp .env.example .env
```

**`.env` 파일:**

```bash
# PostgreSQL
POSTGRES_DB=marketpulse
POSTGRES_USER=marketpulse
POSTGRES_PASSWORD=your_strong_password

# Redis (Message Queue)
REDIS_URL=redis://localhost:6379/0
# 비밀번호 있는 경우
# REDIS_URL=redis://:your_password@localhost:6379/0

# Spring Boot
JWT_SECRET=your_jwt_secret_key_minimum_32_characters
JWT_EXPIRATION=3600000

# Python Worker
QUEUE_ENABLED=true
REDIS_QUEUE_NAME=marketpulse:tasks
SCHEDULER_ENABLED=true
CRAWL_INTERVAL_HOURS=1
SENTIMENT_INTERVAL_HOURS=2

# Python API Keys
YAHOO_FINANCE_API_KEY=your_key
ALPHA_VANTAGE_API_KEY=your_key
OPENAI_API_KEY=your_key
```

### 3. 빠른 시작 테스트

```bash
# 시스템 검증
python scripts/quick_test.py
```

**예상 출력:**
```
================================================================================
MarketPulse Quick System Test
================================================================================

1. Testing imports...
✅ All modules imported successfully

2. Checking configuration...
✅ Configuration loaded

3. Testing database...
✅ Database ready: data\marketpulse.db

4. Testing crawler service...
✅ Crawler service ready (4 sites configured)

5. Testing Redis (optional)...
⚠️  Redis not configured (Worker will use APScheduler only)

✅ System Check Complete!
```

### 4. 개발 환경 실행

#### Option A: APScheduler Only (권장 - Redis 없이)

```bash
# Worker 실행
python -m app.main
```

**동작:**
- APScheduler만 실행 (자동 스케줄링)
- 뉴스 크롤링 즉시 1회 실행 후 매 1시간마다 자동 실행
- Redis 불필요 (가장 간단)

**로그 예시:**
```
================================================================================
MarketPulse Background Worker Starting (Stream Architecture)
Database: sqlite:///./data/marketpulse.db
APScheduler: Enabled
Redis Queue: Disabled
================================================================================

Scheduler started successfully
Active jobs: 4

Background Worker is running...
  - APScheduler: Auto-scheduling tasks
Press Ctrl+C to stop
```

#### Option B: Stream Architecture (Redis 포함 - 완전한 기능)

```bash
# 1. Redis 시작
docker run -d -p 6379:6379 redis:7-alpine
# 또는
redis-server

# 2. .env 설정
REDIS_URL=redis://localhost:6379/0
SCHEDULER_ENABLED=true
QUEUE_ENABLED=true

# 3. Worker 실행
python -m app.main
```

**동작:**
- Main Thread: APScheduler (자동 스케줄링)
- Thread 1: Command Listener (Spring → Python 명령 수신)
- Thread 2: Analyzer Consumer (Stream 기반 분석 파이프라인)

**로그 예시:**
```
================================================================================
MarketPulse Background Worker Starting (Stream Architecture)
================================================================================

Redis Event Bus initialized successfully

[Thread 1] Starting Command Listener...
[Thread 1] Command Listener started

[Thread 2] Starting Analyzer Consumer...
[Thread 2] Analyzer Consumer started

Background Worker is running...
  - APScheduler: Auto-scheduling tasks
  - Command Listener: Listening on 'marketpulse:commands'
  - Analyzer Consumer: Consuming 'stream:new_articles'
Press Ctrl+C to stop
```

#### 수동 실행 (CLI)

```bash
# 개별 작업 실행
python -m app.cli crawl          # 뉴스 크롤링만 실행
python -m app.cli sentiment      # 감성 분석만 실행
python -m app.cli sync-market    # 마켓 데이터 동기화만 실행
python -m app.cli cleanup        # 오래된 데이터 정리만 실행

# 모든 작업 순차 실행
python -m app.cli all

# 도움말
python -m app.cli help
```

#### Spring Boot에서 트리거 (Redis 사용 시)

```bash
# Redis CLI로 명령 발행
redis-cli RPUSH marketpulse:commands '{"task_type": "crawl_news", "params": {}}'

# Python Worker 로그:
# [CommandHandler] Processing: crawl_news
# [Pub/Sub] Published status 'started' to 0 subscribers
# [Stream Crawler] Starting news crawl
# [Pub/Sub] Published status 'completed'
```

**Spring Boot 연동 예시 (Java):**
```java
// 명령 발행
@Service
public class PythonCommandService {
    @Autowired
    private StringRedisTemplate redisTemplate;

    public void triggerCrawl() {
        Map<String, Object> command = Map.of(
            "task_type", "crawl_news",
            "params", Map.of()
        );

        redisTemplate.opsForList().rightPush(
            "marketpulse:commands",
            new ObjectMapper().writeValueAsString(command)
        );
    }
}

// 상태 구독
@Service
public class StatusSubscriber {
    public void onMessage(String message) {
        // Python에서 보낸 상태 메시지 처리
        log.info("Received status: " + message);
    }
}
```

**중지:**
- `Ctrl+C` 또는 `SIGTERM` 시그널

---

### 4. 프로덕션 환경 (Docker Compose - 추후)

```bash
# 모든 서비스 빌드 및 시작
docker-compose up -d --build

# 로그 확인
docker-compose logs -f python-worker

# 특정 서비스만 재시작
docker-compose restart python-worker
```

### 5. 데이터베이스 초기화

데이터베이스는 자동으로 생성됩니다:
- SQLite: `./data/marketpulse.db` (개발용, 자동 생성)
- PostgreSQL: `.env`에서 `DATABASE_URL` 설정 시 사용

```bash
# 마켓 데이터 로드 (선택)
python scripts/load_market_data.py
```

### 6. 시스템 검증

```bash
# 데이터베이스 확인
ls -lh data/marketpulse.db

# 로그 확인
tail -f logs/app.log

# 뉴스 수집 확인 (SQLite)
sqlite3 data/marketpulse.db "SELECT COUNT(*) FROM news_articles;"
```

### 7. API 문서 (추후 Spring Boot 구현)

현재는 백그라운드 워커만 실행되며 API는 제공되지 않습니다.

**추후 제공 예정:**
- **Spring Boot Swagger**: http://localhost:8080/swagger-ui.html
- **Spring Boot API**: http://localhost:8080/api/*

---

## 🐳 Docker Compose 구성

**`docker-compose.yml`:**

```yaml
version: '3.8'

services:
  # ==================== Infrastructure ====================

  postgres:
    image: postgres:15-alpine
    container_name: marketpulse-postgres
    ports:
      - "5432:5432"
    environment:
      POSTGRES_DB: ${POSTGRES_DB}
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./scripts/init.sql:/docker-entrypoint-initdb.d/init.sql
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER}"]
      interval: 10s
      timeout: 5s
      retries: 5
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    container_name: marketpulse-redis
    ports:
      - "6379:6379"
    command: redis-server
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5
    restart: unless-stopped

  # ==================== Main API ====================

  spring-boot:
    build:
      context: ./spring-boot
      dockerfile: Dockerfile
    container_name: marketpulse-api
    ports:
      - "8080:8080"
    environment:
      # Database
      SPRING_DATASOURCE_URL: jdbc:postgresql://postgres:5432/${POSTGRES_DB}
      SPRING_DATASOURCE_USERNAME: ${POSTGRES_USER}
      SPRING_DATASOURCE_PASSWORD: ${POSTGRES_PASSWORD}

      # JWT
      JWT_SECRET: ${JWT_SECRET}
      JWT_EXPIRATION: ${JWT_EXPIRATION}

      # JVM Options
      JAVA_OPTS: -Xmx2g -Xms512m
    depends_on:
      postgres:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8080/actuator/health"]
      interval: 30s
      timeout: 10s
      retries: 3
    mem_limit: 2g
    restart: unless-stopped

  # ==================== Python Data Pipeline ====================

  python-worker:
    build:
      context: .
      dockerfile: Dockerfile.python
    container_name: marketpulse-python-worker
    command: python -m app.main
    environment:
      # Database
      DATABASE_URL: postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}

      # Redis & Message Queue
      REDIS_URL: redis://redis:6379/0
      QUEUE_ENABLED: "true"
      REDIS_QUEUE_NAME: marketpulse:tasks

      # Scheduler Settings
      SCHEDULER_ENABLED: "true"
      CRAWL_INTERVAL_HOURS: 1
      SENTIMENT_INTERVAL_HOURS: 2
      MARKET_DATA_INTERVAL_HOURS: 6

      # API Keys
      YAHOO_FINANCE_API_KEY: ${YAHOO_FINANCE_API_KEY}
      ALPHA_VANTAGE_API_KEY: ${ALPHA_VANTAGE_API_KEY}
      OPENAI_API_KEY: ${OPENAI_API_KEY}
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    volumes:
      - ./data:/app/data
      - ./logs:/app/logs
    mem_limit: 2g
    restart: unless-stopped

  # ==================== Reverse Proxy ====================

  nginx:
    image: nginx:alpine
    container_name: marketpulse-nginx
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./nginx/ssl:/etc/nginx/ssl:ro
    depends_on:
      - spring-boot
    restart: unless-stopped

volumes:
  postgres_data:
  redis_data:

networks:
  default:
    name: marketpulse-network
```

---

## 📁 프로젝트 구조

```
marketpulse/
├── spring-boot/                    # Spring Boot 메인 API
│   ├── src/main/java/com/marketpulse/
│   │   ├── MarketPulseApplication.java
│   │   ├── config/                 # 설정
│   │   │   ├── SecurityConfig.java
│   │   │   ├── CacheConfig.java        # 캐시 설정 (추후)
│   │   │   └── WebConfig.java
│   │   ├── entity/                 # JPA Entity
│   │   │   ├── User.java
│   │   │   ├── Portfolio.java
│   │   │   ├── Position.java
│   │   │   ├── News.java
│   │   │   └── Ticker.java
│   │   ├── repository/             # JPA Repository
│   │   │   ├── UserRepository.java
│   │   │   ├── PortfolioRepository.java
│   │   │   └── NewsRepository.java
│   │   ├── service/                # 비즈니스 로직
│   │   │   ├── AuthService.java
│   │   │   ├── PortfolioService.java
│   │   │   ├── NewsService.java
│   │   │   └── CacheService.java
│   │   ├── controller/             # REST Controller
│   │   │   ├── AuthController.java
│   │   │   ├── PortfolioController.java
│   │   │   └── NewsController.java
│   │   ├── dto/                    # DTO
│   │   │   ├── request/
│   │   │   └── response/
│   │   ├── security/               # Security
│   │   │   ├── JwtTokenProvider.java
│   │   │   ├── JwtAuthFilter.java
│   │   │   └── UserDetailsServiceImpl.java
│   │   └── exception/              # 예외 처리
│   │       ├── GlobalExceptionHandler.java
│   │       └── CustomException.java
│   ├── src/main/resources/
│   │   ├── application.yml
│   │   ├── application-dev.yml
│   │   └── application-prod.yml
│   ├── src/test/java/              # 테스트
│   ├── Dockerfile
│   └── pom.xml
│
├── app/                            # Python 데이터 파이프라인
│   ├── __init__.py
│   ├── main.py                     # 진입점 (worker 호출)
│   ├── worker.py                   # D2: Orchestrator (APScheduler + Multi-thread)
│   ├── scheduler.py                # APScheduler 설정
│   ├── cli.py                      # CLI 도구 (수동 실행)
│   ├── redis_bus.py                # Redis Event Bus (Queue, Stream, Pub/Sub)
│   ├── command_handler.py          # D3: Command Listener (Spring 명령 처리)
│   ├── analyzer_consumer.py        # D5: Analyzer Consumer (Stream 구독)
│   ├── core/
│   │   ├── config.py               # 설정
│   │   └── database.py             # DB 연결 (미사용)
│   ├── models/
│   │   └── database.py             # SQLAlchemy 모델
│   ├── services/
│   │   ├── crawler_service.py      # D4: Crawler Module (Stream 발행)
│   │   ├── sentiment_analyzer.py   # 감성분석
│   │   ├── ticker_extractor.py     # 티커 추출
│   │   └── market_data_sync.py     # 마켓 데이터 동기화
│
├── index_analyzer/                 # 크롤러 엔진 (기존)
│   ├── crawling/
│   ├── parsing/
│   └── media/
│
├── scripts/                        # 유틸리티 스크립트
│   ├── quick_test.py               # 빠른 시스템 검증
│   ├── test_stream_architecture.py # Stream 아키텍처 테스트
│   ├── load_market_data.py
│   └── init_db.py
│
├── nginx/                          # Nginx 설정
│   ├── nginx.conf
│   └── ssl/
│
├── data/                           # 로컬 데이터
├── logs/                           # 로그
├── tests/                          # 테스트
│   ├── unit/
│   └── integration/
│
├── docker-compose.yml
├── docker-compose.prod.yml
├── Dockerfile.python
├── .env.example
├── .gitignore
├── requirements.txt                # Python 의존성
├── sites.yaml                      # 크롤링 설정
└── README.md
```

---

## 📡 API 문서

### 1. 인증 API

#### 회원가입
```http
POST /api/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "Password123!",
  "name": "John Doe"
}
```

**Response:**
```json
{
  "id": "uuid",
  "email": "user@example.com",
  "name": "John Doe",
  "createdAt": "2025-10-30T10:00:00Z"
}
```

#### 로그인
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "Password123!"
}
```

**Response:**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "tokenType": "Bearer",
  "expiresIn": 3600
}
```

---

### 2. 포트폴리오 API

#### 포트폴리오 조회
```http
GET /api/portfolio
Authorization: Bearer {accessToken}
```

**Response:**
```json
{
  "id": "uuid",
  "userId": "uuid",
  "totalValue": 50000.00,
  "cash": 10000.00,
  "investedValue": 40000.00,
  "totalReturn": 5000.00,
  "totalReturnPercent": 12.5,
  "positions": [
    {
      "id": "uuid",
      "ticker": "AAPL",
      "companyName": "Apple Inc.",
      "shares": 100,
      "avgCost": 150.00,
      "currentPrice": 175.00,
      "marketValue": 17500.00,
      "unrealizedPnl": 2500.00,
      "unrealizedPnlPercent": 16.67,
      "weight": 43.75
    }
  ],
  "performance": {
    "dayReturn": 250.00,
    "dayReturnPercent": 0.5,
    "weekReturn": 1200.00,
    "monthReturn": 3500.00,
    "sharpeRatio": 1.35,
    "maxDrawdown": -8.2
  }
}
```

#### 포지션 추가
```http
POST /api/portfolio/positions
Authorization: Bearer {accessToken}
Content-Type: application/json

{
  "ticker": "TSLA",
  "shares": 50,
  "price": 250.00
}
```

#### 리밸런싱
```http
POST /api/portfolio/rebalance
Authorization: Bearer {accessToken}
Content-Type: application/json

{
  "targetAllocation": {
    "AAPL": 30,
    "MSFT": 30,
    "GOOGL": 20,
    "TSLA": 20
  },
  "threshold": 5.0
}
```

**Response:**
```json
{
  "recommendations": [
    {
      "ticker": "AAPL",
      "action": "SELL",
      "shares": 10,
      "reason": "Over-allocated by 7.5%"
    },
    {
      "ticker": "MSFT",
      "action": "BUY",
      "shares": 15,
      "reason": "Under-allocated by 5.2%"
    }
  ],
  "estimatedCost": 500.00
}
```

---

### 3. 뉴스 API

#### 뉴스 조회
```http
GET /api/news?tickers=AAPL,TSLA&hours=24&sentiment=positive&limit=50&page=0
Authorization: Bearer {accessToken}
```

**Response:**
```json
{
  "content": [
    {
      "id": "uuid",
      "title": "Apple Reports Strong Q4 Earnings",
      "summary": "Apple exceeded expectations...",
      "url": "https://bloomberg.com/...",
      "source": "Bloomberg",
      "publishedAt": "2025-10-30T10:00:00Z",
      "sentiment": {
        "score": 0.85,
        "label": "POSITIVE",
        "confidence": 0.92
      },
      "tickers": ["AAPL"],
      "importanceScore": 8.7
    }
  ],
  "totalElements": 150,
  "totalPages": 3,
  "currentPage": 0,
  "pageSize": 50
}
```

#### 트렌딩 종목
```http
GET /api/news/trending?hours=24&limit=10
Authorization: Bearer {accessToken}
```

**Response:**
```json
{
  "periodHours": 24,
  "trending": [
    {
      "ticker": "AAPL",
      "companyName": "Apple Inc.",
      "newsCount": 15,
      "totalMentions": 45,
      "avgSentiment": 0.65,
      "sentimentChange": 0.12,
      "priceChange": 2.5
    }
  ]
}
```

---

## 🔧 Spring Boot 설정

### `application.yml`

```yaml
spring:
  application:
    name: marketpulse-api

  # Database
  datasource:
    url: ${SPRING_DATASOURCE_URL}
    username: ${SPRING_DATASOURCE_USERNAME}
    password: ${SPRING_DATASOURCE_PASSWORD}
    driver-class-name: org.postgresql.Driver
    hikari:
      maximum-pool-size: 10
      minimum-idle: 5
      connection-timeout: 30000

  jpa:
    hibernate:
      ddl-auto: update
    show-sql: false
    properties:
      hibernate:
        format_sql: true
        dialect: org.hibernate.dialect.PostgreSQLDialect
        jdbc:
          batch_size: 20
        order_inserts: true
        order_updates: true

  # Redis (추후 구현)
  # data:
  #   redis:
  #     host: ${SPRING_DATA_REDIS_HOST}
  #     port: ${SPRING_DATA_REDIS_PORT}
  #     password: ${SPRING_DATA_REDIS_PASSWORD}
  #     timeout: 60000

  # cache:
  #   type: redis
  #   redis:
  #     time-to-live: 600000  # 10분
  #     cache-null-values: false

  # Security
  security:
    jwt:
      secret: ${JWT_SECRET}
      expiration: ${JWT_EXPIRATION}

# Server
server:
  port: 8080
  compression:
    enabled: true

# Actuator
management:
  endpoints:
    web:
      exposure:
        include: health,metrics,prometheus,info
  endpoint:
    health:
      show-details: when-authorized

# Logging
logging:
  level:
    com.marketpulse: INFO
    org.springframework.web: INFO
    org.hibernate.SQL: DEBUG
  file:
    name: logs/spring-boot.log
```

---

## 🧪 테스트

### Spring Boot 테스트

```bash
cd spring-boot

# 전체 테스트
mvn test

# 특정 테스트
mvn test -Dtest=PortfolioServiceTest

# 통합 테스트
mvn verify

# 커버리지
mvn test jacoco:report
```

### Python 테스트

```bash
# 단위 테스트
pytest tests/unit/ -v

# 통합 테스트
pytest tests/integration/ -v

# 커버리지
pytest --cov=app tests/
```

---

## 📦 배포 가이드

### 프로덕션 배포 (Hetzner Cloud)

#### 1. 서버 생성 및 초기 설정

```bash
# SSH 접속
ssh root@your-server-ip

# 시스템 업데이트
apt update && apt upgrade -y

# Docker 설치
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Docker Compose 설치
apt install docker-compose-plugin -y

# 방화벽 설정
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable
```

#### 2. 프로젝트 배포

```bash
# Git 클론
git clone https://github.com/yourusername/marketpulse.git
cd marketpulse

# 환경 변수 설정
cp .env.example .env
nano .env  # 프로덕션 값으로 수정

# SSL 인증서 발급
apt install certbot -y
certbot certonly --standalone -d yourdomain.com

# 인증서 복사
mkdir -p nginx/ssl
cp /etc/letsencrypt/live/yourdomain.com/fullchain.pem nginx/ssl/
cp /etc/letsencrypt/live/yourdomain.com/privkey.pem nginx/ssl/

# 프로덕션 실행
docker-compose -f docker-compose.prod.yml up -d --build
```

#### 3. 모니터링

```bash
# 로그 확인
docker-compose logs -f spring-boot

# 리소스 사용량
docker stats

# 헬스 체크
curl http://localhost:8080/actuator/health
```

---

## 💰 비용 추정

### Phase 1: MVP (100명 사용자)

| 항목 | 스펙 | 월 비용 (USD) |
|------|------|---------------|
| **Hetzner VPS** | CPX41 (8 vCPU, 16GB RAM) | $28 |
| **백업** | Backblaze B2 (100GB) | $0.5 |
| **CDN** | Cloudflare (Free) | $0 |
| **도메인** | .com | $1 |
| **총계** | | **~$30/월** |

**연간: ~$360**

---

## 🗺️ 개발 로드맵

### ✅ 완료
- [x] Python 크롤러 엔진
- [x] 티커 추출 시스템
- [x] PostgreSQL 스키마 설계
- [x] 아키텍처 설계

### 🔄 Month 1-2: 기반 구축
- [ ] **Spring Boot 설정**
  - [ ] 프로젝트 초기화
  - [ ] JPA Entity 설계
  - [ ] Repository 구현
  - [ ] 캐싱 설정 (추후 Spring Boot에서)
- [x] **Python APScheduler 구현**
  - [x] 크롤링 자동 실행
  - [x] 스케줄링 설정
  - [x] CLI 수동 실행 도구
- [x] **Redis Message Queue 구현**
  - [x] Redis Queue Consumer
  - [x] 하이브리드 모드 (APScheduler + Queue)
  - [x] Spring Boot 메시지 포맷 정의
- [ ] **Docker Compose 통합**

### 🔄 Month 3-4: 핵심 기능
- [ ] **인증/권한 시스템**
  - [ ] JWT 구현
  - [ ] Spring Security 설정
  - [ ] OAuth2 통합
- [ ] **포트폴리오 관리**
  - [ ] CRUD API
  - [ ] 성과 계산
  - [ ] 리밸런싱 로직
- [ ] **감성분석**
  - [ ] FinBERT 통합
  - [ ] 배치 처리

### 🔄 Month 5-6: 최적화
- [ ] **성능 튜닝**
  - [ ] DB 인덱스 최적화
  - [ ] 캐시 전략 (Spring Boot)
  - [ ] API 응답 최적화
- [ ] **프론트엔드**
  - [ ] React 기본 구조
  - [ ] 대시보드
  - [ ] 차트 통합
- [ ] **프로덕션 배포**
- [ ] **모니터링** (Prometheus + Grafana)

### 🌟 Phase 2 (성장기)
- [ ] Kafka 이벤트 스트리밍
- [ ] Vector DB (Qdrant)
- [ ] WebSocket 실시간 알림
- [ ] 백테스팅 엔진

---

## 🤝 기여하기

1. Fork the repository
2. Create feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add AmazingFeature'`)
4. Push to branch (`git push origin feature/AmazingFeature`)
5. Open Pull Request

---

## 📝 라이센스

MIT License

---

## 📧 문의

- Issues: https://github.com/yourusername/marketpulse/issues
- Email: contact@marketpulse.io

---

## 🎯 현재 상태

```
진행률: ████████████████░░░░ 80%

완료:
✅ Stream Architecture 설계 (README 시스템 플로우 기반)
✅ Python 크롤러 엔진 (뉴스 수집)
✅ 데이터베이스 스키마 (SQLite/PostgreSQL)
✅ 티커 추출 시스템 (S&P 500)
✅ 감성 분석 (규칙 기반)
✅ APScheduler 자동 스케줄링
✅ Redis Event Bus (Queue, Stream, Pub/Sub 통합)
✅ Command Handler (Spring → Python 명령 처리)
✅ Stream 기반 파이프라인 (Crawler → Analyzer 분리)
✅ Analyzer Consumer (Stream 구독 및 분석)
✅ Status Publisher (Python → Spring 상태 전송)
✅ Multi-thread Orchestrator (APScheduler + 2개 Listener)
✅ CLI 도구 (수동 실행)
✅ 마켓 데이터 동기화

다음 단계:
⏳ Spring Boot API 구현 (Redis 연동)
⏳ JWT 인증 시스템
⏳ 포트폴리오 관리
⏳ FinBERT 고급 감성 분석
⏳ Docker Compose 통합
```

**현재 실행 가능:**

1. **빠른 시작 테스트**
   ```bash
   python scripts/quick_test.py
   ```

2. **APScheduler Only 모드** (권장 - Redis 없이)
   ```bash
   python -m app.main
   ```
   - 매 1시간마다 자동 뉴스 수집
   - 매 2시간마다 감성 분석
   - Redis 불필요 (가장 간단)

3. **Stream Architecture 모드** (Redis 포함)
   ```bash
   docker run -d -p 6379:6379 redis:7-alpine
   python -m app.main
   ```
   - APScheduler + Command Listener + Analyzer Consumer
   - Spring → Python 명령 수신
   - Crawler → Analyzer 파이프라인
   - Python → Spring 상태 전송

4. **CLI 수동 실행**
   ```bash
   python -m app.cli crawl        # 즉시 크롤링
   ```

5. **Stream 테스트**
   ```bash
   python scripts/test_stream_architecture.py
   ```

---

**MarketPulse** - AI-Powered Financial Intelligence Platform
**Architecture**: Spring Boot (Main API) + Python (Data Pipeline) Microservices

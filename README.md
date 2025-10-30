# MarketPulse - AI-Powered Financial Intelligence Platform

실시간 금융 뉴스 분석과 포트폴리오 최적화를 제공하는 마이크로서비스 플랫폼

[![Spring Boot](https://img.shields.io/badge/Spring%20Boot-3.2-green.svg)](https://spring.io/projects/spring-boot)
[![Python 3.9+](https://img.shields.io/badge/python-3.9+-blue.svg)](https://www.python.org/downloads/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-blue.svg)](https://www.postgresql.org/)
[![Redis](https://img.shields.io/badge/Redis-7-red.svg)](https://redis.io/)

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

### Phase 1: MVP - 마이크로서비스 구조

```
┌──────────────────────────────────────────────┐
│           Nginx (Reverse Proxy)              │
│           Port 80/443                        │
└──────────────────────────────────────────────┘
                    │
        ┌───────────┴────────────┐
        │                        │
┌───────▼────────┐    ┌─────────▼──────────┐
│  Spring Boot   │    │  Python FastAPI    │
│  Main API      │    │  (Optional)        │
│  Port 8080     │    │  Port 8000         │
│                │    │                    │
│ • REST API     │◄───┤ • 헬스체크         │
│ • 포트폴리오    │    │ • 내부 API         │
│ • 인증/권한     │    └────────────────────┘
│ • 비즈니스 로직 │              │
└────────┬───────┘              │
         │                      │
         │    ┌─────────────────┘
         │    │
    ┌────▼────▼──────────────────────┐
    │   PostgreSQL 15                │
    │   - 사용자 데이터               │
    │   - 포트폴리오                  │
    │   - 뉴스 데이터 (읽기)          │
    │   - ML 결과 (읽기)              │
    └────────┬───────────────────────┘
             │
    ┌────────▼────────────────────────┐
    │   Redis 7                       │
    │   - Spring 캐시                 │
    │   - 세션 관리                   │
    │   - Celery 브로커 (Python용)    │
    └─────────────────────────────────┘
```

### Python 데이터 파이프라인 (백그라운드)

```
┌────────────────────────────────────────────┐
│  Python Microservice (백그라운드 워커)      │
├────────────────────────────────────────────┤
│                                             │
│  [Celery Beat] 스케줄러                     │
│       │                                     │
│       ├──► [Celery Worker 1] 뉴스 크롤러   │
│       │         │                           │
│       │         └──► PostgreSQL 저장        │
│       │                                     │
│       ├──► [Celery Worker 2] 감성분석      │
│       │         │                           │
│       │         └──► ML 결과 저장           │
│       │                                     │
│       └──► [Celery Worker 3] 피처 추출     │
│                 │                           │
│                 └──► Vector DB 저장         │
└────────────────────────────────────────────┘
         │
         └──► Redis (Celery Broker)
```

### 데이터 플로우

```
1. 데이터 수집 (Python)
   외부 API → Celery 크롤러 → PostgreSQL

2. 데이터 처리 (Python)
   PostgreSQL → Celery ML Worker → 감성분석 → PostgreSQL

3. API 제공 (Spring Boot)
   Frontend → Spring API → Redis Cache → PostgreSQL

4. 포트폴리오 관리 (Spring Boot)
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
- **Redis**: API 응답, 뉴스 데이터, 가격 데이터
- **캐시 무효화**: 실시간 데이터 업데이트 시

### 🐍 Python (데이터 파이프라인)

#### 1. 데이터 수집
- **뉴스 크롤러**: Bloomberg, Reuters, BBC, CNBC
- **가격 데이터**: Yahoo Finance, Alpha Vantage
- **소셜 데이터**: Twitter API (선택)
- **스케줄링**: Celery Beat (매 1시간)

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
| **Main API** | Spring Boot | 3.2+ | REST API, 비즈니스 로직 |
| **Web Framework** | Spring WebFlux | 6.1+ | 리액티브 웹 |
| **Security** | Spring Security | 6.2+ | 인증/권한, JWT |
| **Data Access** | Spring Data JPA | 3.2+ | ORM, Repository |
| **Cache** | Spring Cache + Redis | 3.2+ | 캐싱 추상화 |
| **Validation** | Bean Validation | 3.0+ | 입력 검증 |
| **Monitoring** | Spring Actuator | 3.2+ | 헬스체크, 메트릭 |
| | | | |
| **Data Pipeline** | Python | 3.9+ | 크롤링, ML |
| **Web Framework** | FastAPI | 0.104+ | 내부 API (선택) |
| **Task Queue** | Celery | 5.3+ | 비동기 작업 |
| **ML/NLP** | transformers | 4.35+ | FinBERT |
| **Data Science** | pandas, numpy | latest | 데이터 처리 |
| | | | |
| **Database** | PostgreSQL | 15+ | 메인 데이터 저장소 |
| **Cache/Queue** | Redis | 7+ | 캐시 + Celery 브로커 |
| **Reverse Proxy** | Nginx | 1.24+ | SSL, 로드밸런싱 |
| **Container** | Docker | 24+ | 서비스 격리 |

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

# Redis
REDIS_PASSWORD=your_redis_password

# Spring Boot
JWT_SECRET=your_jwt_secret_key_minimum_32_characters
JWT_EXPIRATION=3600000

# Python API Keys
YAHOO_FINANCE_API_KEY=your_key
ALPHA_VANTAGE_API_KEY=your_key
OPENAI_API_KEY=your_key
```

### 3. Docker Compose로 전체 시스템 실행

```bash
# 모든 서비스 빌드 및 시작
docker-compose up -d --build

# 로그 확인
docker-compose logs -f spring-boot

# 특정 서비스만 재시작
docker-compose restart python-worker
```

### 4. 데이터베이스 초기화

```bash
# Spring Boot가 자동으로 스키마 생성 (Hibernate)
# 마켓 데이터 로드 (Python)
docker-compose exec python-worker python scripts/load_market_data.py

# 초기 관리자 계정 생성
curl -X POST http://localhost:8080/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@marketpulse.io",
    "password": "admin123",
    "name": "Admin"
  }'
```

### 5. 시스템 검증

```bash
# Spring Boot 헬스 체크
curl http://localhost:8080/actuator/health

# Python 워커 상태 확인
docker-compose exec python-worker celery -A app.celery_worker inspect active

# Redis 연결 확인
docker-compose exec redis redis-cli -a your_redis_password ping
```

### 6. API 문서 확인

- **Spring Boot Swagger**: http://localhost:8080/swagger-ui.html
- **Python FastAPI** (선택): http://localhost:8000/docs

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
    command: redis-server --requirepass ${REDIS_PASSWORD}
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "-a", "${REDIS_PASSWORD}", "ping"]
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

      # Redis
      SPRING_DATA_REDIS_HOST: redis
      SPRING_DATA_REDIS_PORT: 6379
      SPRING_DATA_REDIS_PASSWORD: ${REDIS_PASSWORD}

      # JWT
      JWT_SECRET: ${JWT_SECRET}
      JWT_EXPIRATION: ${JWT_EXPIRATION}

      # JVM Options
      JAVA_OPTS: -Xmx2g -Xms512m
    depends_on:
      postgres:
        condition: service_healthy
      redis:
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
    command: celery -A app.celery_worker worker -l info -c 2
    environment:
      # Database
      DATABASE_URL: postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}

      # Redis
      REDIS_URL: redis://:${REDIS_PASSWORD}@redis:6379/0

      # Celery
      CELERY_BROKER_URL: redis://:${REDIS_PASSWORD}@redis:6379/0
      CELERY_RESULT_BACKEND: redis://:${REDIS_PASSWORD}@redis:6379/0

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
    mem_limit: 3g
    restart: unless-stopped

  celery-beat:
    build:
      context: .
      dockerfile: Dockerfile.python
    container_name: marketpulse-celery-beat
    command: celery -A app.celery_worker beat -l info --scheduler django_celery_beat.schedulers:DatabaseScheduler
    environment:
      DATABASE_URL: postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}
      REDIS_URL: redis://:${REDIS_PASSWORD}@redis:6379/0
      CELERY_BROKER_URL: redis://:${REDIS_PASSWORD}@redis:6379/0
    depends_on:
      - redis
      - postgres
    mem_limit: 512m
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
│   │   │   ├── RedisConfig.java
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
│   ├── celery_worker.py            # Celery 설정
│   ├── core/
│   │   ├── config.py               # 설정
│   │   └── database.py             # DB 연결
│   ├── models/
│   │   └── database.py             # SQLAlchemy 모델
│   ├── services/
│   │   ├── crawler_service.py      # 크롤러
│   │   ├── sentiment_analyzer.py   # 감성분석
│   │   ├── feature_extractor.py    # 피처 추출
│   │   └── market_data_sync.py     # 마켓 데이터 동기화
│   ├── tasks/                      # Celery 태스크
│   │   ├── crawl_news.py
│   │   ├── analyze_sentiment.py
│   │   └── extract_features.py
│   └── main.py                     # FastAPI (선택)
│
├── index_analyzer/                 # 크롤러 엔진 (기존)
│   ├── crawling/
│   ├── parsing/
│   └── media/
│
├── scripts/                        # 유틸리티 스크립트
│   ├── load_market_data.py
│   ├── init_db.py
│   └── verify_system.py
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

  # Redis
  data:
    redis:
      host: ${SPRING_DATA_REDIS_HOST}
      port: ${SPRING_DATA_REDIS_PORT}
      password: ${SPRING_DATA_REDIS_PASSWORD}
      timeout: 60000

  cache:
    type: redis
    redis:
      time-to-live: 600000  # 10분
      cache-null-values: false

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
  - [ ] Redis 캐싱 설정
- [ ] **Python Celery 구현**
  - [ ] 크롤링 태스크
  - [ ] 스케줄링 설정
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
  - [ ] Redis 캐시 전략
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
진행률: ████████░░░░░░░░░░░░ 40%

완료:
✅ 아키텍처 설계
✅ Python 크롤러 엔진
✅ 데이터베이스 스키마
✅ 티커 추출 시스템

다음 단계:
⏳ Spring Boot API 구현
⏳ Celery 작업 큐
⏳ JWT 인증 시스템
⏳ 포트폴리오 관리
```

---

**MarketPulse** - AI-Powered Financial Intelligence Platform
**Architecture**: Spring Boot (Main API) + Python (Data Pipeline) Microservices

# MarketPulse - AI 기반 금융 뉴스 분석 플랫폼

실시간 금융 뉴스 수집, 감성 분석, 종목 추천을 제공하는 데이터 파이프라인 시스템

[![Python 3.9+](https://img.shields.io/badge/python-3.9+-blue.svg)](https://www.python.org/downloads/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-blue.svg)](https://www.postgresql.org/)
[![Redis](https://img.shields.io/badge/Redis-7-red.svg)](https://redis.io/)
[![APScheduler](https://img.shields.io/badge/APScheduler-3.10-orange.svg)](https://apscheduler.readthedocs.io/)

---

## 목차

- [시스템 아키텍처](#시스템-아키텍처)
- [MBS 데이터 파이프라인](#mbs-데이터-파이프라인)
- [기술 스택](#기술-스택)
- [빠른 시작](#빠른-시작)
- [프로젝트 구조](#프로젝트-구조)
- [설정](#설정)
- [실행 방법](#실행-방법)
- [데이터베이스 스키마](#데이터베이스-스키마)
- [배포](#배포)

---

## 시스템 아키텍처

### 전체 시스템 구성

```
┌─────────────────────────────────────────────────────────────────┐
│                  Spring API (추후 구현)                         │
│                  사용자 요청 / 수동 트리거                       │
└───────────────┬─────────────────────────────────────────────────┘
                │ Redis Command Queue
                ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Redis Event Bus                              │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ • Queue: 명령 전송 (Spring → Python)                    │  │
│  │ • Stream: 데이터 파이프라인 (Crawler → Analyzer)        │  │
│  │ • Pub/Sub: 상태 업데이트 (Python → Spring)              │  │
│  └──────────────────────────────────────────────────────────┘  │
└───────────────┬─────────────────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────────────────┐
│              Python Worker (Daemon 모드)                         │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Main Thread: APScheduler (자동 스케줄링)                 │  │
│  │   ├─ 뉴스 크롤링 (1시간마다)                             │  │
│  │   ├─ IN→PROC 배치 (1시간마다, Redis 없을 때)            │  │
│  │   ├─ PROC→CALC 변환 (1시간마다)                         │  │
│  │   ├─ CALC→RCMD 생성 (2시간마다)                         │  │
│  │   └─ 마켓 데이터 동기화 (6시간마다)                      │  │
│  │                                                              │  │
│  │ Thread 1: Command Listener (Redis Queue 구독)            │  │
│  │ Thread 2: Analyzer Consumer (Redis Stream 구독)          │  │
│  └──────────────────────────────────────────────────────────┘  │
└───────────────┬─────────────────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────────────────┐
│                  PostgreSQL / SQLite                             │
│                   MBS 테이블 (4개 레이어)                        │
└─────────────────────────────────────────────────────────────────┘
```

### 동작 모드

#### Mode 1: APScheduler Only (Redis 없음)
```bash
QUEUE_ENABLED=false
REDIS_URL=
```
- APScheduler만 실행 (자동 스케줄링)
- 배치 처리로 IN→PROC 변환
- Redis 불필요 (가장 간단한 설정)

#### Mode 2: Stream Architecture (Redis 포함 - 권장)
```bash
QUEUE_ENABLED=true
REDIS_URL=redis://localhost:6379/0
```
- Main Thread: APScheduler (자동 스케줄링)
- Thread 1: Command Listener (Spring 명령 수신)
- Thread 2: Analyzer Consumer (실시간 분석)
- 최고 성능 및 유연성

---

## MBS 데이터 파이프라인

### 파이프라인 구조

```
IN (입수) → PROC (가공) → CALC (계산) → RCMD (추천)
```

#### 레이어별 역할

| 레이어 | 테이블 | 역할 | 담당 컴포넌트 |
|--------|--------|------|---------------|
| **IN** | `MBS_IN_ARTICLE`<br>`MBS_IN_STK_STBD`<br>`MBS_IN_ETF_STBD` | 원본 데이터 입수<br>(뉴스, 주식, ETF) | Crawler, Market Sync |
| **PROC** | `MBS_PROC_ARTICLE` | ML/NLP 가공<br>(감성분석, 요약, 종목매칭) | Analyzer Consumer<br>또는 Article Processor |
| **CALC** | `MBS_CALC_METRIC` | 메트릭 계산<br>(RISK, VOLATILITY, SENTIMENT) | Calc Processor |
| **RCMD** | `MBS_RCMD_RESULT` | 추천 생성<br>(NEWS, STOCK, PORTFOLIO) | Rcmd Generator |

### 데이터 흐름

#### 1. 자동 크롤링 (APScheduler)
```
매 1시간마다 실행
├─ Crawler → MBS_IN_ARTICLE (원본 저장)
├─ Redis Stream 발행 (Redis 있을 때)
│  └─ Analyzer Consumer → MBS_PROC_ARTICLE (즉시 분석)
└─ Article Processor → MBS_PROC_ARTICLE (배치 처리, Redis 없을 때)
```

#### 2. 메트릭 계산 (매 1시간)
```
PROC → CALC 변환
├─ MBS_PROC_ARTICLE 조회
├─ 메트릭 계산 (SENTIMENT, PRICE_IMPACT, RISK, VOLATILITY)
└─ MBS_CALC_METRIC 저장
```

#### 3. 추천 생성 (매 2시간)
```
CALC → RCMD 변환
├─ MBS_CALC_METRIC 조회
├─ 추천 로직 실행
│  ├─ NEWS 추천 (중요 뉴스)
│  ├─ STOCK 추천 (BUY/SELL/HOLD)
│  └─ PORTFOLIO 추천 (자산 배분)
└─ MBS_RCMD_RESULT 저장
```

---

## 기술 스택

### Backend

| 구분 | 기술 | 버전 | 용도 |
|------|------|------|------|
| **언어** | Python | 3.9+ | 데이터 파이프라인 |
| **스케줄러** | APScheduler | 3.10+ | 자동 작업 스케줄링 |
| **메시지 큐** | Redis | 7+ | Queue, Stream, Pub/Sub |
| **데이터베이스** | PostgreSQL | 15+ | 메인 DB (프로덕션) |
|  | SQLite | 3+ | 개발/테스트용 DB |
| **ORM** | SQLAlchemy | 2.0+ | 데이터베이스 ORM |
| **크롤링** | Custom Engine | - | 뉴스 크롤러 |
| **NLP** | NLTK, spaCy | latest | 텍스트 분석 |

### 인프라 (추후 구현)

- **Spring Boot**: REST API 서버
- **Docker**: 컨테이너화
- **Nginx**: 리버스 프록시

---

## 빠른 시작

### 요구사항

- Python 3.9+
- Redis 7+ (선택사항, Mode 2용)
- PostgreSQL 15+ 또는 SQLite

### 1. 저장소 클론

```bash
git clone https://github.com/yup2dev/index_analyzer.git
cd index_analyzer
```

### 2. Python 패키지 설치

```bash
pip install -r requirements.txt
```

### 3. 환경 변수 설정

`.env` 파일 생성:

```bash
# 데이터베이스 (SQLite)
SQLITE_PATH=data/marketpulse.db

# 데이터베이스 (PostgreSQL - 선택)
# DATABASE_URL=postgresql://user:password@localhost:5432/marketpulse

# Redis (선택 - Mode 2용)
REDIS_URL=redis://localhost:6379/0
QUEUE_ENABLED=true
REDIS_QUEUE_NAME=queue:marketpulse_commands
REDIS_STATUS_CHANNEL=pub:marketpulse_status

# APScheduler
SCHEDULER_ENABLED=true
CRAWL_INTERVAL_HOURS=1
MARKET_DATA_INTERVAL_HOURS=6

# 로깅
LOG_LEVEL=INFO
```

### 4. 빠른 테스트

```bash
# 시스템 검증
python scripts/quick_test.py
```

예상 출력:
```
================================================================================
MarketPulse Quick System Test
================================================================================

1. Testing imports...
✅ All modules imported successfully

2. Checking configuration...
✅ Configuration loaded

3. Testing database...
✅ Database ready: data/marketpulse.db

4. Testing crawler service...
✅ Crawler service ready (4 sites configured)

5. Testing Redis (optional)...
✅ Redis connected: redis://localhost:6379/0

✅ System Check Complete!
```

### 5. Worker 실행

#### Option A: APScheduler Only (Redis 없이)

```bash
python -m app.main
```

**동작:**
- APScheduler만 실행
- 뉴스 크롤링 즉시 1회 실행 후 매 1시간마다 자동 실행
- 배치 모드로 IN→PROC 변환
- Redis 불필요

**로그 예시:**
```
================================================================================
MarketPulse Background Worker Starting
Database: sqlite:///./data/marketpulse.db
APScheduler: Enabled
Redis Queue: Disabled
================================================================================

Scheduler started successfully
Active jobs: 5
  - IN - News Crawling (every 1h)
  - IN to PROC Batch Processing (every 1h)
  - PROC to CALC Processing (every 1h)
  - CALC to RCMD Generation (every 2h)
  - Sync Market Data (every 6h)

Background Worker is running...
Press Ctrl+C to stop
```

#### Option B: Stream Architecture (Redis 포함)

```bash
# 1. Redis 시작
docker run -d -p 6379:6379 redis:7-alpine

# 2. Worker 실행
python -m app.main
```

**동작:**
- Main Thread: APScheduler
- Thread 1: Command Listener (Spring 명령 대기)
- Thread 2: Analyzer Consumer (실시간 분석)

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
  - Command Listener: Listening on 'queue:marketpulse_commands'
  - Analyzer Consumer: Consuming 'stream:new_articles'
Press Ctrl+C to stop
```

### 6. CLI 수동 실행

```bash
# 개별 작업 실행
python -m app.cli crawl          # 뉴스 크롤링
python -m app.cli sentiment      # 감성 분석 (deprecated)
python -m app.cli sync-market    # 마켓 데이터 동기화
python -m app.cli cleanup        # 오래된 데이터 정리

# 모든 작업 순차 실행
python -m app.cli all

# 도움말
python -m app.cli help
```

---

## 프로젝트 구조

```
index_analyzer/
├── app/                            # Python 데이터 파이프라인
│   ├── main.py                     # 진입점 (Worker 실행)
│   ├── worker.py                   # Orchestrator (APScheduler + Threads)
│   ├── scheduler.py                # APScheduler 설정
│   ├── cli.py                      # CLI 도구
│   ├── redis_bus.py                # Redis Event Bus (Queue, Stream, Pub/Sub)
│   ├── command_handler.py          # Command Listener (Spring 명령 처리)
│   ├── analyzer_consumer.py        # Analyzer Consumer (Stream 구독)
│   │
│   ├── core/
│   │   ├── config.py               # 설정
│   │   └── database.py             # DB 연결
│   │
│   ├── models/
│   │   └── database.py             # SQLAlchemy 모델 (MBS 테이블)
│   │
│   └── services/
│       ├── crawler_service.py      # 뉴스 크롤러
│       ├── article_processor.py    # IN→PROC 배치 변환 (Redis 없을 때)
│       ├── calc_processor.py       # PROC→CALC 변환
│       ├── rcmd_generator.py       # CALC→RCMD 생성
│       ├── market_data_sync.py     # 마켓 데이터 동기화
│       ├── sentiment_analyzer.py   # 감성 분석
│       └── ticker_extractor.py     # 종목 추출
│
├── index_analyzer/                 # 크롤러 엔진
│   ├── crawling/                   # 크롤링 로직
│   ├── parsing/                    # HTML 파싱
│   └── media/                      # 미디어 처리
│
├── scripts/                        # 유틸리티 스크립트
│   ├── quick_test.py               # 시스템 검증
│   └── load_market_data.py         # 초기 데이터 로드
│
├── data/                           # 로컬 데이터
│   └── marketpulse.db              # SQLite DB (자동 생성)
│
├── logs/                           # 로그 파일
├── requirements.txt                # Python 의존성
├── sites.yaml                      # 크롤링 사이트 설정
├── .env                            # 환경 변수
└── README.md                       # 이 파일
```

---

## 설정

### 환경 변수 (.env)

```bash
# ===== Database =====
SQLITE_PATH=data/marketpulse.db
# PostgreSQL 사용 시:
# DATABASE_URL=postgresql://user:password@localhost:5432/marketpulse

# ===== Redis =====
REDIS_URL=redis://localhost:6379/0
QUEUE_ENABLED=true
REDIS_QUEUE_NAME=queue:marketpulse_commands
REDIS_STATUS_CHANNEL=pub:marketpulse_status

# ===== APScheduler =====
SCHEDULER_ENABLED=true
CRAWL_INTERVAL_HOURS=1
MARKET_DATA_INTERVAL_HOURS=6

# ===== Logging =====
LOG_LEVEL=INFO
LOG_FILE=logs/marketpulse.log
```

### 크롤링 사이트 설정 (sites.yaml)

```yaml
reuters:
  - https://www.reuters.com/markets/
  - https://www.reuters.com/business/

bloomberg:
  - https://www.bloomberg.com/markets

yahoo:
  - https://finance.yahoo.com/news/

cnbc:
  - https://www.cnbc.com/world-markets/
```

---

## 실행 방법

### 개발 환경

```bash
# Redis 없이 (가장 간단)
python -m app.main

# Redis 포함 (권장)
docker run -d -p 6379:6379 redis:7-alpine
python -m app.main
```

### 프로덕션 환경 (systemd)

1. **systemd 서비스 파일 생성** (`/etc/systemd/system/marketpulse.service`):

```ini
[Unit]
Description=MarketPulse Worker
After=network.target redis.service postgresql.service

[Service]
Type=simple
User=marketpulse
WorkingDirectory=/opt/marketpulse
Environment="PATH=/opt/marketpulse/venv/bin"
ExecStart=/opt/marketpulse/venv/bin/python -m app.main
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

2. **서비스 시작**:

```bash
sudo systemctl daemon-reload
sudo systemctl enable marketpulse
sudo systemctl start marketpulse
sudo systemctl status marketpulse
```

3. **로그 확인**:

```bash
journalctl -u marketpulse -f
```

### Docker 배포

```bash
# 빌드
docker build -t marketpulse-worker .

# 실행
docker run -d \
  --name marketpulse-worker \
  --env-file .env \
  -v $(pwd)/data:/app/data \
  -v $(pwd)/logs:/app/logs \
  marketpulse-worker
```

---

## 데이터베이스 스키마

### MBS 테이블 구조

#### 1. MBS_IN_ARTICLE (입수 - 뉴스)

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `news_id` | String(50) PK | 뉴스 고유 ID |
| `base_ymd` | Date | 기준일자 |
| `source_cd` | String(50) | 출처 코드 (Reuters, Bloomberg 등) |
| `title` | Text | 제목 |
| `content` | Text | 본문 |
| `publish_dt` | DateTime | 발행 시간 |
| `ingest_batch_id` | String(50) | 입수 배치 ID |

#### 2. MBS_IN_STK_STBD (입수 - 주식)

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `stk_cd` | String(20) | 종목 코드 (티커) |
| `stk_nm` | String(100) | 종목명 |
| `sector` | String(100) | 섹터 |
| `close_price` | Decimal | 종가 |
| `change_rate` | Decimal | 등락률 |
| `base_ymd` | Date | 기준일자 |

#### 3. MBS_PROC_ARTICLE (가공 - 분석)

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `proc_id` | String(50) PK | 처리 ID |
| `news_id` | String(50) FK | 원본 뉴스 ID |
| `stk_cd` | String(20) | 매칭된 종목 코드 |
| `summary_text` | Text | ML 요약 |
| `sentiment_score` | Decimal | 감성 점수 (-1 ~ 1) |
| `match_score` | Decimal | 기사-종목 매칭도 (0 ~ 1) |
| `price_impact` | Decimal | 가격 영향도 |

#### 4. MBS_CALC_METRIC (계산 - 메트릭)

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `calc_id` | String(50) PK | 계산 ID |
| `stk_cd` | String(20) | 종목 코드 |
| `metric_type` | String(20) | 메트릭 타입 (SENTIMENT, RISK, VOLATILITY) |
| `metric_val` | Decimal | 메트릭 값 |
| `source_proc_id` | String(50) FK | 출처 처리 ID |

#### 5. MBS_RCMD_RESULT (추천 - 결과)

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `rcmd_id` | String(50) PK | 추천 ID |
| `rcmd_type` | String(20) | 추천 타입 (NEWS, STOCK, PORTFOLIO) |
| `ref_news_id` | String(50) FK | 참조 뉴스 ID |
| `ref_stk_cd` | String(20) | 참조 종목 코드 |
| `ref_calc_id` | String(50) FK | 참조 계산 ID |
| `score` | Decimal | 추천 점수 |
| `reason` | Text | 추천 이유 |

### 데이터 조회 예시

```sql
-- 최신 추천 조회
SELECT rcmd_type, ref_stk_cd, score, reason, base_ymd
FROM mbs_rcmd_result
ORDER BY created_at DESC
LIMIT 10;

-- 각 레이어별 레코드 수
SELECT 'IN' as layer, COUNT(*) FROM mbs_in_article
UNION ALL
SELECT 'PROC', COUNT(*) FROM mbs_proc_article
UNION ALL
SELECT 'CALC', COUNT(*) FROM mbs_calc_metric
UNION ALL
SELECT 'RCMD', COUNT(*) FROM mbs_rcmd_result;

-- 특정 종목의 감성 트렌드
SELECT base_ymd, metric_val
FROM mbs_calc_metric
WHERE stk_cd = 'AAPL' AND metric_type = 'SENTIMENT'
ORDER BY base_ymd DESC
LIMIT 30;
```

---

## Spring Boot 연동 (추후 구현)

### 명령 전송 (Java)

```java
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
            "queue:marketpulse_commands",
            new ObjectMapper().writeValueAsString(command)
        );
    }
}
```

### 상태 구독 (Java)

```java
@Service
public class StatusSubscriber {
    @EventListener
    public void onRedisMessage(String message) {
        // Python에서 보낸 상태 메시지 처리
        log.info("Received status: " + message);
    }
}
```

---

## 배포

### 요구사항

- Ubuntu 20.04+ 또는 CentOS 8+
- Python 3.9+
- Redis 7+
- PostgreSQL 15+

### 배포 스크립트

```bash
#!/bin/bash
# deploy.sh

# 1. 저장소 업데이트
git pull origin main

# 2. 의존성 설치
pip install -r requirements.txt

# 3. 데이터베이스 마이그레이션
python scripts/migrate_db.py

# 4. Worker 재시작
sudo systemctl restart marketpulse

# 5. 상태 확인
sudo systemctl status marketpulse
```

---

## 모니터링

### 로그 확인

```bash
# Worker 로그
tail -f logs/marketpulse.log

# systemd 로그
journalctl -u marketpulse -f
```

### 데이터베이스 상태

```bash
# SQLite
sqlite3 data/marketpulse.db "SELECT COUNT(*) FROM mbs_in_article;"

# PostgreSQL
psql -d marketpulse -c "SELECT COUNT(*) FROM mbs_rcmd_result;"
```

### Redis 모니터링

```bash
# Queue 길이
redis-cli LLEN queue:marketpulse_commands

# Stream 길이
redis-cli XLEN stream:new_articles

# Consumer Group 정보
redis-cli XINFO GROUPS stream:new_articles
```

---

## 트러블슈팅

### Worker가 시작되지 않을 때

```bash
# 1. Redis 연결 확인
redis-cli ping

# 2. 설정 파일 확인
cat .env | grep REDIS_URL

# 3. Python 의존성 확인
pip list | grep apscheduler
```

### 크롤링이 동작하지 않을 때

```bash
# 1. sites.yaml 확인
cat sites.yaml

# 2. 수동 크롤링 테스트
python -m app.cli crawl

# 3. 로그 확인
tail -f logs/marketpulse.log | grep Crawler
```

### Redis 연결 오류

```bash
# Redis 재시작
sudo systemctl restart redis

# Redis 연결 테스트
redis-cli -h localhost -p 6379 ping
```

---

## 개발 로드맵

### ✅ 완료

- [x] MBS 파이프라인 설계 및 구현
- [x] APScheduler 자동 스케줄링
- [x] Redis Stream 아키텍처
- [x] 뉴스 크롤러 엔진
- [x] 감성 분석 시스템
- [x] 종목 추출 시스템
- [x] 메트릭 계산 (PROC→CALC)
- [x] 추천 생성 (CALC→RCMD)

### 🔄 진행 중

- [ ] Spring Boot REST API 구현
- [ ] Redis 연동 테스트
- [ ] Docker Compose 통합

### 📋 계획

- [ ] FinBERT 고급 감성 분석
- [ ] Vector DB (Qdrant) 통합
- [ ] WebSocket 실시간 알림
- [ ] 백테스팅 엔진
- [ ] Prometheus + Grafana 모니터링

---

**MarketPulse** - AI-Powered Financial Intelligence Platform
**Architecture**: Python Data Pipeline + Spring Boot API (Microservices)

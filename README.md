# MarketPulse - AI 기반 금융 뉴스 분석 플랫폼

실시간 금융 뉴스 크롤링, Transformer 기반 요약, FinBERT 감성 분석, 자동 투자 추천 시스템

[![Python 3.9+](https://img.shields.io/badge/python-3.9+-blue.svg)](https://www.python.org/downloads/)
[![Redis](https://img.shields.io/badge/Redis-7-red.svg)](https://redis.io/)
[![Transformers](https://img.shields.io/badge/Transformers-4.30+-orange.svg)](https://huggingface.co/transformers/)

---

## 📋 목차

- [주요 기능](#주요-기능)
- [시스템 아키텍처](#시스템-아키텍처)
- [파이프라인 구조](#파이프라인-구조)
- [기술 스택](#기술-스택)
- [빠른 시작](#빠른-시작)
- [설정](#설정)
- [프로젝트 구조](#프로젝트-구조)
- [데이터베이스 스키마](#데이터베이스-스키마)

---

## 🚀 주요 기능

### 1. **자동 뉴스 크롤링**
- Reuters, Bloomberg, Yahoo Finance, CNBC 등 주요 금융 미디어
- 스케줄 기반 자동 크롤링 (매 1시간)
- RSS 피드 및 HTML 파싱 지원

### 2. **AI 기반 텍스트 분석**

#### 📝 Transformer 요약
- **모델**: `sshleifer/distilbart-cnn-12-6` (기본)
- **압축률**: 원문의 30-35%로 요약
- **지원 모델**:
  - `facebook/bart-large-cnn` (고품질, 느림)
  - `t5-small` (경량)
  - `eenzeenee/t5-base-korean-summarization` (한국어)

#### 💬 FinBERT 감성 분석
- **모델**: `ProsusAI/finbert` (금융 특화)
- **출력**: positive/negative/neutral + 신뢰도
- **Fallback**: 규칙 기반 Lexicon 분석
- **특징**: 티커별 컨텍스트 감성 분석

#### 🎯 종목 추출
- 기사 내 종목 코드(Ticker) 자동 추출
- 회사명 → 티커 매핑 (AAPL, TSLA, MSFT 등)
- 매칭 신뢰도 점수

### 3. **실시간 파이프라인**
```
Crawler → Redis Stream (maxlen: 10000)
  ↓ (실시간 Consumer)
PROC: 감성분석 + 요약 + 종목추출
  ↓ (자동 트리거)
CALC: 메트릭 계산 (RISK, VOLATILITY, SENTIMENT)
  ↓ (자동 트리거)
RCMD: 투자 추천 (NEWS, STOCK, PORTFOLIO)
```

### 4. **투자 추천 엔진**
- **NEWS 추천**: 고위험/고감성 뉴스 TOP 10
- **STOCK 추천**: BUY/SELL/HOLD 신호 생성
- **PORTFOLIO 추천**: 분산 투자 포트폴리오 구성

### 5. **멀티 스레드 아키텍처**
- **Main Thread**: APScheduler (자동 스케줄링)
- **Thread 1**: Analyzer Consumer (Stream 구독)
- **Thread 2**: Command Listener (Spring 명령 수신)

---

## 🏗️ 시스템 아키텍처

```
┌──────────────────────────────────────────────────────┐
│                  Spring Boot API                      │
│               (REST API / 추후 구현)                   │
└────────────────┬─────────────────────────────────────┘
                 │ Redis Queue
                 ↓
┌──────────────────────────────────────────────────────┐
│              Redis Event Bus (Port 6379)              │
│  ┌────────────────────────────────────────────────┐  │
│  │ • Queue: Spring → Python 명령                 │  │
│  │ • Stream: Crawler → Analyzer (실시간)         │  │
│  │ • Pub/Sub: Python → Spring 상태               │  │
│  └────────────────────────────────────────────────┘  │
└────────────────┬─────────────────────────────────────┘
                 │
                 ↓
┌──────────────────────────────────────────────────────┐
│          Python Worker (Background Daemon)            │
│  ┌────────────────────────────────────────────────┐  │
│  │ Main Thread: APScheduler                       │  │
│  │   - Crawler (매 1시간)                         │  │
│  │   - Market Data Sync (매 6시간)                │  │
│  │                                                 │  │
│  │ Thread 1: Analyzer Consumer                    │  │
│  │   - Stream 구독 → PROC → CALC → RCMD 자동 실행│  │
│  │                                                 │  │
│  │ Thread 2: Command Listener                     │  │
│  │   - Spring 명령 수신 및 처리                   │  │
│  └────────────────────────────────────────────────┘  │
└────────────────┬─────────────────────────────────────┘
                 │
                 ↓
┌──────────────────────────────────────────────────────┐
│         PostgreSQL / SQLite Database                  │
│                 MBS 4-Layer Schema                    │
│    IN → PROC → CALC → RCMD                           │
└──────────────────────────────────────────────────────┘
```

---

## 🔄 파이프라인 구조

### MBS 4-Layer Architecture

| 레이어 | 테이블 | 역할 | 처리 방법 |
|--------|--------|------|-----------|
| **IN** | `MBS_IN_ARTICLE` | 원본 뉴스 입수 | Crawler |
| **PROC** | `MBS_PROC_ARTICLE` | AI 분석 (요약/감성/종목) | Transformer + FinBERT |
| **CALC** | `MBS_CALC_METRIC` | 메트릭 계산 | Risk/Volatility 계산 |
| **RCMD** | `MBS_RCMD_RESULT` | 투자 추천 | 추천 알고리즘 |

### 자동 파이프라인 체인

```python
# 각 기사마다 순차 실행 (실시간)

1️⃣ Crawler (스케줄: 매 1시간)
   └─→ Redis Stream 발행
       └─→ news_id, url, source_cd

2️⃣ PROC (Analyzer Consumer - 실시간)
   ├─ Sentiment Analysis (FinBERT)
   ├─ Summarization (Transformer)
   ├─ Ticker Extraction
   └─ MBS_PROC_ARTICLE 저장
   └─→ 자동 트리거: CALC

3️⃣ CALC (CalcProcessor - 즉시)
   ├─ SENTIMENT 메트릭
   ├─ PRICE_IMPACT 메트릭
   ├─ RISK 메트릭
   ├─ VOLATILITY 메트릭
   └─ MBS_CALC_METRIC 저장
   └─→ 자동 트리거: RCMD

4️⃣ RCMD (RcmdGenerator - 즉시)
   ├─ NEWS 추천 (TOP 10)
   ├─ STOCK 추천 (BUY/SELL)
   └─ PORTFOLIO 추천
   └─ MBS_RCMD_RESULT 저장
```

**처리 시간**: 기사 1개당 평균 2-3초 (Transformer 포함)

---

## 🛠️ 기술 스택

### Backend
- **Python 3.9+**: 데이터 파이프라인
- **Redis 7+**: Stream/Queue/Pub-Sub
- **APScheduler 3.10+**: 작업 스케줄링

### AI/ML
- **Transformers 4.30+**: Hugging Face 라이브러리
- **PyTorch 2.0+**: Transformer 백엔드
- **FinBERT**: 금융 뉴스 감성 분석
- **DistilBART**: 뉴스 요약

### Database
- **PostgreSQL 15+**: 프로덕션 DB
- **SQLite 3+**: 개발/테스트 DB
- **SQLAlchemy 2.0+**: ORM

### Data Collection
- **BeautifulSoup4**: HTML 파싱
- **Feedparser**: RSS 피드
- **yfinance**: 시장 데이터

---

## ⚡ 빠른 시작

### 1. 요구사항

```bash
Python 3.9+
Redis 7+ (Docker 권장)
torch, transformers (CPU 버전)
```

### 2. 설치

```bash
# 저장소 클론
git clone <repository-url>
cd marketpulse

# 가상 환경 생성
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate

# 패키지 설치
pip install -r requirements.txt

# Transformer 모델 설치 (CPU)
pip install torch transformers --index-url https://download.pytorch.org/whl/cpu
```

### 3. 환경 변수 설정

`.env` 파일 생성:

```bash
# Database
SQLITE_PATH=data/marketpulse.db

# Redis
REDIS_URL=redis://localhost:6379/0
QUEUE_ENABLED=true

# APScheduler
SCHEDULER_ENABLED=true
CRAWL_INTERVAL_HOURS=1
MARKET_DATA_INTERVAL_HOURS=6

# AI Models
USE_TRANSFORMERS=True
SUMMARIZATION_MODEL=sshleifer/distilbart-cnn-12-6
SUMMARY_MAX_LENGTH=150
SUMMARY_MIN_LENGTH=50

# Logging
LOG_LEVEL=INFO
```

### 4. Redis 실행

```bash
# Docker 사용
docker run -d -p 6379:6379 redis:7-alpine

# 또는 로컬 설치
redis-server
```

### 5. Worker 실행

```bash
python -m app.worker
```

**출력 예시:**
```
================================================================================
MarketPulse Background Worker Starting (Stream Architecture)
Database: sqlite:///C:\Users\...\data\marketpulse.db
APScheduler: Enabled
Redis Queue: Enabled
================================================================================

INITIALIZING MARKET DATA
================================================================================
[1/2] Ticker metadata already exists in MBS_IN_STBD_MST (skipping)
[2/2] Loading price data from MBS_IN_STBD_MST to asset tables...
MARKET DATA INITIALIZATION COMPLETED
================================================================================

Redis Event Bus initialized successfully
================================================================================

[Thread 1] Starting Analyzer Consumer...
[AnalyzerConsumer] Initialized with DB: C:\Users\...\data\marketpulse.db
[AnalyzerConsumer] Summarization: {
  'model_name': 'sshleifer/distilbart-cnn-12-6',
  'is_loaded': True,
  'method': 'abstractive'
}
[Thread 1] Analyzer Consumer started

[Thread 2] Starting Command Listener...
[Thread 2] Command Listener started

================================================================================
Background Worker is running (Automatic Pipeline Chain)

Pipeline Architecture:
  Crawler (scheduled every 1h)
    ↓ Redis Stream
  PROC (real-time, per article)
    ↓ auto-trigger
  CALC (immediate)
    ↓ auto-trigger
  RCMD (immediate)

Active Threads:
  - APScheduler: Crawler scheduling
  - Command Listener: 'marketpulse:commands'
  - Pipeline Consumer: 'stream:new_articles' → PROC → CALC → RCMD

Press Ctrl+C to stop
================================================================================
```

### 6. 테스트

```bash
# 시스템 검증
python scripts/test_summarization.py
python scripts/test_sentiment.py

# 수동 크롤링
python -m app.cli crawl
```

---

## ⚙️ 설정

### AI 모델 설정

#### Summarization (요약)

```bash
# .env
SUMMARIZATION_MODEL=sshleifer/distilbart-cnn-12-6  # 기본 (빠름)
# SUMMARIZATION_MODEL=facebook/bart-large-cnn      # 고품질 (느림)
# SUMMARIZATION_MODEL=t5-small                     # 경량
# SUMMARIZATION_MODEL=eenzeenee/t5-base-korean-summarization  # 한국어

SUMMARY_MAX_LENGTH=150  # 최대 토큰
SUMMARY_MIN_LENGTH=50   # 최소 토큰
```

#### Sentiment Analysis (감성 분석)

```bash
# .env
USE_TRANSFORMERS=True   # FinBERT 사용
# USE_TRANSFORMERS=False  # Rule-based Lexicon 사용
```

**FinBERT vs Rule-based:**

| 항목 | FinBERT | Rule-based |
|------|---------|------------|
| 정확도 | ⭐⭐⭐⭐⭐ | ⭐⭐ |
| 문맥 이해 | ✅ | ❌ |
| 속도 | 🐢 1-2초 | ⚡ 0.01초 |
| 메모리 | 💾 400MB | 📝 1KB |

### Redis Stream 설정

```python
# app/redis_bus.py:116
maxlen: int = 10000  # Stream 최대 메시지 수
```

변경 방법:
- `app/core/config.py`에 `REDIS_STREAM_MAXLEN` 추가
- 또는 `publish_to_stream()` 호출 시 `maxlen` 파라미터 전달

---

## 📁 프로젝트 구조

```
marketpulse/
├── app/
│   ├── worker.py                    # Main Worker (진입점)
│   ├── scheduler.py                 # APScheduler 설정
│   ├── redis_bus.py                 # Redis Event Bus
│   ├── command_handler.py           # Command Listener
│   ├── analyzer_consumer.py         # Analyzer Consumer (PROC)
│   │
│   ├── core/
│   │   ├── config.py                # 환경 설정
│   │   └── database.py              # DB 연결
│   │
│   ├── models/
│   │   └── database.py              # SQLAlchemy 모델
│   │
│   └── services/
│       ├── crawler_service.py       # 뉴스 크롤러
│       ├── summarization_service.py # Transformer 요약 ⭐ NEW
│       ├── sentiment_analyzer.py    # FinBERT 감성 분석
│       ├── ticker_extractor.py      # 종목 추출
│       ├── calc_processor.py        # PROC→CALC
│       ├── rcmd_generator.py        # CALC→RCMD
│       └── market_data_sync.py      # 시장 데이터
│
├── scripts/
│   ├── test_summarization.py        # 요약 테스트
│   ├── test_sentiment.py            # 감성 분석 테스트
│   └── test_mbs_pipeline.py         # 파이프라인 테스트
│
├── data/
│   └── marketpulse.db               # SQLite DB
│
├── logs/
│   └── app.log                      # 로그 파일
│
├── requirements.txt
├── sites.yaml                       # 크롤링 사이트 설정
├── .env                             # 환경 변수
└── README.md
```

---

## 💾 데이터베이스 스키마

### MBS_IN_ARTICLE (입수 - 뉴스)
```sql
news_id         VARCHAR(50) PRIMARY KEY
base_ymd        DATE
source_cd       VARCHAR(50)      -- Reuters, Bloomberg, etc.
title           TEXT
content         TEXT
url             TEXT
publish_dt      DATETIME
ingest_batch_id VARCHAR(50)
created_at      DATETIME
```

### MBS_PROC_ARTICLE (가공 - AI 분석)
```sql
proc_id         VARCHAR(50) PRIMARY KEY
news_id         VARCHAR(50) FK → MBS_IN_ARTICLE
stk_cd          VARCHAR(20)      -- 추출된 종목 코드
summary_text    TEXT             -- Transformer 요약 ⭐
sentiment_score DECIMAL(10,4)    -- FinBERT 감성 (-1 ~ 1)
match_score     DECIMAL(10,4)    -- 종목 매칭 신뢰도
price_impact    DECIMAL(10,4)
base_ymd        DATE
created_at      DATETIME
```

### MBS_CALC_METRIC (계산 - 메트릭)
```sql
calc_id         VARCHAR(50) PRIMARY KEY
stk_cd          VARCHAR(20)
base_ymd        DATE
metric_type     VARCHAR(20)      -- SENTIMENT, RISK, VOLATILITY, PRICE_IMPACT
metric_val      DECIMAL(10,4)
source_proc_id  VARCHAR(50) FK → MBS_PROC_ARTICLE
created_at      DATETIME
```

### MBS_RCMD_RESULT (추천 - 결과)
```sql
rcmd_id         VARCHAR(50) PRIMARY KEY
rcmd_type       VARCHAR(20)      -- NEWS, STOCK, PORTFOLIO
ref_news_id     VARCHAR(50) FK
ref_stk_cd      VARCHAR(20)
ref_calc_id     VARCHAR(50) FK
score           DECIMAL(10,4)
reason          TEXT
base_ymd        DATE
created_at      DATETIME
```

### 데이터 조회 예시

```sql
-- 최신 추천 조회
SELECT rcmd_type, ref_stk_cd, score, reason, base_ymd
FROM mbs_rcmd_result
ORDER BY created_at DESC
LIMIT 10;

-- 특정 종목의 감성 트렌드
SELECT base_ymd, metric_val
FROM mbs_calc_metric
WHERE stk_cd = 'AAPL' AND metric_type = 'SENTIMENT'
ORDER BY base_ymd DESC
LIMIT 30;

-- 파이프라인 통계
SELECT
  (SELECT COUNT(*) FROM mbs_in_article) as IN_count,
  (SELECT COUNT(*) FROM mbs_proc_article) as PROC_count,
  (SELECT COUNT(*) FROM mbs_calc_metric) as CALC_count,
  (SELECT COUNT(*) FROM mbs_rcmd_result) as RCMD_count;
```

---

## 🔧 CLI 명령어

```bash
# 수동 크롤링
python -m app.cli crawl

# 시장 데이터 동기화
python -m app.cli sync-market

# 데이터 정리 (30일 이전)
python -m app.cli cleanup

# 전체 실행
python -m app.cli all

# 도움말
python -m app.cli help
```

---

## 📊 모니터링

### Redis 모니터링

```bash
# Stream 길이
redis-cli XLEN stream:new_articles

# Consumer Group 정보
redis-cli XINFO GROUPS stream:new_articles

# Queue 길이
redis-cli LLEN marketpulse:commands
```

### 로그 확인

```bash
# 실시간 로그
tail -f logs/app.log

# 에러만 필터링
tail -f logs/app.log | grep ERROR
```

### 데이터베이스 통계

```bash
# SQLite
sqlite3 data/marketpulse.db "
SELECT
  'IN' as layer, COUNT(*) as count FROM mbs_in_article
UNION ALL
SELECT 'PROC', COUNT(*) FROM mbs_proc_article
UNION ALL
SELECT 'CALC', COUNT(*) FROM mbs_calc_metric
UNION ALL
SELECT 'RCMD', COUNT(*) FROM mbs_rcmd_result;
"
```

---

## 🐳 Docker 배포 (추후)

```dockerfile
FROM python:3.9-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .

CMD ["python", "-m", "app.worker"]
```

```bash
# 빌드 및 실행
docker build -t marketpulse-worker .
docker run -d --name marketpulse \
  --env-file .env \
  -v $(pwd)/data:/app/data \
  -v $(pwd)/logs:/app/logs \
  marketpulse-worker
```

---

## 📈 성능

### 처리 속도
- **크롤링**: 100 기사/분
- **PROC 분석**: 20-30 기사/분 (Transformer 포함)
- **CALC/RCMD**: 즉시 (< 0.1초)

### 메모리 사용량
- **기본**: ~500MB
- **Transformer 로드 시**: ~1.5GB
- **FinBERT 로드 시**: ~2GB

### Redis Stream
- **최대 보관**: 10,000 메시지
- **자동 삭제**: FIFO (오래된 메시지부터)

---

## 🤝 기여

이슈 및 PR 환영합니다!

---

## 📄 라이센스

MIT License

---

**MarketPulse** - AI-Powered Financial Intelligence Platform
Built with ❤️ using Python, Transformers, and Redis

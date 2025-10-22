# MarketPulse - 완전한 배포 가이드

## 📋 목차
1. [시스템 요구사항](#시스템-요구사항)
2. [설치 단계](#설치-단계)
3. [데이터베이스 설정](#데이터베이스-설정)
4. [크롤러 실행](#크롤러-실행)
5. [API 서버 실행](#api-서버-실행)
6. [검증 및 테스트](#검증-및-테스트)
7. [프로덕션 배포](#프로덕션-배포)

---

## 🖥️ 시스템 요구사항

### 필수
- Python 3.9 이상
- 2GB RAM 이상
- 10GB 디스크 공간

### 선택사항 (성능 향상)
- PostgreSQL 14+ (프로덕션 권장)
- Redis 7+ (캐싱)
- CUDA GPU (Transformers 사용시)

---

## 📦 설치 단계

### Step 1: 저장소 클론 (또는 프로젝트 생성)

```bash
cd marketpulse
```

### Step 2: 가상환경 생성

```bash
# Windows
python -m venv venv
venv\Scripts\activate

# Linux/Mac
python3 -m venv venv
source venv/bin/activate
```

### Step 3: 의존성 설치

**최소 설치 (빠른 시작):**
```bash
pip install -r requirements_minimal.txt
```

**완전 설치 (모든 기능):**
```bash
pip install -r requirements_full.txt

# Spacy 모델 다운로드 (NER 향상)
python -m spacy download en_core_web_sm
```

### Step 4: 프로젝트 구조 확인

```
marketpulse/
├── app/
│   ├── main.py               # FastAPI 서버
│   ├── models/
│   │   └── database.py       # DB 모델
│   └── services/
│       ├── ticker_extractor.py    # 티커 추출
│       ├── sentiment_analyzer.py  # 감성 분석
│       └── news_processor.py      # 뉴스 처리
├── scripts/
│   └── init_db.py            # DB 초기화
├── tests/
│   └── unit/                 # 단위 테스트
├── run_integrated_crawler.py # 통합 크롤러
└── sites.yaml                # 크롤링 설정
```

---

## 🗄️ 데이터베이스 설정

### Option 1: SQLite (개발/테스트용 - 가장 간단)

```bash
# 데이터베이스 초기화
python scripts/init_db.py --type sqlite --path data/marketpulse.db

# 결과
# ✓ Tables created successfully
# ✓ Loaded 30+ sample tickers
# ✓ Database initialization complete!
```

### Option 2: PostgreSQL (프로덕션용)

#### 2.1 PostgreSQL 설치 및 실행

**Windows:**
```bash
# PostgreSQL 다운로드: https://www.postgresql.org/download/windows/
# 설치 후 시작
```

**Linux:**
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
```

#### 2.2 데이터베이스 생성

```bash
# PostgreSQL 접속
psql -U postgres

# 데이터베이스 생성
CREATE DATABASE marketpulse;
CREATE USER marketpulse_user WITH PASSWORD 'secure_password';
GRANT ALL PRIVILEGES ON DATABASE marketpulse TO marketpulse_user;
\q
```

#### 2.3 환경 변수 설정

```bash
# .env 파일 생성
cat > .env << EOF
DB_HOST=localhost
DB_PORT=5432
DB_NAME=marketpulse
DB_USER=marketpulse_user
DB_PASSWORD=secure_password
EOF
```

#### 2.4 테이블 초기화

```bash
python scripts/init_db.py --type postgresql
```

---

## 🕷️ 크롤러 실행

### 1. 간단한 크롤링 테스트

```bash
python run_integrated_crawler.py
```

**출력 예시:**
```
================================================================================
MarketPulse 통합 크롤러
뉴스 크롤링 → 티커 추출 → 감성 분석 → 데이터베이스 저장
================================================================================

Configuration:
  Seed URLs: 1
  Max articles: 20
  Database: data/marketpulse.db
================================================================================

[1] https://www.bbc.com/news/articles/...
  Title: Israel identifies bodies of two hostages returned by Hamas
  Published: 2025-10-22 03:58:08
  Text length: 1,234 chars
  ✓ Saved to database
  Tickers: 1
    - JPM: JPMorgan Chase (confidence: 0.85, mentions: 2)
  Sentiment: positive (score: 0.65)
  Importance: 7.2/10

...

================================================================================
CRAWL COMPLETE
================================================================================

Statistics:
  URLs discovered: 30
  Articles processed: 15
  Tickers extracted: 23
  Average tickers/article: 1.5

Top Trending Tickers:
  1. AAPL (Apple Inc.): 5 articles
  2. MSFT (Microsoft): 3 articles
  3. TSLA (Tesla Inc.): 2 articles
```

### 2. sites.yaml 설정

```yaml
# sites.yaml 예시
bloomberg:
  base_url: "https://www.bloomberg.com"
  seed_urls:
    - "https://www.bloomberg.com/markets"

reuters:
  base_url: "https://www.reuters.com"
  seed_urls:
    - "https://www.reuters.com/business"
```

---

## 🚀 API 서버 실행

### 1. 개발 모드

```bash
python -m app.main

# 또는 uvicorn 직접 사용
uvicorn app.main:app --reload --port 8000
```

**출력:**
```
INFO:     Started server process
INFO:     Waiting for application startup.
INFO:     Application startup complete.
INFO:     Uvicorn running on http://0.0.0.0:8000 (Press CTRL+C to quit)
```

### 2. API 문서 접속

브라우저에서:
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

### 3. API 테스트

```bash
# 최신 뉴스 조회
curl http://localhost:8000/api/news?limit=5

# 특정 종목 뉴스
curl http://localhost:8000/api/tickers/AAPL/news

# 트렌딩 종목
curl http://localhost:8000/api/trending

# 통계
curl http://localhost:8000/api/stats
```

---

## ✅ 검증 및 테스트

### 1. 단위 테스트 실행

```bash
# 전체 테스트
pytest tests/

# 특정 테스트
pytest tests/unit/test_ticker_extractor.py
pytest tests/unit/test_sentiment_analyzer.py

# 커버리지 포함
pytest --cov=app tests/
```

**예상 출력:**
```
===================== test session starts ======================
collected 20 items

tests/unit/test_ticker_extractor.py ............    [ 60%]
tests/unit/test_sentiment_analyzer.py ........     [100%]

===================== 20 passed in 2.34s =======================
```

### 2. 검증 스크립트 실행

```bash
python scripts/verify_system.py
```

(검증 스크립트는 다음 섹션에서 생성)

---

## 🌐 프로덕션 배포

### 1. Gunicorn으로 실행

```bash
pip install gunicorn

# 4개 워커로 실행
gunicorn app.main:app \
  -w 4 \
  -k uvicorn.workers.UvicornWorker \
  --bind 0.0.0.0:8000 \
  --access-logfile access.log \
  --error-logfile error.log
```

### 2. Nginx 리버스 프록시

```nginx
# /etc/nginx/sites-available/marketpulse
server {
    listen 80;
    server_name api.marketpulse.com;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### 3. Systemd 서비스

```ini
# /etc/systemd/system/marketpulse.service
[Unit]
Description=MarketPulse API
After=network.target

[Service]
User=www-data
WorkingDirectory=/path/to/marketpulse
Environment="PATH=/path/to/marketpulse/venv/bin"
ExecStart=/path/to/marketpulse/venv/bin/gunicorn app.main:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable marketpulse
sudo systemctl start marketpulse
sudo systemctl status marketpulse
```

### 4. 주기적 크롤링 (Cron)

```bash
# crontab -e
# 매 5분마다 크롤링
*/5 * * * * /path/to/venv/bin/python /path/to/marketpulse/run_integrated_crawler.py >> /var/log/marketpulse/crawler.log 2>&1
```

---

## 📊 모니터링

### 로그 확인

```bash
# API 서버 로그
tail -f access.log
tail -f error.log

# 크롤러 로그
tail -f /var/log/marketpulse/crawler.log
```

### 데이터베이스 통계

```bash
# SQLite
sqlite3 data/marketpulse.db "SELECT COUNT(*) FROM news_articles;"
sqlite3 data/marketpulse.db "SELECT COUNT(*) FROM tickers;"

# PostgreSQL
psql -d marketpulse -c "SELECT COUNT(*) FROM news_articles;"
```

---

## 🔧 문제 해결

### 데이터베이스 연결 오류

```bash
# 데이터베이스 재초기화
python scripts/init_db.py --reset
```

### 크롤러 실패

```bash
# sites.yaml 확인
cat sites.yaml

# 네트워크 확인
ping www.bbc.com

# 로그 확인
python run_integrated_crawler.py 2>&1 | tee crawler.log
```

### API 서버 오류

```bash
# 포트 사용 확인
netstat -an | grep 8000

# 테스트 모드 실행
python -m app.main
```

---

## 🎯 다음 단계

1. **성능 최적화**
   - Redis 캐싱 추가
   - Celery 백그라운드 작업
   - 데이터베이스 인덱스 최적화

2. **기능 확장**
   - WebSocket 실시간 스트리밍
   - 더 많은 뉴스 소스 추가
   - AI 모델 업그레이드 (FinBERT)

3. **모니터링**
   - Prometheus + Grafana
   - 알림 시스템
   - 헬스 체크 엔드포인트

---

## 📞 지원

문제가 발생하면 Issue를 등록하거나 로그를 확인하세요.

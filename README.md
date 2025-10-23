# MarketPulse - Financial News Crawler & Analyzer

실시간 금융 뉴스를 수집하고 관련 종목(Ticker)을 자동 추출하는 확장 가능한 크롤러 시스템

[![Python 3.9+](https://img.shields.io/badge/python-3.9+-blue.svg)](https://www.python.org/downloads/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.104+-green.svg)](https://fastapi.tiangolo.com/)
[![SQLAlchemy](https://img.shields.io/badge/SQLAlchemy-2.0+-red.svg)](https://www.sqlalchemy.org/)

---

## 📋 목차

- [주요 기능](#-주요-기능)
- [빠른 시작](#-빠른-시작)
- [시스템 아키텍처](#️-시스템-아키텍처)
- [설치 방법](#-설치-방법)
- [사용 방법](#-사용-방법)
- [마켓 데이터](#-마켓-데이터)
- [API 문서](#-api-문서)
- [프로젝트 구조](#-프로젝트-구조)
- [배포](#-배포)

---

## ✨ 주요 기능

### 🎯 확장 가능한 데이터 관리
- **외부 API 기반 동적 데이터 로드** (하드코딩 제거)
  - Wikipedia API로 S&P 500 전체 종목 자동 로드
  - yfinance API로 실시간 티커 정보 보강
  - 커스텀 티커 추가/제거 지원
- **자동 동기화**: 오래된 데이터 자동 재동기화

### 📰 뉴스 크롤링
- 다중 소스 지원 (BBC, Reuters, Bloomberg 등)
- RSS 피드 및 HTML 파싱
- 중복 제거 및 데이터 정규화

### 🏷️ 티커 추출 (DB 기반)
- 명시적 티커 인식 (`$AAPL`, `(TSLA)`, `NASDAQ:NVDA`)
- 회사명 → 티커 자동 매핑 (대소문자 구분 없음)
- NER 기반 회사명 추출 (선택사항)
- 컨텍스트 기반 관련도 점수

### 📊 데이터 분석
- 감성 분석 (긍정/부정/중립)
- 뉴스 중요도 평가
- 종목 멘션 빈도 추적
- 실시간 트렌딩 종목 감지

### 🚀 API 제공
- RESTful API (FastAPI)
- 종목별/시간별 필터링
- 페이지네이션 지원
- Swagger UI 자동 생성

---

## 🚀 빠른 시작

### 1. 의존성 설치
```bash
pip install -r requirements.txt
```

### 2. 데이터베이스 초기화 및 마켓 데이터 로드
```bash
# 외부 API에서 S&P 500 + 원자재 + ETF 데이터 로드
python scripts/load_market_data.py
```

**출력:**
```
INFO: Fetching S&P 500 constituents from Wikipedia...
INFO: ✓ Found 503 S&P 500 companies from Wikipedia
INFO: ✓ Synced 503 S&P 500 stocks
INFO: ✓ Synced 22 commodity futures
INFO: ✓ Synced 10 ETFs
INFO: Total synced: 535

Asset Type & Sector Distribution:
  stock           Information Technology        76
  stock           Financials                    66
  stock           Health Care                   63
  commodity       Energy                         5
  etf             ETF                           10
```

### 3. 시스템 검증
```bash
python scripts/verify_system.py
```

### 4. 뉴스 크롤링
```bash
python run_integrated_crawler.py
```

### 5. API 서버 시작
```bash
python -m app.main
```

브라우저에서 http://localhost:8000/docs 접속

---

## 🏗️ 시스템 아키텍처

```
┌─────────────────┐
│  News Sources   │
│ (RSS/Web/API)   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  News Crawler   │
│  (BeautifulSoup)│
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Ticker Extractor│◄──── External APIs (Wikipedia, yfinance)
│  (DB-based)     │      - Dynamic data loading
└────────┬────────┘      - No hardcoding
         │
         ▼
┌─────────────────┐
│ Sentiment       │
│ Analyzer        │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   Database      │
│  (SQLite/PG)    │
│  + Metadata     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   REST API      │
│  (FastAPI)      │
└─────────────────┘
```

### 핵심 개선사항
- ✅ **하드코딩 제거**: 모든 티커/원자재 데이터는 외부 API 또는 DB에서 관리
- ✅ **확장 가능한 스키마**: `asset_type`, `currency`, `country` 등 메타데이터 추가
- ✅ **동기화 추적**: `last_synced_at`, `sync_status`, `is_active` 필드로 데이터 신선도 관리
- ✅ **유연한 추가/제거**: CLI 명령으로 커스텀 티커 관리

---

## 📦 설치 방법

### 요구사항
- Python 3.9+
- SQLite (기본) 또는 PostgreSQL (프로덕션)

### 설치 단계

```bash
# 1. 저장소 클론
git clone https://github.com/yourusername/marketpulse.git
cd marketpulse

# 2. 가상환경 생성
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# 3. 의존성 설치
pip install -r requirements.txt

# 4. 마켓 데이터 로드 (외부 API 기반)
python scripts/load_market_data.py

# 5. 시스템 검증
python scripts/verify_system.py
```

---

## 💻 사용 방법

### 1. 마켓 데이터 관리

#### 전체 데이터 로드 (S&P 500 + 원자재 + ETF)
```bash
python scripts/load_market_data.py
```

#### 티커 목록 조회
```bash
# 전체 티커
python scripts/load_market_data.py --list

# 특정 자산 유형만
python scripts/load_market_data.py --list --type etf
python scripts/load_market_data.py --list --type commodity
```

#### 커스텀 티커 추가
```bash
# 단일 주식 추가
python scripts/load_market_data.py --add TSLA stock

# 암호화폐 추가
python scripts/load_market_data.py --add BTC-USD crypto
```

#### 티커 제거 (비활성화)
```bash
python scripts/load_market_data.py --remove TSLA
```

#### 데이터 리셋
```bash
python scripts/load_market_data.py --reset
```

### 2. 뉴스 크롤링

```bash
# 전체 크롤러 실행
python run_integrated_crawler.py

# 특정 소스만 크롤링 (sites.yaml 수정)
python run_crawler.py
```

### 3. API 서버

```bash
# 개발 모드
python -m app.main

# 특정 포트
uvicorn app.main:app --port 8080

# 프로덕션 모드 (Gunicorn)
gunicorn app.main:app -w 4 -k uvicorn.workers.UvicornWorker
```

### 4. Python 라이브러리로 사용

```python
from app.models.database import get_sqlite_db
from app.services.market_data_sync import MarketDataSync

# DB 연결
db = get_sqlite_db("data/marketpulse.db")
session = db.get_session()

# 마켓 데이터 동기화
sync = MarketDataSync(session)
results = sync.sync_all(enrich=True)

# 커스텀 티커 추가
sync.add_custom_ticker("BTC-USD", asset_type="crypto")

# 오래된 티커 확인 (7일 이상)
outdated = sync.get_outdated_tickers(days=7)
```

---

## 📊 마켓 데이터

### 지원 자산 유형
- **stock**: 주식 (S&P 500 등)
- **commodity**: 원자재 선물
- **etf**: 상장지수펀드
- **index**: 지수 선물
- **crypto**: 암호화폐 (커스텀 추가)

### 기본 포함 데이터

| 자산 유형 | 출처 | 개수 | 동적 로드 |
|----------|------|------|----------|
| S&P 500 주식 | Wikipedia API | 503개 | ✅ |
| 원자재 선물 | yfinance | 22개 | ✅ |
| 주요 ETF | yfinance | 10개 | ✅ |
| **총계** | - | **535개** | **✅** |

### 데이터 특징
- ✅ **하드코딩 제거**: 모든 데이터는 외부 API에서 동적으로 로드
- ✅ **자동 업데이트**: Wikipedia S&P 500 편입 변경 시 자동 반영
- ✅ **yfinance 보강**: 시가총액, 섹터, 산업 정보 자동 추가
- ✅ **확장 가능**: 커스텀 티커 추가/제거 지원

### 티커 추출 예시
```python
from app.services.ticker_extractor import TickerExtractor

extractor = TickerExtractor()  # DB에서 535개 티커 자동 로드

# 대소문자 구분 없음
text = "Apple, TESLA, and goldman sachs report earnings"
tickers = extractor.extract(text)
# 결과: [AAPL, TSLA, GS]

# 원자재
text = "Gold and Silver prices surge"
tickers = extractor.extract(text)
# 결과: [GC=F (Gold Futures), SI=F (Silver Futures)]
```

---

## 📡 API 문서

### 주요 엔드포인트

#### 1. 최신 뉴스 조회
```http
GET /api/news?tickers=AAPL,MSFT&hours=24&limit=50&sentiment=positive
```

**응답:**
```json
[
  {
    "id": "uuid",
    "title": "Apple Reports Strong Earnings",
    "url": "https://...",
    "published_at": "2025-10-22T10:30:00Z",
    "sentiment": {
      "score": 0.75,
      "label": "positive",
      "confidence": 0.88
    },
    "tickers": [
      {
        "symbol": "AAPL",
        "name": "Apple Inc.",
        "confidence": 0.95,
        "mention_count": 5
      }
    ],
    "importance_score": 8.5
  }
]
```

#### 2. 특정 종목 뉴스
```http
GET /api/tickers/AAPL/news?hours=24
```

#### 3. 트렌딩 종목
```http
GET /api/trending?hours=24&limit=10
```

**응답:**
```json
{
  "period_hours": 24,
  "trending": [
    {
      "symbol": "AAPL",
      "name": "Apple Inc.",
      "news_count": 15,
      "total_mentions": 45,
      "avg_sentiment": 0.65
    }
  ]
}
```

#### 4. 통계
```http
GET /api/stats
```

### API 문서 자동 생성
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

---

## 📁 프로젝트 구조

```
marketpulse/
├── app/
│   ├── models/
│   │   └── database.py          # ORM 모델 (개선된 스키마)
│   ├── services/
│   │   ├── market_data_sync.py  # 외부 API 통합 서비스 (NEW)
│   │   ├── ticker_extractor.py  # DB 기반 티커 추출
│   │   ├── sentiment_analyzer.py
│   │   └── news_processor.py
│   ├── api/
│   └── main.py                  # FastAPI 애플리케이션
├── scripts/
│   ├── load_market_data.py      # 마켓 데이터 로더 (리팩토링)
│   ├── init_db.py
│   └── verify_system.py
├── index_analyzer/              # 크롤링 엔진
│   ├── crawling/
│   ├── parsing/
│   └── media/
├── data/
│   └── marketpulse.db           # SQLite 데이터베이스
├── requirements.txt
├── sites.yaml                   # 크롤링 설정
└── README.md
```

### 핵심 파일 설명

#### `app/models/database.py`
- 개선된 Ticker 모델:
  - `asset_type`: stock/commodity/etf/crypto/index
  - `currency`, `country`: 메타데이터
  - `data_source`, `last_synced_at`, `sync_status`: 동기화 정보
  - `is_active`: 활성/비활성 상태

#### `app/services/market_data_sync.py` (NEW)
- `MarketDataSync` 클래스:
  - `sync_sp500_from_wikipedia()`: Wikipedia에서 S&P 500 로드
  - `enrich_with_yfinance()`: yfinance로 데이터 보강
  - `sync_all()`: 전체 동기화
  - `add_custom_ticker()`: 커스텀 티커 추가
  - `remove_ticker()`: 티커 비활성화

#### `scripts/load_market_data.py` (리팩토링)
- 하드코딩 제거
- CLI 인터페이스:
  - `--list`: 티커 목록
  - `--add SYMBOL TYPE`: 티커 추가
  - `--remove SYMBOL`: 티커 제거
  - `--reset`: 데이터 리셋

---

## 🚀 배포

### PostgreSQL 설정 (프로덕션)

```python
# app/models/database.py
from app.models.database import get_postgresql_db

db = get_postgresql_db(
    host="localhost",
    port=5432,
    database="marketpulse",
    user="postgres",
    password="your_password"
)
```

### Nginx + Gunicorn

```bash
# Gunicorn 실행
gunicorn app.main:app \
  -w 4 \
  -k uvicorn.workers.UvicornWorker \
  --bind 127.0.0.1:8000
```

### Systemd 서비스

```ini
# /etc/systemd/system/marketpulse.service
[Unit]
Description=MarketPulse API Server
After=network.target

[Service]
User=www-data
Group=www-data
WorkingDirectory=/opt/marketpulse
Environment="PATH=/opt/marketpulse/venv/bin"
ExecStart=/opt/marketpulse/venv/bin/gunicorn app.main:app -w 4 -k uvicorn.workers.UvicornWorker --bind 127.0.0.1:8000

[Install]
WantedBy=multi-user.target
```

### Docker

```dockerfile
FROM python:3.9-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .

# 마켓 데이터 로드
RUN python scripts/load_market_data.py

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

---

## 🧪 테스트

```bash
# 단위 테스트
pytest tests/unit/

# 통합 테스트
pytest tests/integration/

# 커버리지
pytest --cov=app tests/
```

---

## 🔧 설정

### sites.yaml (크롤링 소스)
```yaml
bbc:
  base_url: "https://www.bbc.com"
  seed_urls:
    - "https://www.bbc.com/news/business"

reuters:
  base_url: "https://www.reuters.com"
  seed_urls:
    - "https://www.reuters.com/business"
```

### 환경 변수 (.env)
```bash
# 데이터베이스
DATABASE_URL=sqlite:///data/marketpulse.db

# API 설정
API_HOST=0.0.0.0
API_PORT=8000

# 크롤링 설정
CRAWL_INTERVAL=300
MAX_ARTICLES=50
```

---

## 📈 성능 최적화

### 1. yfinance 캐싱
```python
# 빠른 로드를 위해 --no-enrich 옵션 사용
python scripts/load_market_data.py --no-enrich
```

### 2. 데이터베이스 인덱싱
- `asset_type`, `is_active`, `sector` 컬럼에 인덱스 자동 생성
- 복합 인덱스: `(asset_type, is_active)`, `(sector, is_active)`

### 3. 정기 동기화
```bash
# Cron 작업 (매주 일요일 자정)
0 0 * * 0 cd /path/to/marketpulse && python scripts/load_market_data.py
```

---

## ❓ 문제 해결

### "모듈을 찾을 수 없습니다"
```bash
pip install -r requirements.txt
```

### "데이터베이스 연결 오류"
```bash
python scripts/load_market_data.py --reset
```

### "Wikipedia 로드 실패"
- 네트워크 연결 확인
- Fallback 데이터가 자동으로 사용됨

---

## 📝 라이센스

MIT License

---

## 🤝 기여하기

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📧 문의

문제가 발생하면 Issues 탭에 등록해주세요.

---

## 🎯 주요 개선사항 (v2.0)

### ✅ 완료
- [x] 하드코딩 제거 (외부 API 기반 동적 로딩)
- [x] DB 스키마 개선 (메타데이터 추가)
- [x] yfinance API 통합
- [x] 커스텀 티커 추가/제거 CLI
- [x] 동기화 상태 추적
- [x] README 통합 (단일 문서)

### 🔮 향후 계획
- [ ] Redis 캐싱
- [ ] WebSocket 실시간 스트리밍
- [ ] Celery 백그라운드 작업
- [ ] 다국어 지원
- [ ] GraphQL API

---

**MarketPulse** - 확장 가능하고 유지보수가 쉬운 금융 뉴스 크롤러

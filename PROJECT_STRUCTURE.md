# MarketPulse - Project Structure

## 📁 Complete Directory Structure

```
marketpulse/
├── app/                              # Main application
│   ├── __init__.py
│   ├── main.py                       # FastAPI application
│   ├── api/                          # API routes (future)
│   │   └── __init__.py
│   ├── core/                         # Core configs (future)
│   │   └── __init__.py
│   ├── models/                       # Database models
│   │   ├── __init__.py
│   │   └── database.py               # SQLAlchemy ORM models
│   └── services/                     # Business logic
│       ├── __init__.py
│       ├── ticker_extractor.py       # Ticker extraction service
│       ├── sentiment_analyzer.py     # Sentiment analysis service
│       └── news_processor.py         # News processing pipeline
│
├── index_analyzer/                   # Original crawler module
│   ├── __init__.py
│   ├── config/                       # Configuration
│   │   ├── __init__.py
│   │   └── loader.py                 # YAML config loader
│   ├── crawling/                     # Web crawling
│   │   ├── __init__.py
│   │   ├── crawler.py                # Main crawler
│   │   ├── http_client.py            # HTTP client
│   │   ├── url_classifier.py         # URL classification
│   │   └── multi_thread_crawler.py   # Multi-threaded crawler
│   ├── media/                        # Image handling
│   │   ├── __init__.py
│   │   ├── image_downloader.py       # Image download
│   │   ├── image_analyzer.py         # OCR & analysis
│   │   └── image_store.py            # Image storage
│   ├── models/                       # Data models
│   │   ├── __init__.py
│   │   ├── schemas.py                # Pydantic schemas
│   │   ├── chart_data.py             # Chart metadata
│   │   └── report.py                 # Report models
│   └── parsing/                      # HTML parsing
│       ├── __init__.py
│       ├── parser.py                 # Main parser
│       └── heuristics.py             # Article detection
│
├── scripts/                          # Utility scripts
│   ├── __init__.py
│   ├── init_db.py                    # Database initialization
│   └── verify_system.py              # System verification
│
├── tests/                            # Test suite
│   ├── __init__.py
│   ├── unit/                         # Unit tests
│   │   ├── __init__.py
│   │   ├── test_ticker_extractor.py
│   │   └── test_sentiment_analyzer.py
│   └── integration/                  # Integration tests
│       └── __init__.py
│
├── data/                             # Data storage
│   ├── images/                       # Downloaded images
│   └── marketpulse.db                # SQLite database
│
├── run_crawler.py                    # Simple crawler
├── run_integrated_crawler.py         # Full pipeline crawler
├── sites.yaml                        # Crawling configuration
│
├── requirements.txt                  # Python dependencies (basic)
├── requirements_minimal.txt          # Minimal dependencies
├── requirements_full.txt             # Full dependencies
│
├── README.md                         # Project overview
├── QUICKSTART.md                     # Quick start guide
├── DEPLOYMENT.md                     # Deployment guide
├── USAGE.md                          # Usage instructions
├── PROJECT_STRUCTURE.md              # This file
│
└── .env.example                      # Environment variables template
```

## 🔑 Key Components

### 1. Core Services

#### `app/services/ticker_extractor.py`
- 티커 추출 로직
- 명시적 패턴 인식 ($AAPL, (TSLA))
- 회사명 → 티커 매핑
- NER 기반 추출 (spacy 사용시)

#### `app/services/sentiment_analyzer.py`
- 감성 분석
- 규칙 기반 (기본)
- FinBERT 모델 (선택)
- 중요도 점수 계산

#### `app/services/news_processor.py`
- 전체 파이프라인 관리
- 티커 추출 + 감성 분석
- 데이터베이스 저장

### 2. Database Models

#### `app/models/database.py`
- **NewsArticle**: 뉴스 기사
- **Ticker**: 종목 마스터
- **NewsTicker**: 뉴스-종목 관계

### 3. API Application

#### `app/main.py`
- FastAPI 서버
- RESTful endpoints
- CORS 설정
- 에러 핸들링

### 4. Crawler

#### `index_analyzer/crawling/`
- BFS 크롤링
- URL 분류
- HTML 파싱
- 이미지 다운로드

## 📊 Data Flow

```
┌──────────────┐
│ News Sources │
│  (Websites)  │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│   Crawler    │  run_integrated_crawler.py
│  (BFS/HTTP)  │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│    Parser    │  index_analyzer/parsing/parser.py
│ (HTML → Text)│
└──────┬───────┘
       │
       ▼
┌──────────────┐
│Ticker Extract│  app/services/ticker_extractor.py
│ (Text → $)   │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│  Sentiment   │  app/services/sentiment_analyzer.py
│  Analysis    │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│  Database    │  app/models/database.py
│ (PostgreSQL/ │
│   SQLite)    │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│  REST API    │  app/main.py
│  (FastAPI)   │
└──────────────┘
```

## 🔧 Configuration Files

### `sites.yaml`
크롤링할 뉴스 소스 설정

### `.env`
환경 변수 (데이터베이스 연결 등)

### `requirements*.txt`
Python 의존성 정의

## 🧪 Testing

### Unit Tests
- `tests/unit/test_ticker_extractor.py`
- `tests/unit/test_sentiment_analyzer.py`

### Integration Tests
- (Future implementation)

### System Verification
- `scripts/verify_system.py`

## 📝 Documentation

- **README.md**: 전체 개요
- **QUICKSTART.md**: 빠른 시작
- **DEPLOYMENT.md**: 배포 가이드
- **USAGE.md**: 사용 방법
- **PROJECT_STRUCTURE.md**: 프로젝트 구조 (이 파일)

## 🚀 Entry Points

### Development
```bash
python scripts/verify_system.py    # 시스템 검증
python scripts/init_db.py          # DB 초기화
python run_integrated_crawler.py   # 크롤링 실행
python -m app.main                  # API 서버
```

### Production
```bash
python scripts/init_db.py --type postgresql
gunicorn app.main:app -w 4 -k uvicorn.workers.UvicornWorker
```


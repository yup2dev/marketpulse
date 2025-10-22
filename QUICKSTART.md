# MarketPulse - Quick Start Guide

## 🚀 5분 안에 시작하기

### Step 1: 의존성 설치 (1분)

```bash
# 최소 requirements 설치
pip install -r requirements_minimal.txt
```

### Step 2: 데이터베이스 초기화 (30초)

```bash
# SQLite 데이터베이스 생성
python scripts/init_db.py
```

**출력:**
```
INFO:__main__:Initializing sqlite database...
INFO:__main__:Creating tables...
INFO:__main__:✓ Tables created successfully
INFO:__main__:Loading sample ticker data...
INFO:__main__:✓ Loaded 30 sample tickers
INFO:__main__:Total tickers in database: 30
INFO:__main__:✓ Database initialization complete!
```

### Step 3: 시스템 검증 (30초)

```bash
# 전체 시스템 테스트
python scripts/verify_system.py
```

**출력:**
```
================================================================================
  MarketPulse System Verification
  전체 시스템 검증 테스트
================================================================================

================================================================================
  1. Testing Imports
================================================================================
  ✓ beautifulsoup4
  ✓ lxml
  ✓ requests
  ✓ sqlalchemy
  ✓ fastapi
  ✓ pydantic
  ✓ pyyaml

...

================================================================================
  Verification Summary
================================================================================
  ✓ Imports
  ✓ Ticker Extractor
  ✓ Sentiment Analyzer
  ✓ Database
  ✓ News Processor
  ✓ API Server

Total: 6/6 passed

🎉 All tests passed! System is ready.
```

### Step 4: 뉴스 크롤링 (2분)

```bash
# 통합 크롤러 실행
python run_integrated_crawler.py
```

**출력:**
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

================================================================================
[1] https://www.bbc.com/news/articles/cd675jygwp1o
================================================================================
  Title: Israel identifies bodies of two hostages returned by Hamas
  Published: 2025-10-22 03:58:08.407000+00:00
  Text length: 1,234 chars
  ✓ Saved to database
  Tickers: 1
    - AAPL: Apple Inc. (confidence: 0.85, mentions: 2)
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

### Step 5: API 서버 시작 (1분)

```bash
# FastAPI 서버 실행
python -m app.main
```

**출력:**
```
INFO:     Started server process
INFO:     Waiting for application startup.
INFO:     Application startup complete.
INFO:     Uvicorn running on http://0.0.0.0:8000 (Press CTRL+C to quit)
```

### Step 6: API 테스트

#### 브라우저에서:
- **API 문서**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

#### 명령줄에서:

```bash
# 최신 뉴스 조회
curl http://localhost:8000/api/news?limit=5 | python -m json.tool

# 특정 종목 뉴스
curl http://localhost:8000/api/tickers/AAPL/news | python -m json.tool

# 트렌딩 종목
curl http://localhost:8000/api/trending | python -m json.tool

# 통계
curl http://localhost:8000/api/stats | python -m json.tool
```

---

## 📊 주요 API 엔드포인트

### 1. 뉴스 조회
```
GET /api/news?tickers=AAPL,MSFT&hours=24&limit=50&sentiment=positive
```

**응답:**
```json
[
  {
    "id": "uuid-string",
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

### 2. 종목별 뉴스
```
GET /api/tickers/AAPL/news?hours=24
```

### 3. 트렌딩 종목
```
GET /api/trending?hours=24&limit=10
```

**응답:**
```json
{
  "period_hours": 24,
  "count": 10,
  "trending": [
    {
      "symbol": "AAPL",
      "name": "Apple Inc.",
      "news_count": 15,
      "total_mentions": 45,
      "avg_confidence": 0.92,
      "avg_sentiment": 0.65
    }
  ]
}
```

---

## 🔧 설정 커스터마이징

### sites.yaml 수정

```yaml
# 더 많은 뉴스 소스 추가
bloomberg:
  base_url: "https://www.bloomberg.com"
  seed_urls:
    - "https://www.bloomberg.com/markets"

reuters:
  base_url: "https://www.reuters.com"
  seed_urls:
    - "https://www.reuters.com/business"
```

### 크롤링 설정 (run_integrated_crawler.py)

```python
config = CrawlConfig(
    max_total=50,     # 더 많은 기사 수집
    max_depth=3,      # 더 깊은 크롤링
    same_domain_only=True,
)
```

---

## 📈 다음 단계

1. **테스트 실행**
   ```bash
   pytest tests/
   ```

2. **프로덕션 배포**
   - 상세 가이드: [DEPLOYMENT.md](DEPLOYMENT.md)
   - PostgreSQL 설정
   - Nginx + Gunicorn
   - Systemd 서비스

3. **성능 향상**
   - Spacy 설치: `pip install spacy && python -m spacy download en_core_web_sm`
   - FinBERT 설치: `pip install transformers torch`
   - Redis 캐싱 설정

---

## ❓ 문제 해결

### "모듈을 찾을 수 없습니다"

```bash
pip install -r requirements_minimal.txt
```

### "데이터베이스 연결 오류"

```bash
python scripts/init_db.py --reset
```

### "포트 8000이 사용 중"

```bash
# 다른 포트 사용
uvicorn app.main:app --port 8080
```

---

## 📚 추가 문서

- [README.md](README.md) - 전체 프로젝트 개요
- [DEPLOYMENT.md](DEPLOYMENT.md) - 상세 배포 가이드
- [USAGE.md](USAGE.md) - 사용 방법

---

## 🎯 요약

```bash
# 1. 설치
pip install -r requirements_minimal.txt

# 2. 초기화
python scripts/init_db.py

# 3. 검증
python scripts/verify_system.py

# 4. 크롤링
python run_integrated_crawler.py

# 5. API 시작
python -m app.main
```

**완료! 이제 http://localhost:8000/docs에서 API를 사용할 수 있습니다.**

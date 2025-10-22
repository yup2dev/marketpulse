# StockNow.ai 스타일 뉴스 크롤러

실시간 금융 뉴스를 수집하고 관련 종목(Ticker)을 자동 추출하는 크롤러 시스템

## 📋 목차
- [프로젝트 개요](#프로젝트-개요)
- [주요 기능](#주요-기능)
- [시스템 아키텍처](#시스템-아키텍처)
- [설치 방법](#설치-방법)
- [사용 방법](#사용-방법)
- [데이터 구조](#데이터-구조)
- [구현 상세](#구현-상세)
- [API 문서](#api-문서)

---

## 🎯 프로젝트 개요

StockNow.ai와 유사한 기능을 제공하는 금융 뉴스 크롤러:
- 실시간 금융 뉴스 수집
- 뉴스에서 관련 종목 티커 자동 추출
- 종목별/시간별 뉴스 분류
- 감성 분석 및 영향도 평가

## ✨ 주요 기능

### 1. 뉴스 크롤링
- ✅ 다중 소스 지원 (Bloomberg, Reuters, CNBC, WSJ, etc.)
- ✅ RSS 피드 및 HTML 파싱
- ✅ 실시간 업데이트 (5분 간격)
- ✅ 중복 제거 및 데이터 정규화

### 2. 티커 추출
- ✅ 명시적 티커 인식 ($AAPL, (TSLA))
- ✅ 회사명 → 티커 매핑
- ✅ NER 기반 회사명 추출
- ✅ 컨텍스트 기반 관련도 점수

### 3. 데이터 분석
- ✅ 감성 분석 (긍정/부정/중립)
- ✅ 뉴스 중요도 평가
- ✅ 종목 멘션 빈도 추적
- ✅ 실시간 트렌딩 종목 감지

### 4. API 제공
- ✅ RESTful API
- ✅ WebSocket 실시간 스트리밍
- ✅ 종목별/시간별 필터링
- ✅ 페이지네이션

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
│  (Scrapy/BS4)   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Ticker Extractor│
│  (NER/Regex)    │
└────────┬────────┘
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
│ (PostgreSQL)    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   REST API      │
│  (FastAPI)      │
└─────────────────┘
```

---

## 🚀 설치 방법

### 요구사항
- Python 3.9+
- PostgreSQL 14+
- Redis (선택사항, 캐싱용)

### 설치 단계

```bash
# 1. 저장소 클론
git clone https://github.com/yourusername/stocknow-crawler.git
cd stocknow-crawler

# 2. 가상환경 생성
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# 3. 의존성 설치
pip install -r requirements.txt

# 4. 환경 변수 설정
cp .env.example .env
# .env 파일 편집하여 API 키 등 설정

# 5. 데이터베이스 초기화
python scripts/init_db.py

# 6. 티커 매핑 데이터 다운로드
python scripts/download_ticker_data.py
```

### requirements.txt
```txt
# 크롤링
scrapy>=2.11.0
beautifulsoup4>=4.12.0
newspaper3k>=0.2.8
feedparser>=6.0.10
selenium>=4.15.0

# NLP & 텍스트 분석
spacy>=3.7.0
transformers>=4.35.0
torch>=2.1.0
nltk>=3.8.1

# 데이터 처리
pandas>=2.1.0
numpy>=1.26.0

# 데이터베이스
psycopg2-binary>=2.9.9
sqlalchemy>=2.0.23
alembic>=1.12.1

# API
fastapi>=0.104.0
uvicorn>=0.24.0
pydantic>=2.5.0

# 유틸리티
python-dotenv>=1.0.0
requests>=2.31.0
aiohttp>=3.9.0
redis>=5.0.0
celery>=5.3.4

# 금융 데이터
yfinance>=0.2.32
```

---

## 💻 사용 방법

### 1. 크롤러 실행

```bash
# 전체 크롤러 실행
python run_crawler.py

# 특정 소스만 크롤링
python run_crawler.py --sources bloomberg,reuters

# 특정 종목만 모니터링
python run_crawler.py --tickers AAPL,TSLA,NVDA
```

### 2. API 서버 실행

```bash
# 개발 모드
uvicorn app.main:app --reload --port 8000

# 프로덕션 모드
gunicorn app.main:app -w 4 -k uvicorn.workers.UvicornWorker
```

### 3. Python 라이브러리로 사용

```python
from stocknow_crawler import NewsCrawler, TickerExtractor

# 크롤러 초기화
crawler = NewsCrawler(sources=['bloomberg', 'reuters'])

# 뉴스 수집
news_items = crawler.fetch_latest(hours=24)

# 티커 추출
extractor = TickerExtractor()
for news in news_items:
    tickers = extractor.extract(news['text'])
    news['tickers'] = tickers
```

---

## 📊 데이터 구조

### 뉴스 아이템 스키마

```json
{
  "id": "uuid-string",
  "url": "https://example.com/article",
  "title": "Apple announces new iPhone",
  "summary": "Apple Inc. unveiled...",
  "content": "Full article text...",
  "source": "bloomberg",
  "author": "John Doe",
  "published_at": "2025-10-22T10:30:00Z",
  "crawled_at": "2025-10-22T10:35:00Z",
  "tickers": [
    {
      "symbol": "AAPL",
      "name": "Apple Inc.",
      "exchange": "NASDAQ",
      "confidence": 0.95,
      "mention_count": 5
    }
  ],
  "sentiment": {
    "score": 0.75,
    "label": "positive",
    "confidence": 0.88
  },
  "keywords": ["iphone", "apple", "technology"],
  "category": "technology",
  "importance_score": 8.5
}
```

### 데이터베이스 스키마

```sql
-- 뉴스 테이블
CREATE TABLE news_articles (
    id UUID PRIMARY KEY,
    url TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    summary TEXT,
    content TEXT,
    source VARCHAR(50),
    author VARCHAR(255),
    published_at TIMESTAMP,
    crawled_at TIMESTAMP DEFAULT NOW(),
    sentiment_score FLOAT,
    sentiment_label VARCHAR(20),
    importance_score FLOAT,
    category VARCHAR(50),
    created_at TIMESTAMP DEFAULT NOW()
);

-- 티커 테이블
CREATE TABLE tickers (
    symbol VARCHAR(10) PRIMARY KEY,
    name TEXT NOT NULL,
    exchange VARCHAR(20),
    sector VARCHAR(50),
    industry VARCHAR(100)
);

-- 뉴스-티커 관계 테이블
CREATE TABLE news_tickers (
    id SERIAL PRIMARY KEY,
    news_id UUID REFERENCES news_articles(id),
    ticker_symbol VARCHAR(10) REFERENCES tickers(symbol),
    confidence FLOAT,
    mention_count INT,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(news_id, ticker_symbol)
);

-- 인덱스
CREATE INDEX idx_published_at ON news_articles(published_at DESC);
CREATE INDEX idx_ticker_symbol ON news_tickers(ticker_symbol);
CREATE INDEX idx_sentiment ON news_articles(sentiment_score);
```

---

## 🔧 구현 상세

### 1. 뉴스 크롤러 (`crawler/news_crawler.py`)

```python
import feedparser
from newspaper import Article
from typing import List, Dict

class NewsCrawler:
    def __init__(self, sources: List[str]):
        self.sources = sources
        self.rss_feeds = {
            'bloomberg': 'https://www.bloomberg.com/feeds/...',
            'reuters': 'https://www.reuters.com/rssfeed/...',
            'cnbc': 'https://www.cnbc.com/id/.../device/rss/',
        }
    
    def fetch_rss(self, source: str) -> List[Dict]:
        """RSS 피드에서 뉴스 가져오기"""
        feed_url = self.rss_feeds.get(source)
        feed = feedparser.parse(feed_url)
        
        articles = []
        for entry in feed.entries:
            article = {
                'url': entry.link,
                'title': entry.title,
                'summary': entry.get('summary', ''),
                'published_at': entry.get('published', ''),
                'source': source
            }
            articles.append(article)
        
        return articles
    
    def extract_full_content(self, url: str) -> str:
        """전체 기사 내용 추출"""
        article = Article(url)
        article.download()
        article.parse()
        return article.text
```

### 2. 티커 추출기 (`extractor/ticker_extractor.py`)

```python
import re
import spacy
from typing import List, Dict, Set
import yfinance as yf

class TickerExtractor:
    def __init__(self):
        self.nlp = spacy.load("en_core_web_sm")
        self.ticker_db = self._load_ticker_database()
        self.company_to_ticker = self._build_company_map()
    
    def extract(self, text: str) -> List[Dict]:
        """텍스트에서 티커 추출"""
        tickers = set()
        
        # 1. 명시적 티커 패턴
        explicit = self._extract_explicit_tickers(text)
        tickers.update(explicit)
        
        # 2. 회사명에서 추출
        companies = self._extract_companies(text)
        for company in companies:
            ticker = self.company_to_ticker.get(company.lower())
            if ticker:
                tickers.add(ticker)
        
        # 3. 검증 및 상세 정보 추가
        result = []
        for ticker in tickers:
            info = self._get_ticker_info(ticker)
            if info:
                info['mention_count'] = text.upper().count(ticker)
                result.append(info)
        
        return result
    
    def _extract_explicit_tickers(self, text: str) -> Set[str]:
        """명시적 티커 패턴 추출"""
        patterns = [
            r'\$([A-Z]{1,5})\b',  # $AAPL
            r'\(([A-Z]{2,5})\)',   # (AAPL)
            r'(?:NYSE|NASDAQ):([A-Z]{1,5})',  # NASDAQ:AAPL
        ]
        
        tickers = set()
        for pattern in patterns:
            matches = re.findall(pattern, text)
            # 잘못된 매칭 필터링
            valid = [m for m in matches if m not in 
                    ['USA', 'UK', 'EU', 'CEO', 'CFO']]
            tickers.update(valid)
        
        return tickers
    
    def _extract_companies(self, text: str) -> List[str]:
        """NER로 회사명 추출"""
        doc = self.nlp(text)
        companies = [ent.text for ent in doc.ents 
                    if ent.label_ == "ORG"]
        return companies
    
    def _get_ticker_info(self, symbol: str) -> Dict:
        """티커 상세 정보 가져오기"""
        try:
            ticker = yf.Ticker(symbol)
            info = ticker.info
            return {
                'symbol': symbol,
                'name': info.get('longName', ''),
                'exchange': info.get('exchange', ''),
                'confidence': 0.9  # 검증된 티커
            }
        except:
            return None
```

### 3. 감성 분석기 (`analyzer/sentiment_analyzer.py`)

```python
from transformers import pipeline
from typing import Dict

class SentimentAnalyzer:
    def __init__(self):
        # 금융 특화 모델 사용
        self.model = pipeline(
            "sentiment-analysis",
            model="ProsusAI/finbert"
        )
    
    def analyze(self, text: str) -> Dict:
        """텍스트 감성 분석"""
        result = self.model(text[:512])[0]  # 토큰 제한
        
        return {
            'label': result['label'].lower(),
            'score': result['score'],
            'confidence': result['score']
        }
    
    def analyze_ticker_context(self, text: str, ticker: str) -> Dict:
        """특정 티커에 대한 컨텍스트 감성 분석"""
        # 티커 주변 문장 추출
        sentences = text.split('.')
        relevant = [s for s in sentences if ticker in s.upper()]
        
        if not relevant:
            return self.analyze(text)
        
        context = '. '.join(relevant)
        return self.analyze(context)
```

### 4. FastAPI 서버 (`app/main.py`)

```python
from fastapi import FastAPI, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Optional
from datetime import datetime, timedelta
import uvicorn

app = FastAPI(title="StockNow API", version="1.0.0")

# CORS 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/news")
async def get_news(
    tickers: Optional[str] = Query(None),
    hours: int = Query(24, ge=1, le=168),
    limit: int = Query(50, ge=1, le=200),
    sentiment: Optional[str] = Query(None),
):
    """뉴스 조회 API"""
    # 데이터베이스 쿼리
    query = NewsArticle.query
    
    # 시간 필터
    start_time = datetime.utcnow() - timedelta(hours=hours)
    query = query.filter(NewsArticle.published_at >= start_time)
    
    # 티커 필터
    if tickers:
        ticker_list = tickers.split(',')
        query = query.join(NewsTicker).filter(
            NewsTicker.ticker_symbol.in_(ticker_list)
        )
    
    # 감성 필터
    if sentiment:
        query = query.filter(NewsArticle.sentiment_label == sentiment)
    
    # 정렬 및 제한
    results = query.order_by(
        NewsArticle.published_at.desc()
    ).limit(limit).all()
    
    return [article.to_dict() for article in results]

@app.get("/api/tickers/{symbol}/news")
async def get_ticker_news(
    symbol: str,
    hours: int = Query(24, ge=1, le=168)
):
    """특정 종목의 뉴스 조회"""
    # 구현...
    pass

@app.get("/api/trending")
async def get_trending_tickers(
    hours: int = Query(24, ge=1, le=168),
    limit: int = Query(10, ge=1, le=50)
):
    """트렌딩 종목 조회"""
    # 구현...
    pass

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
```

---

## 📡 API 문서

### 엔드포인트

#### `GET /api/news`
최신 뉴스 조회

**Query Parameters:**
- `tickers` (string, optional): 쉼표로 구분된 티커 목록
- `hours` (int, default: 24): 조회 기간 (시간)
- `limit` (int, default: 50): 결과 개수 제한
- `sentiment` (string, optional): 감성 필터 (positive/negative/neutral)

**Response:**
```json
[
  {
    "id": "...",
    "title": "...",
    "tickers": [...],
    "sentiment": {...}
  }
]
```

#### `GET /api/tickers/{symbol}/news`
특정 종목 뉴스 조회

#### `GET /api/trending`
트렌딩 종목 조회

#### `WebSocket /ws/news`
실시간 뉴스 스트림

---

## 🔍 데이터 소스

### 지원 뉴스 소스
- Bloomberg
- Reuters
- CNBC
- Wall Street Journal
- Financial Times
- MarketWatch
- Seeking Alpha
- Yahoo Finance

### RSS 피드 URL
```python
RSS_FEEDS = {
    'bloomberg': 'https://www.bloomberg.com/feeds/...',
    'reuters': 'https://www.reuters.com/rssfeed/...',
    'cnbc': 'https://www.cnbc.com/id/.../device/rss/',
    # ... 더 많은 소스
}
```

---

## ⚙️ 설정

### 환경 변수 (.env)

```bash
# 데이터베이스
DATABASE_URL=postgresql://user:password@localhost:5432/stocknow

# Redis (캐싱)
REDIS_URL=redis://localhost:6379/0

# API 키
ALPHA_VANTAGE_KEY=your_key_here
FINNHUB_API_KEY=your_key_here

# 크롤러 설정
CRAWL_INTERVAL=300  # 초
MAX_WORKERS=10
USER_AGENT=Mozilla/5.0...

# NLP 모델
SPACY_MODEL=en_core_web_sm
SENTIMENT_MODEL=ProsusAI/finbert
```

---

## 📈 성능 최적화

### 1. 캐싱
```python
from functools import lru_cache
import redis

redis_client = redis.from_url(REDIS_URL)

@lru_cache(maxsize=1000)
def get_ticker_info(symbol: str):
    # 캐시된 티커 정보 반환
    pass
```

### 2. 비동기 크롤링
```python
import asyncio
import aiohttp

async def fetch_multiple_sources():
    async with aiohttp.ClientSession() as session:
        tasks = [fetch_source(session, url) for url in urls]
        return await asyncio.gather(*tasks)
```

### 3. 데이터베이스 인덱싱
```sql
CREATE INDEX idx_composite ON news_articles(published_at, sentiment_score);
CREATE INDEX idx_ticker_news ON news_tickers(ticker_symbol, created_at);
```

---

## 🧪 테스트

```bash
# 단위 테스트
pytest tests/unit/

# 통합 테스트
pytest tests/integration/

# 커버리지 확인
pytest --cov=app tests/
```

---

## 📝 라이센스

MIT License

---

## 🤝 기여하기

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📧 문의

문제가 발생하면 Issues 탭에 등록해주세요.
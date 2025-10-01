# 📊 AI Analyst Report Generator

> **뉴스 기사 수집 → 차트 분석 → 상관관계 분석 → 애널리스트급 리포트 자동 생성**

조회 기간과 종목(티커)을 지정하면, 관련 기사/리포트를 모아 **요약·핵심 키워드·차트 분석·목표주가·전망·상관관계 분석**을 한 번에 보여주는 **AI 애널리스트 시스템**

---

## 🎯 최종 목표

```
"NVDA가 10% 상승했어요"
    ↓
[AI 분석]
• AMD와 0.82 상관관계 → +8.5% 예상
• TSM과 0.75 상관관계 → +7.2% 예상
• 반도체 섹터 전체 강세 전망
• 차트 패턴: 상승 추세 돌파, 목표가 $180
• 주요 브로커 목표가: $160~$200
• 긍정 기사 85%, 부정 5%, 중립 10%
```

**→ 데이터 간 인과관계를 추론하여 애널리스트처럼 시황을 분석**

---

## 🏗️ 시스템 아키텍처

```
┌─────────────────────────────────────────────────────────────┐
│              📄 Analyst Report Generator                     │
│   "A 데이터 움직임 → B 데이터 예측" 인과관계 추론           │
└─────────────────────────────────────────────────────────────┘
                            ▲
        ┌───────────────────┼───────────────────┐
        │                   │                   │
┌───────▼────────┐  ┌───────▼────────┐  ┌──────▼──────┐
│ 상관관계 분석   │  │ 목표주가 집계   │  │ 시황 요약    │
│ (Correlation)  │  │ (Target Price) │  │ (Outlook)   │
└───────┬────────┘  └───────┬────────┘  └──────┬──────┘
        │                   │                   │
        └───────────────────┼───────────────────┘
                            ▲
        ┌───────────────────┼───────────────────┐
        │                   │                   │
┌───────▼────────┐  ┌───────▼────────┐  ┌──────▼──────┐
│ 기사 NLP 분석  │  │ 차트 이미지 분석│  │ 시계열 데이터│
│ (Text Mining)  │  │ (OCR/Vision)   │  │ (OHLCV)     │
└───────┬────────┘  └───────┬────────┘  └──────┬──────┘
        │                   │                   │
        └───────────────────┼───────────────────┘
                            ▲
        ┌───────────────────┼───────────────────┐
        │                   │                   │
┌───────▼────────┐  ┌───────▼────────┐  ┌──────▼──────┐
│ Multi-Seed     │  │ Image Downloader│  │ SQLite DB   │
│ Crawler (BFS)  │  │ + Storage       │  │ + Cache     │
└────────────────┘  └─────────────────┘  └─────────────┘
```

---

## ✨ 핵심 기능

### 📌 현재 구현
- [x] **멀티 시드 BFS 크롤러**: `sites.yaml` 기반 다중 사이트 수집
- [x] **URL 분류기**: 카테고리/기사 구분 (휴리스틱 + 패턴 매칭)
- [x] **HTML 파서**: 제목/발행일/본문/이미지 추출
- [x] **경량 NLP 분석**: 토크나이징, 요약, 키워드, 감성분석
- [x] **엔티티 매핑**: 기업/원자재/매크로 지표 → 티커 매핑
- [x] **마켓 데이터 수집**: yfinance + TradingView 연동

### 🚀 Phase 1: 이미지 & 차트 분석
- [ ] **이미지 다운로더**: 차트/그래프 로컬 저장 (병렬 다운로드)
- [ ] **OCR 분석**: Tesseract로 차트 내 텍스트/수치 추출
- [ ] **차트 패턴 인식**: 캔들스틱/라인차트/바차트 구분
- [ ] **Vision API 연동** (선택): GPT-4V/Claude로 차트 해석
- [ ] **메타데이터 저장**: 추출 데이터 JSON/DB 저장

### 🔥 Phase 2: 지능형 분석
- [ ] **목표주가 추출기**: 정규식 + NER로 브로커 목표가 탐지
- [ ] **상관관계 엔진**: 피어슨/스피어만 상관계수 계산
- [ ] **인과관계 추론**: Granger Causality + Rule-based 예측
  - *"CPI 상승 → 금리 인상 → 테크주 하락"*
  - *"NVDA 상승 → AMD/TSM 동반 상승 (섹터 효과)"*
- [ ] **섹터 분석**: 리더주 → 팔로워주 전이 효과
- [ ] **매크로 링커**: 금리/CPI/고용지표 → 주가 영향 분석

### 📊 Phase 3: 리포트 생성
- [ ] **Analyst Report Generator**: 종합 리포트 자동 생성
  - 요약문 (Executive Summary)
  - 목표주가 컨센서스
  - 핵심 인사이트 (Valuation/Momentum/Risk/Catalyst)
  - 상관관계 분석표
  - 영향 예측 (Impact Predictions)
- [ ] **차트 생성기**: matplotlib/plotly로 시각화
- [ ] **PDF 출력**: 전문가급 리포트 PDF 생성
- [ ] **템플릿 엔진**: HTML/CSS 커스터마이징

### 🗄️ Phase 4: 데이터베이스 & 캐싱
- [ ] **SQLite/PostgreSQL**: 기사/이미지/목표주가 저장
- [ ] **중복 제거**: URL 기반 + 임베딩 유사도
- [ ] **캐시 레이어**: Redis/Memcached (HTML, 분석 결과)
- [ ] **시계열 쿼리**: 기간별/종목별 필터링 최적화

### ⚡ Phase 5: 성능 & API
- [ ] **비동기 크롤링**: `httpx` + `asyncio`로 10배 속도 개선
- [ ] **FastAPI 서버**: REST API 제공
  - `GET /api/analyze?symbol=NVDA&from=2025-09-01&to=2025-09-30`
  - `GET /api/correlations?symbol=NVDA`
  - `GET /api/report/{symbol}/pdf`
- [ ] **대시보드**: 종목별 카드 UI (React/Vue)
- [ ] **스케줄링**: 매일 자동 크롤링 (Celery/APScheduler)

---

## 📂 프로젝트 구조

```
index_analyzer/
├── models/                         # 데이터 모델
│   ├── schemas.py                  # ArticleResult, SiteConfig
│   ├── report.py                   # AnalystReport, Insight
│   └── chart_data.py               # ChartMetadata, ImageAnalysisResult
│
├── crawling/                       # 크롤링 엔진
│   ├── http_client.py              # HttpClient
│   ├── crawler.py                  # Crawler, Frontier (BFS)
│   ├── url_classifier.py           # URLClassifier (카테고리/기사 구분)
│   └── async_crawler.py            # AsyncCrawler (Phase 5)
│
├── parsing/                        # HTML 파싱
│   ├── parser.py                   # Parser (제목/본문/이미지 추출)
│   └── heuristics.py               # ArticleHeuristics
│
├── media/                          # 이미지/차트 처리
│   ├── image_downloader.py         # 이미지 다운로드 & 저장
│   ├── image_analyzer.py           # OCR + 차트 패턴 분석
│   └── vision_api.py               # GPT-4V/Claude Vision 연동 (선택)
│
├── analysis/                       # 텍스트 분석
│   ├── nlp.py                      # NLPAnalyzer (토크나이징, 요약)
│   ├── entity_mapper.py            # EntityMapper (티커 매핑)
│   ├── sentiment.py                # Sentiment 분석
│   └── keyword_extractor.py        # 키워드/토픽 추출
│
├── data/                           # 마켓 데이터
│   ├── market_hub.py               # MarketDataHub (통합 API)
│   ├── data_planner.py             # RelatedDataPlanner
│   ├── yahoo_provider.py           # YahooProvider
│   └── tradingview_provider.py     # TradingViewProvider
│
├── extraction/                     # 정보 추출
│   ├── target_price.py             # 목표주가 추출
│   ├── outlook.py                  # 전망 요약
│   └── metrics_extractor.py        # 재무지표 추출
│
├── intelligence/                   # 🧠 핵심 분석 엔진
│   ├── correlation_engine.py       # 상관관계 분석 (Pearson/Spearman)
│   ├── causality_inference.py      # 인과관계 추론 (Granger + Rule-based)
│   ├── sector_analyzer.py          # 섹터 전이 효과 분석
│   └── macro_linker.py             # 매크로 지표 → 주가 영향
│
├── report/                         # 📊 리포트 생성
│   ├── analyst_report.py           # AnalystReportGenerator
│   ├── chart_generator.py          # matplotlib/plotly 차트
│   ├── pdf_generator.py            # PDF 출력 (ReportLab/WeasyPrint)
│   └── templates/                  # 리포트 템플릿
│       ├── report_template.html
│       └── styles.css
│
├── storage/                        # 데이터 저장
│   ├── article_repo.py             # ArticleRepository (CRUD)
│   ├── image_store.py              # 이미지 파일 관리
│   ├── cache.py                    # Redis/Memcached
│   └── db.py                       # SQLAlchemy Models
│
├── filtering/                      # 필터링
│   └── symbol_filter.py            # Symbol 모드 필터
│
├── config/                         # 설정 관리
│   ├── settings.py                 # Pydantic Settings
│   └── loader.py                   # ConfigLoader (sites.yaml)
│
├── pipeline.py                     # 통합 파이프라인
├── cli.py                          # CLI 진입점
├── api.py                          # FastAPI 서버 (Phase 5)
├── app.py                          # 메인 실행 파일
├── sites.yaml                      # 크롤링 대상 사이트 설정
├── requirements.txt                # 의존성
└── README.md                       # 이 파일
```

---

## 🚀 빠른 시작

### 1. 설치

```bash
# 1) 가상환경 생성
python -m venv .venv

# 2) 활성화
.venv\Scripts\activate      # Windows
source .venv/bin/activate   # macOS/Linux

# 3) 의존성 설치
pip install -r requirements.txt

# 4) (선택) TradingView 연동
set TV_USERNAME=your_id
set TV_PASSWORD=your_password

# 5) (선택) Tesseract OCR 설치 (차트 분석용)
# Windows: https://github.com/UB-Mannheim/tesseract/wiki
# macOS: brew install tesseract
# Ubuntu: sudo apt-get install tesseract-ocr
```

### 2. 설정 (sites.yaml)

```yaml
bbc:
  base_url: "https://www.bbc.com"
  seed_urls:
    - "https://www.bbc.com/news"
  article_allow:
    - "/news/|/article/|/story"
  article_deny:
    - "/video|/photo|/gallery"

bloomberg:
  base_url: "https://www.bloomberg.com"
  seed_urls:
    - "https://www.bloomberg.com/markets"
  article_allow: []
  article_deny:
    - "/videos|/photos"
```

### 3. 실행

#### 📌 기본 크롤링 & 요약
```bash
python app.py crawl \
  --sites-config ./sites.yaml \
  --max-total 40 \
  --max-depth 3 \
  --sleep 1 \
  --topk 10 \
  --summary-sents 3 \
  --window-days 7 \
  --out news_output.json
```

#### 🎯 Symbol 분석 모드 (핵심 기능)
```bash
python app.py analyze-symbol \
  --symbol NVDA \
  --from 2025-09-01 \
  --to 2025-09-30 \
  --output nvda_report.pdf \
  --format pdf
```

**출력 예시:**
```
✓ 크롤링: 234개 기사 수집
✓ 필터링: NVDA 관련 45개 기사
✓ 이미지 다운로드: 89개 차트/이미지
✓ OCR 분석: 차트 데이터 추출 완료
✓ 상관관계 분석: AMD(0.82), TSM(0.75), INTC(0.54)
✓ 영향 예측: NVDA 상승 → AMD +3.2% (신뢰도 78%)
✓ 리포트 생성: nvda_report.pdf (2.4MB)
```

#### 🔍 상관관계 분석
```bash
python app.py correlation \
  --symbol NVDA \
  --candidates AMD,TSM,INTC,SMCI \
  --from 2025-01-01 \
  --to 2025-09-30
```

#### 📊 차트 분석
```bash
python app.py analyze-charts \
  --input-dir ./data/images \
  --output charts_analysis.json
```

---

## 📄 출력 JSON 스키마

### Symbol 모드 출력 예시
```json
{
  "symbol": "NVDA",
  "period": {
    "from": "2025-09-01",
    "to": "2025-09-30"
  },
  "executive_summary": "엔비디아는 9월 중 AI 수요 강세로 +12.5% 상승. 주요 브로커 목표가 평균 $175, 반도체 섹터 전체 강세 전망. AMD/TSM과 강한 양의 상관관계(0.8+)로 동반 상승 가능성 높음.",
  "sentiment": {
    "score": 0.78,
    "distribution": {"positive": 38, "neutral": 7, "negative": 3}
  },
  "target_prices": [
    {
      "value": 180.0,
      "currency": "USD",
      "broker": "Goldman Sachs",
      "date": "2025-09-15",
      "context": "AI accelerator demand..."
    },
    {
      "value": 170.0,
      "currency": "USD",
      "broker": "Morgan Stanley",
      "date": "2025-09-18"
    }
  ],
  "key_insights": [
    {
      "category": "catalyst",
      "title": "B100 칩 출시 임박",
      "description": "차세대 GPU B100이 2025년 Q4 출시 예정, 시장 점유율 확대 기대",
      "confidence": 0.85,
      "sources": ["https://..."]
    }
  ],
  "correlations": [
    {
      "symbol_a": "NVDA",
      "symbol_b": "AMD",
      "correlation": 0.82,
      "p_value": 0.001,
      "strength": "strong"
    }
  ],
  "impact_predictions": [
    {
      "source": "NVDA",
      "target": "AMD",
      "expected_direction": "up",
      "confidence": 0.78,
      "lag_days": 1,
      "reasoning": "NVDA 상승 → 반도체 섹터 전체 강세"
    }
  ],
  "charts": [
    "./data/images/nvda_20250915_abc123.png",
    "./data/images/nvda_chart_xyz789.png"
  ],
  "chart_analysis": [
    {
      "path": "./data/images/nvda_20250915_abc123.png",
      "chart_type": "candlestick",
      "extracted_text": "NVDA Stock Price Sep 2025\n$120 $140 $160",
      "detected_values": [120.0, 140.0, 160.0],
      "trend": "upward",
      "pattern": "breakout"
    }
  ],
  "articles": [
    {
      "url": "https://...",
      "title": "Nvidia Earnings Beat Expectations",
      "published_at": "2025-09-20T10:00:00Z",
      "summary": "...",
      "sentiment": "positive",
      "top_words": [["nvidia", 15], ["ai", 12], ["gpu", 10]]
    }
  ],
  "generated_at": "2025-09-30T23:59:59Z"
}
```

---

## 🧪 개발 팁

### 로깅
```python
import logging
log = logging.getLogger("index_analyzer")
log.setLevel(logging.DEBUG)  # INFO → DEBUG
```

### 테스트
```bash
# 단위 테스트
pytest tests/unit/

# 통합 테스트
pytest tests/integration/

# 커버리지
pytest --cov=index_analyzer tests/
```

### 슬러그 튜닝
특정 사이트의 카테고리 페이지가 기사로 오분류되면:
```python
# index_analyzer/crawling/url_classifier.py
CategoryPolicy(
    category_slugs={
        "world", "news", "business", "markets",
        "your-custom-section"  # 추가
    }
)
```

---

## 🗺️ 로드맵

### ✅ Phase 0: 기본 인프라 (완료)
- [x] 멀티 시드 크롤러
- [x] URL 분류기
- [x] HTML 파서
- [x] 경량 NLP 분석
- [x] 마켓 데이터 수집

### 🚧 Phase 1: 이미지 & 차트 분석 (진행중)
- [ ] 이미지 다운로더 + 저장소
- [ ] OCR 분석 (Tesseract)
- [ ] 차트 패턴 인식
- [ ] Vision API 연동 (선택)

### 📅 Phase 2: 지능형 분석 (예정)
- [ ] 목표주가 추출기 (정규식 + NER)
- [ ] 상관관계 엔진 (Pearson/Spearman)
- [ ] 인과관계 추론 (Granger Causality)
- [ ] 섹터 전이 효과 분석

### 📅 Phase 3: 리포트 생성 (예정)
- [ ] Analyst Report Generator
- [ ] 차트 생성기 (matplotlib/plotly)
- [ ] PDF 출력 (ReportLab)
- [ ] 템플릿 엔진

### 📅 Phase 4: 데이터베이스 (예정)
- [ ] SQLite/PostgreSQL 연동
- [ ] 중복 제거 (임베딩 기반)
- [ ] 캐시 레이어 (Redis)
- [ ] 시계열 쿼리 최적화

### 📅 Phase 5: API & 대시보드 (예정)
- [ ] FastAPI REST API
- [ ] 비동기 크롤링 (`httpx`)
- [ ] React/Vue 대시보드
- [ ] 스케줄링 (Celery)

---

## 🧠 핵심 알고리즘

### 1. 상관관계 분석 (Correlation Engine)
```python
from scipy.stats import pearsonr

# 두 종목 간 피어슨 상관계수 계산
corr, p_value = pearsonr(nvda_prices, amd_prices)
# corr=0.82 → 강한 양의 상관관계
```

### 2. 인과관계 추론 (Causality Inference)
```python
# Rule-based + Granger Causality
if nvda_change > 5%:
    predict_amd_change = nvda_change * 0.82  # 상관계수 기반
    confidence = 0.78
```

### 3. 목표주가 추출
```python
# 정규식 패턴
pattern = r"(목표\s*주가|target\s*price|TP)\s*[:：]?\s*\$?\s?([0-9][0-9,\.]*)"
matches = re.findall(pattern, article_text, re.I)
# → [("target price", "180"), ("TP", "170")]
```

### 4. 차트 OCR
```python
import pytesseract
from PIL import Image

img = Image.open("chart.png")
text = pytesseract.image_to_string(img)
# → "NVDA Stock Price\n$120 $140 $160"
numbers = re.findall(r'[\d,]+\.?\d*', text)
# → ["120", "140", "160"]
```

---

## 🔒 주의사항

- **크롤링 정책**: 각 사이트의 `robots.txt` 및 이용약관 준수 필수
- **API 제한**: yfinance/TradingView 요청 횟수 제한 주의
- **데이터 정확성**: 본 시스템은 참고용이며, 투자 결정은 사용자 책임
- **라이선스**: 교육·연구용 목적

---

## 📚 참고 문서

- [yfinance 문서](https://pypi.org/project/yfinance/)
- [TradingView Datafeed](https://github.com/StreamAlpha/tvdatafeed)
- [BeautifulSoup 문서](https://www.crummy.com/software/BeautifulSoup/bs4/doc/)
- [Tesseract OCR](https://github.com/tesseract-ocr/tesseract)
- [FastAPI 문서](https://fastapi.tiangolo.com/)

---

## 🤝 기여

이슈 제보 및 PR 환영합니다!

```bash
# Fork & Clone
git clone https://github.com/your-username/index_analyzer.git

# 브랜치 생성
git checkout -b feature/new-feature

# 커밋 & 푸시
git commit -m "Add: 새 기능 추가"
git push origin feature/new-feature

# Pull Request 생성
```

---

## 📜 라이선스

MIT License

---

## 📧 문의

- **이슈**: [GitHub Issues](https://github.com/your-username/index_analyzer/issues)
- **이메일**: your-email@example.com

---

**Made with ❤️ for Financial Analysts**
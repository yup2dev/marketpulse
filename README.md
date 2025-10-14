# 📰 Multi-Thread News Crawler

> **멀티스레드 BFS 방식으로 뉴스 기사 본문과 차트 이미지를 수집하는 전문 크롤러**

경제/금융 뉴스 사이트에서 기사 본문만 선별적으로 크롤링하고, 차트/그래프 이미지를 자동으로 수집합니다.

---

## 🎯 핵심 기능

### ✅ 구현 완료

- **멀티스레드 BFS 크롤러**: 여러 seed URL을 동시에 병렬 탐색
- **URL 분류기**: 기사 본문과 메뉴/카테고리 자동 구분
  - 본문만 크롤링 (메인 메뉴, 네비게이션, 광고 페이지 제외)
  - 휴리스틱 + 패턴 매칭 방식
- **HTML 파서**: 제목, 발행일, 본문 텍스트 추출
- **차트 이미지 필터링**:
  - 차트/그래프만 선별 수집
  - 불필요한 이미지 자동 제외 (광고, 로고, 아이콘 등)
  - 경제 분야 차트 패턴 인식

---

## 🏗️ 시스템 아키텍처

```
┌─────────────────────────────────────────────┐
│          Multi-Thread BFS Crawler           │
│     병렬 크롤링 + 기사 본문 선별 수집        │
└─────────────────────────────────────────────┘
                     │
        ┌────────────┼────────────┐
        │            │            │
┌───────▼──────┐ ┌──▼────────┐ ┌─▼─────────┐
│ URL 분류기   │ │ HTML 파서 │ │차트 필터  │
│ (본문/메뉴)  │ │(메타추출) │ │(이미지)   │
└──────────────┘ └───────────┘ └───────────┘
```

---

## 📂 프로젝트 구조

```
marketpulse/
├── index_analyzer/
│   ├── models/                    # 데이터 모델
│   │   └── schemas.py             # ArticleResult, CrawlConfig
│   │
│   ├── crawling/                  # 크롤링 엔진
│   │   ├── http_client.py         # HTTP 요청
│   │   ├── multi_thread_crawler.py # 멀티스레드 BFS 크롤러
│   │   └── url_classifier.py      # URL 분류 (본문/메뉴)
│   │
│   ├── parsing/                   # HTML 파싱
│   │   ├── parser.py              # 파서 (제목/본문/이미지)
│   │   └── heuristics.py          # 휴리스틱
│   │
│   ├── config/                    # 설정
│   │   └── loader.py              # sites.yaml 로더
│   │
│   └── media/                     # 이미지 처리
│       ├── image_downloader.py    # 이미지 다운로드
│       └── image_store.py         # 저장소
│
├── sites.yaml                     # 크롤링 대상 사이트
├── requirements.txt               # 의존성
└── README.md                      # 이 파일
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
```

### 2. 설정 (sites.yaml)

```yaml
cnn:
  base_url: "https://edition.cnn.com"
  seed_urls:
    - "https://edition.cnn.com/business"

bloomberg:
  base_url: "https://www.bloomberg.com"
  seed_urls:
    - "https://www.bloomberg.com/markets"
```

### 3. 실행

```python
from index_analyzer.crawling.multi_thread_crawler import MultiThreadCrawler
from index_analyzer.crawling.url_classifier import URLClassifier
from index_analyzer.parsing.heuristics import ArticleHeuristics
from index_analyzer.models.schemas import CrawlConfig

# 설정
config = CrawlConfig(
    max_total=100,
    max_depth=3,
    same_domain_only=True,
)

# 크롤러 초기화
classifier = URLClassifier()
heuristics = ArticleHeuristics()
crawler = MultiThreadCrawler(
    config=config,
    heuristics=heuristics,
    classifier=classifier,
    max_workers=10,
)

# 크롤링 실행
seed_urls = [
    "https://edition.cnn.com/business",
    "https://www.bloomberg.com/markets",
]

results = crawler.crawl(seed_urls)

# 결과 출력
for article in results:
    print(f"Title: {article.title}")
    print(f"URL: {article.url}")
    print(f"Charts: {len(article.charts)}")
    print(f"Text preview: {article.text[:200]}...")
    print("-" * 80)
```

**출력 예시:**
```
Title: Fed Signals Rate Cut in September Amid Inflation Slowdown
URL: https://edition.cnn.com/business/fed-rate-cut-2025/index.html
Charts: 2
Text preview: The Federal Reserve signaled potential rate cuts in September as inflation shows signs of cooling. Chair Powell emphasized data-dependent approach...
--------------------------------------------------------------------------------
```

---

## 🔧 주요 컴포넌트

### 1. URL 분류기 (URLClassifier)

기사 본문과 메뉴/카테고리를 자동으로 구분합니다.

**분류 규칙:**
- **카테고리로 판단**:
  - `/world`, `/business`, `/markets` 등 메인 메뉴
  - `/menu`, `/nav`, `/sitemap` 등 네비게이션
  - `/page/1`, `?page=2` 등 페이지네이션
  - `/video`, `/gallery`, `/archive` 등 비본문 페이지

- **기사로 판단**:
  - `/2025/01/15/article-slug` (날짜 포함)
  - `/123456` (숫자 ID)
  - `long-article-slug-with-hyphens` (3개 이상 하이픈)

### 2. 차트 이미지 필터링 (Parser)

경제 분야 차트만 선별적으로 수집합니다.

**차트 판단 키워드:**
```python
chart, graph, candlestick, trading, technical, indicator,
주가, 차트, 그래프, 지표, 매매
```

**제외 패턴:**
```python
logo, icon, banner, ad, advertisement, profile,
로고, 아이콘, 광고, 배너
```

### 3. 멀티스레드 크롤러 (MultiThreadCrawler)

**특징:**
- ThreadPoolExecutor로 병렬 크롤링
- Thread-safe 큐 관리 (deque + Lock)
- BFS 방식 탐색
- 중복 URL 자동 제거

**설정 옵션:**
```python
CrawlConfig(
    max_total=200,          # 최대 크롤링 수
    max_depth=3,            # 최대 깊이
    same_domain_only=True,  # 동일 도메인만
    timeout_get=15.0,       # 요청 타임아웃
)
```

---

## 📄 출력 데이터 스키마

```python
@dataclass
class ArticleResult:
    url: str                        # 기사 URL
    title: str                      # 제목
    published_time: Optional[str]   # 발행일시
    text: str                       # 본문 텍스트
    charts: List[str]               # 차트 이미지 URL 목록
    depth: int                      # 크롤링 깊이
```

**JSON 예시:**
```json
{
  "url": "https://www.bloomberg.com/news/articles/2025-10-02/tech-stocks-rally",
  "title": "Tech Stocks Rally on AI Optimism",
  "published_time": "2025-10-02T10:30:00Z",
  "text": "Technology stocks surged on Tuesday as investors...",
  "charts": [
    "https://assets.bloomberg.com/charts/tech-rally-20251002.png",
    "https://assets.bloomberg.com/charts/nasdaq-trend.png"
  ],
  "depth": 2
}
```

---

## 🧪 개발 팁

### 로깅

```python
import logging

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
```

### URL 분류 커스터마이징

특정 사이트의 URL 패턴에 맞게 조정:

```python
from index_analyzer.crawling.url_classifier import CategoryPolicy

policy = CategoryPolicy(
    category_slugs={
        "world", "business", "markets",
        "custom-section",  # 추가
    }
)

classifier = URLClassifier(policy)
```

### 차트 키워드 추가

```python
# index_analyzer/parsing/parser.py
CHART_HINT_RE = re.compile(
    r"(chart|graph|...|your-custom-keyword)", re.I
)
```

---

## 🔒 주의사항

- **크롤링 정책**: 각 사이트의 `robots.txt` 및 이용약관 준수 필수
- **요청 제한**: 과도한 요청 방지를 위해 적절한 sleep 시간 설정
- **저작권**: 수집된 데이터는 교육/연구 목적으로만 사용
- **라이선스**: MIT License

---

## 📚 의존성

```
requests>=2.31.0          # HTTP 요청
beautifulsoup4>=4.12.0    # HTML 파싱
lxml>=5.0.0               # 빠른 파서
pyyaml>=6.0.0             # YAML 설정
Pillow>=10.0.0            # 이미지 처리
```

---

## 🤝 기여

이슈 제보 및 PR 환영합니다!

```bash
# Fork & Clone
git clone https://github.com/your-username/marketpulse.git

# 브랜치 생성
git checkout -b feature/new-feature

# 커밋 & 푸시
git commit -m "Add: 새 기능 추가"
git push origin feature/new-feature
```

---

## 📧 문의

- **GitHub Issues**: [이슈 제보](https://github.com/your-username/marketpulse/issues)

---

**Made for Financial News Analysis**

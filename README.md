# MarketPulse

금융 데이터 시각화 대시보드 - Frontend와 Backend 분리 아키텍처

## 프로젝트 구조

```
marketpulse/
├── backend/             🔧 FastAPI 백엔드 서버
├── frontend/            💻 React 프론트엔드
├── index_analyzer/      📰 뉴스 크롤러 (데몬)
├── data_fetcher/        📊 API 데이터 수집 (라이브러리)
└── marketpulse_app/     🎯 레거시 앱 (표시/분석)
```

### 1. Backend (FastAPI 서버) ⭐ NEW

FastAPI 기반 RESTful API 백엔드

**특징:**
- REST API 엔드포인트
- CORS 설정 완료
- 자동 API 문서화
- 데이터 수집 통합

**실행:**
```bash
cd backend
python -m venv venv
venv\Scripts\activate  # Windows
pip install -r requirements.txt
python run.py
```

API: http://localhost:8000
문서: http://localhost:8000/docs

### 2. Frontend (React 앱) ⭐ NEW

React 기반 대시보드 UI

**특징:**
- 드래그 앤 드롭 위젯
- 실시간 차트 시각화
- 반응형 디자인
- API 연동 완료

**실행:**
```bash
cd frontend
npm install
npm run dev
```

앱: http://localhost:5173

### 3. index_analyzer (뉴스 크롤러)

뉴스 사이트 크롤링 및 분석 파이프라인

### 4. data_fetcher (API 데이터 수집)

재사용 가능한 API 데이터 수집 라이브러리

### 5. marketpulse_app (레거시 앱)

기존 CLI 기반 데이터 표시 애플리케이션

---

## 빠른 시작 (Frontend + Backend)

### 1. Backend 실행

터미널 1:
```bash
cd backend
python -m venv venv
venv\Scripts\activate  # Windows (Linux/Mac: source venv/bin/activate)
pip install -r requirements.txt
python run.py
```

### 2. Frontend 실행

터미널 2:
```bash
cd frontend
npm install
npm run dev
```

### 3. 브라우저 접속

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:8000
- **API 문서**: http://localhost:8000/docs

## 기존 모듈 실행

### Docker Compose로 전체 실행

```bash
docker-compose up -d
docker-compose logs -f
docker-compose down
```

### 개별 프로젝트 실행

#### 크롤러 데몬
```bash
cd index_analyzer
poetry install
poetry run crawler
```

#### Data Fetcher
```bash
cd data_fetcher
poetry install
python -m data_fetcher.main short-interest TSLA
```

---

## 아키텍처

```
┌─────────────────┐
│      사용자      │
└─────────────────┘
        ↓
┌─────────────────────────────────────┐
│  marketpulse_app (메인 앱)           │
│  - CLI 인터페이스                    │
│  - 차트 생성                         │
└─────────────────────────────────────┘
    ↓                    ↓
┌──────────────┐   ┌──────────────┐
│data_fetcher  │   │Redis (뉴스)  │
│(라이브러리)   │   │              │
└──────────────┘   └──────────────┘
    ↓                    ↑
┌──────────────┐   ┌──────────────┐
│외부 API      │   │index_analyzer│
│-Yahoo        │   │(크롤러 데몬)  │
│-FRED         │   └──────────────┘
│-AlphaVantage │
└──────────────┘
```

---

## 데이터 흐름

### 뉴스 파이프라인 (index_analyzer)
```
IN (크롤링) → PROC (감정분석, 티커추출) → CALC (계산) → RCMD (추천) → Redis Stream
```

### 시장 데이터 (data_fetcher)
```
API 호출 → Standard Model 변환 → marketpulse_app → 차트/테이블
```

---

## 의존성

### 공통
- Python 3.11+
- Poetry

### 서비스
- Redis 7+
- PostgreSQL 15+

---

## 개발 가이드

### 새로운 Fetcher 추가

```python
# data_fetcher/fetchers/yahoo/new_fetcher.py
from data_fetcher.fetchers.base import Fetcher
from data_fetcher.models import NewDataModel

class YahooNewFetcher(Fetcher[NewQueryParams, NewDataModel]):
    @staticmethod
    def transform_query(params):
        return NewQueryParams(**params)

    @staticmethod
    def extract_data(query):
        # API 호출
        pass

    @staticmethod
    def transform_data(query, raw):
        return [NewDataModel(**raw)]
```

### 새로운 차트 추가

```python
# marketpulse_app/presentation/charts/new_chart.py
class NewChartGenerator:
    def generate(self, data):
        # 차트 생성 로직
        pass
```

---

## 환경 변수

### index_analyzer
```env
REDIS_URL=redis://localhost:6379
DATABASE_URL=postgresql://user:pass@localhost:5432/marketpulse
```

### data_fetcher
```env
FRED_API_KEY=your_fred_key
ALPHAVANTAGE_API_KEY=your_av_key
```

### marketpulse_app
```env
REDIS_URL=redis://localhost:6379
DATABASE_URL=postgresql://user:pass@localhost:5432/marketpulse
DATA_FETCHER_URL=http://localhost:8002  # API 모드 사용 시
```

---

## 테스트

```bash
# 각 프로젝트별 테스트
cd index_analyzer && poetry run pytest
cd data_fetcher && poetry run pytest
cd marketpulse_app && poetry run pytest
```

---

## 배포

### PyPI 배포 (data_fetcher)

```bash
cd data_fetcher
poetry build
poetry publish
```

다른 프로젝트에서 사용:
```bash
pip install data-fetcher
```

### Docker 배포

```bash
# 이미지 빌드
docker-compose build

# 배포
docker-compose push
```

---

## 문서

- [아키텍처 설명](docs/ARCHITECTURE.md)
- [프로젝트 분리 계획](docs/PROJECT_SEPARATION_PLAN.md)
- [리팩토링 검토](docs/REFACTORING_REVIEW.md)

---

## 라이선스

MIT

---

## 기여

Pull Request를 환영합니다!

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

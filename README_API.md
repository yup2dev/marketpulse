# MarketPulse API 가이드

## 개요

MarketPulse FastAPI 서버는 주식 데이터 조회, 분석, ETL 매핑 관리를 위한 REST API를 제공합니다.

## 시작하기

### 서버 실행

```bash
# 개발 모드 (자동 리로드)
python -m uvicorn app.api.app:app --host 0.0.0.0 --port 8000 --reload

# 프로덕션 모드
python -m uvicorn app.api.app:app --host 0.0.0.0 --port 8000
```

### API 문서

서버 실행 후 다음 URL에서 API 문서를 확인할 수 있습니다:

- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

## API 엔드포인트

### 1. 기본 엔드포인트

#### 루트
- **GET** `/`
- 서비스 정보 반환

#### 헬스 체크
- **GET** `/health`
- 서버 및 연결 상태 확인

---

### 2. 주식 API (`/api/stocks`)

#### 주식 목록 조회
- **GET** `/api/stocks/list`
- 파라미터:
  - `sector` (옵션): 섹터 필터
  - `limit` (기본값: 100): 최대 조회 개수

#### 종목 상세 정보
- **GET** `/api/stocks/{ticker}`
- 특정 종목의 상세 정보 조회

#### 현재 주가
- **GET** `/api/stocks/{ticker}/price`
- 실시간 주가 조회

#### 가격 히스토리
- **GET** `/api/stocks/{ticker}/history`
- 파라미터:
  - `period` (기본값: "1mo"): 조회 기간
  - `interval` (기본값: "1d"): 데이터 간격

#### 배당 이력
- **GET** `/api/stocks/{ticker}/dividends`
- 파라미터:
  - `limit` (기본값: 10): 최대 조회 개수

#### 여러 종목 현재가 일괄 조회
- **POST** `/api/stocks/quotes`
- Body: `["AAPL", "MSFT", "GOOGL"]`

#### 재무제표
- **GET** `/api/stocks/{ticker}/financials`
- 손익계산서, 대차대조표, 현금흐름표 조회

---

### 3. 분석 API (`/api/analysis`)

#### 종목 종합 분석
- **GET** `/api/analysis/{ticker}/summary`
- 최신 가격, 이동평균, RSI, 볼린저 밴드 등 종합 분석

#### 가격 변동 분석
- **GET** `/api/analysis/{ticker}/price-change`
- 파라미터:
  - `period_days` (기본값: 30): 분석 기간

#### 이동평균
- **GET** `/api/analysis/{ticker}/moving-average`
- 파라미터:
  - `period` (기본값: 20): 이동평균 기간

#### 변동성 분석
- **GET** `/api/analysis/{ticker}/volatility`
- 파라미터:
  - `period_days` (기본값: 30): 분석 기간

#### RSI
- **GET** `/api/analysis/{ticker}/rsi`
- 파라미터:
  - `period` (기본값: 14): RSI 기간

#### 볼린저 밴드
- **GET** `/api/analysis/{ticker}/bollinger-bands`
- 파라미터:
  - `period` (기본값: 20): 기간
  - `std_dev` (기본값: 2.0): 표준편차 배수

#### 섹터별 성과
- **GET** `/api/analysis/sector/performance`
- 파라미터:
  - `sector` (옵션): 섹터 필터
  - `limit` (기본값: 10): 최대 조회 개수

#### 상위/하위 성과 종목
- **GET** `/api/analysis/top-performers`
- **GET** `/api/analysis/bottom-performers`
- 파라미터:
  - `sector` (옵션): 섹터 필터
  - `limit` (기본값: 10): 최대 조회 개수

#### 종목 비교
- **POST** `/api/analysis/compare`
- Body: `["AAPL", "MSFT", "GOOGL"]` (최대 10개)

---

### 4. ETL 매핑 API (`/api/etl`)

#### 매핑 목록 조회
- **GET** `/api/etl/mappings`
- 파라미터:
  - `keyword` (옵션): 키워드 검색
  - `category` (옵션): 카테고리 필터
  - `data_source` (옵션): 데이터 소스 필터

#### 카테고리 목록
- **GET** `/api/etl/categories`

#### 데이터 소스 목록
- **GET** `/api/etl/data-sources`

#### 사용자 질의 기반 추천
- **GET** `/api/etl/search?query=미국 금리 동향`
- 자연어 질의를 분석하여 적절한 데이터 소스 추천

#### 키워드/카테고리/소스로 조회
- **GET** `/api/etl/keyword/{keyword}`
- **GET** `/api/etl/category/{category}`
- **GET** `/api/etl/source/{data_source}`

---

### 5. 시장 데이터 API (`/api/market`)

#### 시장 요약
- **GET** `/api/market/summary`
- S&P 500, Dow Jones, NASDAQ, Russell 2000, VIX 현황

#### 섹터 목록
- **GET** `/api/market/sectors`

#### ETF/채권/원자재 목록
- **GET** `/api/market/etfs`
- **GET** `/api/market/bonds`
- **GET** `/api/market/commodities`
- 파라미터:
  - `sector` (옵션): 섹터/유형 필터
  - `limit` (기본값: 50): 최대 조회 개수

#### 시장 데이터 동기화
- **POST** `/api/market/sync`
- 백그라운드에서 시장 데이터 동기화
- 파라미터:
  - `enrich` (기본값: false): yfinance 정보 보강 여부

#### 가격 데이터 동기화
- **POST** `/api/market/sync-prices`
- 백그라운드에서 가격 데이터 동기화

#### 데이터베이스 통계
- **GET** `/api/market/stats`
- 저장된 데이터 통계 조회

---

## 사용 예시

### cURL

```bash
# 1. 주가 조회
curl http://localhost:8000/api/stocks/AAPL/price

# 2. 종목 분석
curl http://localhost:8000/api/analysis/AAPL/summary

# 3. 시장 요약
curl http://localhost:8000/api/market/summary

# 4. ETL 매핑 검색
curl "http://localhost:8000/api/etl/search?query=금리 동향"

# 5. 여러 종목 조회
curl -X POST http://localhost:8000/api/stocks/quotes \
  -H "Content-Type: application/json" \
  -d '["AAPL", "MSFT", "GOOGL"]'
```

### Python

```python
import requests

# 1. 주가 조회
response = requests.get("http://localhost:8000/api/stocks/AAPL/price")
price_data = response.json()
print(f"AAPL: ${price_data['current_price']}")

# 2. 종목 분석
response = requests.get("http://localhost:8000/api/analysis/AAPL/summary")
analysis = response.json()
print(f"RSI: {analysis['rsi']}")

# 3. 여러 종목 비교
response = requests.post(
    "http://localhost:8000/api/analysis/compare",
    json=["AAPL", "MSFT", "GOOGL"]
)
comparisons = response.json()
```

### JavaScript (fetch)

```javascript
// 1. 주가 조회
fetch('http://localhost:8000/api/stocks/AAPL/price')
  .then(res => res.json())
  .then(data => console.log(`AAPL: $${data.current_price}`));

// 2. 시장 요약
fetch('http://localhost:8000/api/market/summary')
  .then(res => res.json())
  .then(data => console.log(data));
```

---

## 에러 처리

API는 표준 HTTP 상태 코드를 사용합니다:

- **200**: 성공
- **404**: 리소스를 찾을 수 없음
- **400**: 잘못된 요청
- **500**: 서버 내부 오류

에러 응답 형식:

```json
{
  "error": "Error type",
  "detail": "Detailed error message"
}
```

---

## 구현된 서비스

### 1. Stock Analyzer (`app/services/stock_analyzer.py`)
- 주식 데이터 분석
- 기술 지표 계산 (이동평균, RSI, 볼린저 밴드)
- 변동성 분석
- 섹터별 성과 분석

### 2. Yahoo Finance Fetcher (`app/services/yahoo_finance_fetcher.py`)
- Yahoo Finance API 래퍼
- 실시간 주가 조회
- 히스토리컬 데이터
- 재무제표 데이터
- 배당 정보

### 3. ETL Mapper Service (`app/services/etl_mapper_service.py`)
- 데이터 소스 매핑 관리
- 키워드 기반 검색
- 자연어 질의 처리

---

## 개발 정보

- **Framework**: FastAPI
- **Database**: SQLite (개발) / PostgreSQL (프로덕션)
- **Data Source**: Yahoo Finance (yfinance)
- **Authentication**: None (추후 구현 예정)

---

## 다음 단계

1. ✅ Stock Analyzer 서비스 구현
2. ✅ Yahoo Finance Fetcher 서비스 구현
3. ✅ FastAPI 엔드포인트 구현
4. ⬜ 인증/인가 시스템 추가
5. ⬜ Rate limiting 구현
6. ⬜ 캐싱 레이어 추가
7. ⬜ 웹소켓 실시간 데이터 스트리밍

---

## 문의

- GitHub: [index_analyzer](https://github.com/yourusername/index_analyzer)
- Issues: GitHub Issues 페이지 참조

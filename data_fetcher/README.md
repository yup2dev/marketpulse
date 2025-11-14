# Data Fetcher

OpenBB 스타일 금융 API 데이터 수집 라이브러리

## 특징

- **OpenBB 패턴**: 3단계 fetcher 패턴 (transform_query → extract_data → transform_data)
- **표준화된 모델**: Pydantic 기반 데이터 모델로 타입 안정성 보장
- **다중 데이터 소스**: Yahoo Finance, FRED (연방준비제도) API 통합
- **자격증명 관리**: 환경 변수 기반 안전한 API 키 관리
- **확장 가능 구조**: 새로운 Fetcher 추가 용이

## 설치

```bash
# Poetry를 사용한 로컬 개발
poetry install

# 필수 환경 변수 설정
export FRED_API_KEY="your_fred_api_key"  # FRED API 키 (https://fred.stlouisfed.org/docs/api/)
```

## API 키 설정

### FRED API 키 획득
1. https://fred.stlouisfed.org/docs/api/ 방문
2. 계정 생성 후 API 키 발급
3. 환경 변수 설정:
   ```bash
   export FRED_API_KEY="your_api_key_here"
   ```

### 자격증명 사용 방법
```python
# 방법 1: 환경 변수 (권장)
from data_fetcher.utils import get_credentials_for_api
credentials = get_credentials_for_api('FRED')  # FRED_API_KEY 환경변수 자동 로드

# 방법 2: 직접 전달
credentials = {"api_key": "your_api_key"}
```

## 사용법

### 1. 경제 지표 데이터 (FRED API)

```python
from data_fetcher import get_data_router
from data_fetcher.router import DataCategory

router = get_data_router()

# GDP 데이터 조회
gdp_data = router.fetch(
    category=DataCategory.GDP,
    params={'country': 'US', 'frequency': 'quarterly'},
    credentials={'api_key': 'your_fred_api_key'}
)

for data in gdp_data:
    print(f"{data.date}: {data.value} (성장률: {data.growth_rate}%)")

# CPI 데이터 조회
cpi_data = router.fetch(
    category=DataCategory.CPI,
    params={'country': 'US', 'frequency': 'monthly'},
    credentials={'api_key': 'your_fred_api_key'}
)

for data in cpi_data:
    print(f"{data.date}: CPI {data.value}")

# 실업률 데이터 조회
unemployment_data = router.fetch(
    category=DataCategory.UNEMPLOYMENT,
    params={'country': 'US', 'age_group': 'all'},
    credentials={'api_key': 'your_fred_api_key'}
)

for data in unemployment_data:
    print(f"{data.date}: 실업률 {data.value}%")
```

### 2. 공매도 데이터 (Yahoo Finance)

```python
from data_fetcher import get_data_router
from data_fetcher.router import DataCategory

router = get_data_router()

# Yahoo Finance는 API 키 불필요
short_data = router.fetch(
    category=DataCategory.SHORT_INTEREST,
    params={'symbol': 'TSLA', 'limit': 10}
)

if short_data:
    data = short_data[0]
    print(f"종목: {data.symbol}")
    print(f"공매도 비율: {data.short_percent_of_float * 100:.2f}%")
    print(f"커버 소요일수: {data.short_ratio:.2f}일")
```

### 4. 신규 경제 지표 데이터

```python
from data_fetcher import get_data_router
from data_fetcher.router import DataCategory

router = get_data_router()

# 산업 생산 지수
industrial_data = router.fetch(
    category=DataCategory.INDUSTRIAL_PRODUCTION,
    params={'country': 'US', 'category': 'total'},
    credentials={'api_key': 'your_fred_api_key'}
)

# 주택 건설 착공
housing_data = router.fetch(
    category=DataCategory.HOUSING_STARTS,
    params={'country': 'US'},
    credentials={'api_key': 'your_fred_api_key'}
)

# 소매 판매
retail_data = router.fetch(
    category=DataCategory.RETAIL_SALES,
    params={'country': 'US', 'category': 'total'},
    credentials={'api_key': 'your_fred_api_key'}
)

# 비농업 취업자
payroll_data = router.fetch(
    category=DataCategory.NONFARM_PAYROLL,
    params={'country': 'US', 'sector': 'total'},
    credentials={'api_key': 'your_fred_api_key'}
)

# 소비자 심리 지수
sentiment_data = router.fetch(
    category=DataCategory.CONSUMER_SENTIMENT,
    params={'country': 'US'},
    credentials={'api_key': 'your_fred_api_key'}
)

for data in industrial_data:
    print(f"{data.date}: 산업 생산 지수 {data.value:.2f} (성장률: {data.growth_rate:+.2f}%)")
```

### 3. 환경 변수를 활용한 API 키 관리

```python
from data_fetcher.utils import get_credentials_for_api
from data_fetcher import get_data_router
from data_fetcher.router import DataCategory

# 환경 변수에서 자동으로 API 키 로드
credentials = get_credentials_for_api('FRED')

router = get_data_router()
gdp_data = router.fetch(
    category=DataCategory.GDP,
    params={'country': 'US'},
    credentials=credentials
)
```

## 지원하는 데이터

### Yahoo Finance (API 키 불필요)
- 공매도 (Short Interest)

### FRED (API 키 필수)

#### 기본 경제 지표
- GDP (명목 GDP, 실질 GDP, 1인당 GDP)
- CPI (소비자 물가지수, 핵심 CPI)
- 실업률 (전체, 연령대별)
- 금리 (연방기금 금리, 국채 수익률 등)
- 고용 (비농업 고용자 수)

#### 신규 데이터 (최근 추가)
- **산업 생산 지수** (Industrial Production Index): 전체, 제조업, 광업, 유틸리티
- **소비자 심리 지수** (Consumer Sentiment Index): 최종, 예비 지수
- **주택 건설 착공** (Housing Starts): 총 착공, 단독주택, 건축 허가
- **소매 판매** (Retail Sales): 전체, 자동차 제외, 휘발유 판매소
- **비농업 취업자** (Non-Farm Payroll): 전체, 제조업, 서비스업, 정부

## 에러 처리

```python
from data_fetcher.utils import CredentialsError
from data_fetcher import get_data_router

router = get_data_router()

try:
    data = router.fetch(
        category=DataCategory.GDP,
        params={'country': 'US'},
        # credentials 미제공 → CredentialsError 발생
    )
except CredentialsError as e:
    print(f"자격증명 오류: {e}")
    # 예: "FRED API key is required. Set FRED_API_KEY environment variable."
except ValueError as e:
    print(f"데이터 오류: {e}")
except Exception as e:
    print(f"예상 외 오류: {e}")
```

## 아키텍처

```
data_fetcher/
├── models/                          # Standard Data Models (Pydantic)
│   ├── base.py                     # BaseQueryParams, BaseData
│   ├── gdp.py                      # GDP models
│   ├── cpi.py                      # CPI models
│   ├── unemployment.py             # Unemployment models
│   ├── employment.py               # Employment models
│   ├── interest_rate.py            # Interest Rate models
│   ├── industrial_production.py    # Industrial Production Index
│   ├── consumer_sentiment.py       # Consumer Sentiment Index
│   ├── housing_starts.py           # Housing Starts models
│   ├── retail_sales.py             # Retail Sales models
│   ├── nonfarm_payroll.py          # Non-Farm Payroll models
│   ├── equity_quote.py             # Stock Quote models
│   ├── short_interest.py           # Short Interest models
│   └── technical_indicators.py     # Technical Indicators models
├── fetchers/                        # Data Fetchers (OpenBB 3-step pattern)
│   ├── base.py                     # Abstract Fetcher class
│   ├── fred/                       # FRED API Fetchers
│   │   ├── gdp.py
│   │   ├── cpi.py
│   │   ├── unemployment.py
│   │   ├── employment.py
│   │   ├── interest_rate.py
│   │   ├── industrial_production.py
│   │   ├── consumer_sentiment.py
│   │   ├── housing_starts.py
│   │   ├── retail_sales.py
│   │   └── nonfarm_payroll.py
│   ├── alphavantage/               # Alpha Vantage Fetchers
│   │   ├── quote.py
│   │   └── timeseries.py
│   └── yahoo/                      # Yahoo Finance Fetchers
│       └── short_interest.py
├── utils/
│   └── credentials.py              # API Key Management (환경 변수)
├── router.py                       # DataRouter (통합 라우터)
├── examples.py                     # 사용 예제
├── main.py                         # CLI 인터페이스
└── test_fred_new_data.py          # 신규 FRED 데이터 테스트
```

## Fetcher 추가 방법

새로운 데이터 소스 Fetcher를 추가하려면:

1. **Model 정의** (`data_fetcher/models/`):
   ```python
   from pydantic import Field
   from data_fetcher.models.base import BaseQueryParams, BaseData

   class MyDataQueryParams(BaseQueryParams):
       symbol: str = Field(description="...")

   class MyData(BaseData):
       value: float = Field(description="...")
   ```

2. **Fetcher 구현** (`data_fetcher/fetchers/`):
   ```python
   from data_fetcher.fetchers.base import Fetcher
   from data_fetcher.utils.credentials import get_api_key

   class MyFetcher(Fetcher[MyDataQueryParams, MyData]):
       @staticmethod
       def transform_query(params):
           return MyDataQueryParams(**params)

       @staticmethod
       def extract_data(query, credentials=None, **kwargs):
           api_key = get_api_key(credentials, "MyAPI", "MYAPI_API_KEY")
           # API 호출
           return raw_data

       @staticmethod
       def transform_data(query, data, **kwargs):
           # 데이터 변환
           return [MyData(...)]
   ```

3. **Router에 등록** (`data_fetcher/router.py`):
   ```python
   from data_fetcher.fetchers.myapi import MyFetcher

   class DataRouter:
       def __init__(self):
           self.fetcher_map = {
               DataCategory.MY_DATA: MyFetcher,
               ...
           }
   ```

## 개발

```bash
# 테스트
poetry run pytest

# 포맷팅
poetry run black .

# 타입 체크
poetry run mypy .

# 린트
poetry run flake8 .
```

## 라이선스

MIT License

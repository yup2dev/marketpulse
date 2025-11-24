# Data Fetcher - 통합 데이터 조회 시스템

OpenBB 플랫폼 패턴을 따르는 통합 데이터 조회 시스템

## 주요 특징

### 🚀 OpenBB 패턴 적용
- **Transform-Extract-Transform (TET)** 패턴
- Abstract Fetcher 기반 구조
- Provider Registry 시스템ㄹ
- 자동 Fetcher 발견 및 등록

### ⚡ 비동기 지원 (NEW!)
- Async/Await 지원 (`fetch_data`, `aextract_data`)
- 동기 API도 제공 (`fetch_data_sync`, `fetch_sync`)
- 자동 coroutine 처리 (`_maybe_coroutine`)

### 🔒 Type Safety (NEW!)
- Generic typing (`Fetcher[QueryParamsT, DataT]`)
- Type inspection (`query_params_type`, `data_type`)
- Pydantic 모델 기반 validation

### 🧪 테스트 자동화 (NEW!)
- Built-in `test()` 메서드
- TET 파이프라인 자동 검증
- Type checking

### 📦 기타 기능
- **AnnotatedResult**: 메타데이터 포함 결과 반환
- **표준화된 모델**: Pydantic 기반 데이터 모델
- **다중 Provider**: FRED, Yahoo Finance, Alpha Vantage 지원
- **자격증명 관리**: 환경 변수 기반 안전한 API 키 관리

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

## 빠른 시작

### 기본 사용법 (비동기 - 권장)

```python
import asyncio
from data_fetcher.utils.router import DataRouter


async def main():
    router = DataRouter()

    # GDP 데이터 조회
    gdp_data = await router.get_gdp(
        country="US",
        frequency="quarterly",
        start_date="2020-01-01",
        credentials={"api_key": "your_fred_api_key"}
    )

    for data in gdp_data:
        print(f"{data.date}: {data.value} (성장률: {data.growth_rate}%)")


asyncio.run(main())
```

### 동기 방식

```python
from data_fetcher.utils.router import DataRouter

router = DataRouter()

# 동기 방식으로 조회
gdp_data = router.fetch_sync(
    category="gdp",
    provider="fred",
    params={
        "country": "US",
        "frequency": "quarterly",
        "start_date": "2020-01-01"
    },
    credentials={"api_key": "your_fred_api_key"}
)
```

## 사용 예제

### 1. Router를 사용한 통합 조회 (권장)

```python
import asyncio
from data_fetcher.utils.router import DataRouter


async def main():
    router = DataRouter()

    # GDP 데이터
    gdp_data = await router.fetch(
        category="gdp",
        provider="fred",
        params={"country": "US", "frequency": "quarterly"},
        credentials={"api_key": "your_fred_api_key"}
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
from data_fetcher.utils.router import DataCategory

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
from data_fetcher.utils.router import DataCategory

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
from data_fetcher.utils.router import DataCategory

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
├── fetchers/
│   ├── base.py                     # Abstract Fetcher 클래스 (NEW: Async, Type Safety, Test)
│   ├── fred/                       # FRED Provider Fetchers
│   ├── yahoo/                      # Yahoo Provider Fetchers
│   └── alphavantage/              # AlphaVantage Provider Fetchers
├── models/
│   ├── base.py                     # BaseQueryParams, BaseData
│   ├── fred/                       # FRED 데이터 모델
│   ├── yahoo/                      # Yahoo 데이터 모델
│   └── alphavantage/              # AlphaVantage 데이터 모델
├── registry.py                     # FetcherRegistry (자동 등록) (NEW)
├── provider.py                     # Provider 관리 (NEW)
├── router.py                       # DataRouter (통합 인터페이스, NEW: Async)
├── providers_init.py              # Provider 초기화
├── standard_models/               # 표준 모델 정의
├── utils/                         # 유틸리티 (credentials, http_client 등)
└── examples/
    └── unified_usage.py           # 통합 사용 예제 (NEW)
```

## 핵심 개념

### 1. Fetcher 패턴

모든 데이터 조회는 Transform-Extract-Transform (TET) 패턴을 따릅니다:

```python
from data_fetcher.fetchers.base import Fetcher
from pydantic import BaseModel
from typing import List, Dict, Any

class MyQueryParams(BaseModel):
    symbol: str
    start_date: str

class MyData(BaseModel):
    date: str
    value: float

class MyFetcher(Fetcher[MyQueryParams, MyData]):
    @staticmethod
    def transform_query(params: Dict[str, Any]) -> MyQueryParams:
        """1. 쿼리 파라미터 변환"""
        return MyQueryParams(**params)

    @staticmethod
    def extract_data(query: MyQueryParams, credentials=None, **kwargs):
        """2. 데이터 추출 (API 호출)"""
        # API 호출 로직
        return raw_data

    @staticmethod
    def transform_data(query: MyQueryParams, data: Any, **kwargs) -> List[MyData]:
        """3. 데이터 변환 (표준 모델로)"""
        return [MyData(...) for item in data]
```

### 2. 비동기 지원 (NEW!)

```python
# 비동기 방식 (권장)
data = await MyFetcher.fetch_data(params, credentials)
data = await router.fetch(category, params, provider, credentials)

# 동기 방식 (편의성)
data = MyFetcher.fetch_data_sync(params, credentials)
data = router.fetch_sync(category, params, provider, credentials)

# 비동기 extract 구현
class MyAsyncFetcher(Fetcher[MyQueryParams, MyData]):
    @staticmethod
    async def aextract_data(query, credentials=None, **kwargs):
        async with httpx.AsyncClient() as client:
            response = await client.get("https://api.example.com/data")
            return response.json()
```

### 3. Registry 시스템 (NEW!)

Fetcher는 자동으로 등록되고 발견됩니다:

```python
from data_fetcher.utils.registry import FetcherRegistry

# 사용 가능한 카테고리
categories = FetcherRegistry.list_categories()

# 특정 카테고리의 Provider
providers = FetcherRegistry.list_providers("gdp")

# Fetcher 가져오기
fetcher = FetcherRegistry.get("gdp", "fred")
```

### 4. 자동 테스트 (NEW!)

```python
from data_fetcher.fetchers.fred.gdp import FREDGDPFetcher

# Fetcher 자동 테스트 (TET 파이프라인 검증)
FREDGDPFetcher.test(
    params={
        "country": "US",
        "frequency": "quarterly",
        "start_date": "2023-01-01"
    },
    credentials={"api_key": "your_key"}
)
# ✓ FREDGDPFetcher test passed!
#   - Query: GDPQueryParams(...)
#   - Records fetched: 16
#   - Sample data: GDPData(...)
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
   from data_fetcher.utils.api_keys import get_api_key

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

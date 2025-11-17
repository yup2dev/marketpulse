# Data Fetcher V2 Architecture

> **개선일**: 2025-11-17
> **목적**: OpenBB Platform 패턴을 적용한 확장 가능한 아키텍처 구현

---

## 📊 주요 개선 사항

| 항목 | Before (V1) | After (V2) | 개선 효과 |
|------|-------------|-----------|----------|
| **Fetcher 등록** | 하드코딩 (router.py) | 자동 등록 (Registry) | 확장성 ⬆️ |
| **Provider 관리** | 없음 | Provider 추상화 | 구조화 ⬆️ |
| **Multi-Provider** | 불가능 | 가능 | 유연성 ⬆️ |
| **Standard Models** | 없음 | 추가됨 | 일관성 ⬆️ |
| **Utils** | credentials만 | http_client, validators, helpers | 재사용성 ⬆️ |

---

## 🏗️ 새로운 구조

```
data_fetcher/
├── standard_models/           # NEW: 표준 모델 정의
│   ├── __init__.py
│   ├── economic.py           # GDP, CPI, Unemployment 등
│   └── market.py             # Quote, Timeseries 등
│
├── utils/                     # ENHANCED: 유틸리티 확장
│   ├── credentials.py        # 기존
│   ├── http_client.py        # NEW: HTTP 클라이언트
│   ├── validators.py         # NEW: 데이터 검증
│   └── helpers.py            # NEW: 헬퍼 함수
│
├── fetchers/                  # 기존 구조 유지
│   ├── base.py
│   ├── fred/
│   ├── yahoo/
│   └── alphavantage/
│
├── models/                    # 기존 구조 유지
│   ├── fred/
│   ├── yahoo/
│   └── alphavantage/
│
├── registry.py               # NEW: Fetcher 레지스트리
├── provider.py               # NEW: Provider 추상화
├── providers_init.py         # NEW: Provider 자동 등록
├── router_v2.py              # NEW: 개선된 라우터
├── router.py                 # 기존 라우터 (호환성)
└── examples_v2.py            # NEW: V2 사용 예제
```

---

## 🎯 핵심 컴포넌트

### 1. Standard Models

표준 인터페이스를 정의하여 provider 간 일관성 보장

```python
# data_fetcher/standard_models/economic.py
class GDPQueryParams(EconomicQueryParams):
    """모든 GDP provider가 지원해야 하는 파라미터"""
    country: str = "US"
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    frequency: str = "quarterly"

class GDPData(EconomicData):
    """모든 GDP provider가 반환해야 하는 데이터"""
    date: date
    value: float
    country: str
    growth_rate: Optional[float] = None
```

**장점**:
- Provider 변경 시에도 동일한 인터페이스 유지
- 타입 안정성 보장
- 문서화 자동화

### 2. FetcherRegistry

Decorator 기반 자동 등록 시스템

```python
from data_fetcher.registry import FetcherRegistry

@FetcherRegistry.register(
    category="gdp",
    provider="fred",
    description="FRED GDP data"
)
class FREDGDPFetcher(Fetcher):
    ...
```

**장점**:
- Router 수정 없이 fetcher 추가
- 메타데이터 자동 관리
- 런타임 발견 가능

### 3. Provider Abstraction

Provider별로 fetcher 그룹화 및 메타데이터 관리

```python
from data_fetcher.provider import Provider

fred_provider = Provider(
    name="fred",
    description="Federal Reserve Economic Data",
    website="https://fred.stlouisfed.org",
    credentials=["api_key"],
    fetcher_dict={
        "gdp": FREDGDPFetcher,
        "cpi": FREDCPIFetcher,
        "unemployment": FREDUnemploymentFetcher,
    }
)
```

**장점**:
- Provider별 자격증명 관리
- 지원 카테고리 자동 추적
- 메타데이터 중앙화

### 4. Enhanced Utils

공통 기능을 재사용 가능한 유틸리티로 분리

#### HTTP Client
```python
from data_fetcher.utils import get_fred_client

client = get_fred_client(api_key)
data = client.get("/series/observations", params={...})
```

**Features**:
- Automatic retry with backoff
- Rate limiting
- Session pooling

#### Validators
```python
from data_fetcher.utils import validate_date, validate_symbol

date_obj = validate_date("2024-01-01")
symbol = validate_symbol("aapl")  # Returns "AAPL"
```

#### Helpers
```python
from data_fetcher.utils import calculate_growth_rate, safe_float

growth = calculate_growth_rate(current=105, previous=100)  # 5.0%
value = safe_float("123.45", default=0.0)
```

### 5. DataRouterV2

자동 발견 및 multi-provider 지원

```python
from data_fetcher.router import DataRouterV2

router = DataRouterV2()

# Automatic provider selection
gdp_data = router.fetch(
    category="gdp",
    params={"country": "US"}
)

# Explicit provider
gdp_data = router.fetch(
    category="gdp",
    provider="fred",
    params={"country": "US"},
    credentials={"api_key": "your_key"}
)

# Convenience methods
gdp_data = router.get_gdp(country="US", credentials={...})
```

**Features**:
- Provider 자동/수동 선택
- 메타데이터 조회
- Convenience methods
- Error handling

---

## 🔄 Migration Guide (V1 → V2)

### Before (V1)
```python
from data_fetcher.router import DataRouter, DataCategory

router = DataRouter()
gdp_data = router.fetch(
    category=DataCategory.GDP,
    params={"country": "US"},
    credentials={"api_key": "your_key"}
)
```

### After (V2)

```python
from data_fetcher.router import DataRouterV2

router = DataRouterV2()
gdp_data = router.fetch(
    category="gdp",  # String instead of Enum
    params={"country": "US"},
    credentials={"api_key": "your_key"}
)

# Or use convenience method
gdp_data = router.get_gdp(
    country="US",
    credentials={"api_key": "your_key"}
)
```

**주요 변경사항**:
1. `DataCategory` Enum → String
2. Provider 명시 가능
3. Convenience methods 추가
4. 메타데이터 조회 가능

---

## 📈 새로운 Provider 추가 방법

### Step 1: Fetcher 작성

```python
# data_fetcher/fetchers/worldbank/gdp.py
from data_fetcher.fetchers.base import Fetcher
from data_fetcher.standard_models import GDPQueryParams, GDPData

class WorldBankGDPFetcher(Fetcher[GDPQueryParams, GDPData]):
    @staticmethod
    def transform_query(params):
        return GDPQueryParams(**params)

    @staticmethod
    def extract_data(query, credentials, **kwargs):
        # Call World Bank API
        ...

    @staticmethod
    def transform_data(query, data, **kwargs):
        # Transform to GDPData
        ...
```

### Step 2: Provider 등록

```python
# data_fetcher/providers/worldbank.py
from data_fetcher.provider import Provider
from data_fetcher.fetchers.worldbank.gdp import WorldBankGDPFetcher

worldbank_provider = Provider(
    name="worldbank",
    description="World Bank Open Data",
    website="https://data.worldbank.org",
    credentials=["api_key"],  # If needed
    fetcher_dict={
        "gdp": WorldBankGDPFetcher,
    }
)
```

### Step 3: 자동 등록

```python
# data_fetcher/providers_init.py
from data_fetcher.providers.worldbank import worldbank_provider

def register_all_providers():
    ProviderRegistry.register(fred_provider)
    ProviderRegistry.register(yahoo_provider)
    ProviderRegistry.register(alphavantage_provider)
    ProviderRegistry.register(worldbank_provider)  # NEW
```

**완료!** 이제 사용 가능:
```python
router = DataRouterV2()
gdp_data = router.fetch(
    category="gdp",
    provider="worldbank",
    params={"country": "KR"}
)
```

---

## 🧪 Testing

### Registry Testing
```python
from data_fetcher.registry import FetcherRegistry

# List all categories
categories = FetcherRegistry.list_categories()

# Check providers for a category
providers = FetcherRegistry.list_providers("gdp")

# Get metadata
metadata = FetcherRegistry.get_metadata("gdp", "fred")
```

### Provider Testing
```python
from data_fetcher.provider import ProviderRegistry

# List providers
providers = ProviderRegistry.list()

# Get provider info
fred = ProviderRegistry.get("fred")
print(fred.to_dict())
```

### Router Testing
```python
router = DataRouterV2()

# Print all info
router.print_info()

# Get category info
gdp_info = router.get_category_info("gdp")

# Get provider info
fred_info = router.get_provider_info("fred")
```

---

## 📚 주요 파일 설명

| 파일 | 역할 | 중요도 |
|------|------|--------|
| `standard_models/` | 표준 인터페이스 정의 | ⭐⭐⭐⭐⭐ |
| `registry.py` | Fetcher 자동 등록 | ⭐⭐⭐⭐⭐ |
| `provider.py` | Provider 추상화 | ⭐⭐⭐⭐ |
| `providers_init.py` | Provider 초기화 | ⭐⭐⭐⭐ |
| `router_v2.py` | 개선된 라우터 | ⭐⭐⭐⭐⭐ |
| `utils/http_client.py` | HTTP 클라이언트 | ⭐⭐⭐ |
| `utils/validators.py` | 데이터 검증 | ⭐⭐⭐ |
| `utils/helpers.py` | 헬퍼 함수 | ⭐⭐⭐ |

---

## 🔮 향후 계획

### Phase 1: Core Enhancements (완료)
- [x] Standard Models
- [x] FetcherRegistry
- [x] Provider Abstraction
- [x] Enhanced Utils
- [x] DataRouterV2

### Phase 2: Advanced Features (예정)
- [ ] Caching layer
- [ ] Async support
- [ ] Data validation pipeline
- [ ] Auto-documentation

### Phase 3: Integration (예정)
- [ ] CLI commands
- [ ] REST API endpoints
- [ ] Database integration
- [ ] Monitoring/metrics

---

## 💡 Best Practices

### 1. 항상 Standard Models 사용
```python
# Good
class FREDGDPQueryParams(GDPQueryParams):
    frequency: str = "q"  # FRED-specific

# Bad
class FREDGDPQueryParams(BaseModel):
    country: str  # No standard interface
```

### 2. Utils 적극 활용
```python
# Good
from data_fetcher.utils import safe_float, calculate_growth_rate

value = safe_float(raw_value, default=0.0)
growth = calculate_growth_rate(current, previous)

# Bad
try:
    value = float(raw_value)
except:
    value = 0.0
```

### 3. Provider 메타데이터 활용
```python
# Good
provider = ProviderRegistry.get("fred")
if provider.requires_credentials():
    provider.validate_credentials(credentials)

# Bad
if credentials is None:
    raise ValueError("API key required")
```

---

## 📞 다음 단계

1. **V2 테스트**: `python data_fetcher/examples_v2.py` 실행
2. **기존 코드 마이그레이션**: V1 → V2 전환
3. **새 Provider 추가**: World Bank, OECD 등
4. **문서화**: API 문서 자동 생성

---

**문의사항이나 개선 제안이 있으시면 언제든지 연락주세요!**

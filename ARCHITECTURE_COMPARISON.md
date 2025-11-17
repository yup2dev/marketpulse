# MarketPulse vs OpenBB 아키텍처 비교 및 구조 개선 제안

> **작성일**: 2025-11-17
> **목적**: MarketPulse 프로젝트의 구조를 OpenBB Platform과 비교하여 최적의 아키텍처 방향성 제시

---

## 📊 프로젝트 개요 비교

| 항목 | OpenBB Platform | MarketPulse |
|------|----------------|-------------|
| **목적** | 금융 데이터 통합 플랫폼 (범용) | 한국 금융 뉴스 분석 + 시장 데이터 |
| **규모** | 대규모 (170+ 표준 모델, 20+ providers) | 중규모 (10+ 데이터 소스, 뉴스 크롤러) |
| **아키텍처** | Plugin-based (provider + extension) | Monorepo (3개 독립 프로젝트) |
| **주요 기능** | API 데이터 통합, REST API, Python SDK | 뉴스 크롤링, 감정 분석, 데이터 시각화 |
| **배포 형태** | Python 패키지, REST API | CLI, Daemon, Library |
| **타겟 사용자** | 퀀트 개발자, 금융 분석가 | 개인 투자자, 뉴스 분석가 |

---

## 🏗️ 현재 아키텍처 상세 비교

### OpenBB Platform 구조

```
openbb_platform/
├── core/                        # 핵심 프레임워크
│   ├── provider/
│   │   ├── abstract/           # 추상 베이스 클래스
│   │   ├── standard_models/    # 170+ 표준 모델
│   │   ├── registry.py         # Provider 자동 발견
│   │   └── query_executor.py   # 쿼리 실행 엔진
│   └── app/
│       ├── router.py           # FastAPI 라우터
│       ├── provider_interface.py  # 동적 스키마 생성
│       └── model/obbject.py    # 결과 객체
├── providers/                   # 데이터 공급자 (20+)
│   ├── fred/
│   │   └── models/             # FRED 구현
│   ├── fmp/
│   └── yfinance/
└── extensions/                  # 도메인 확장 (15+)
    ├── commodity/
    ├── equity/
    └── economy/
```

**핵심 패턴**:
- ✅ **Standard Model 기반**: 표준 인터페이스로 provider와 extension 완전 분리
- ✅ **Plugin Discovery**: Poetry entry points로 자동 발견
- ✅ **Dynamic Schema**: ProviderInterface가 모든 provider 파라미터 병합
- ✅ **Multi-Provider Support**: 런타임에 provider 선택 (`provider="fred"`)
- ✅ **Type Safety**: Pydantic으로 전체 타입 보장

### MarketPulse 구조

```
marketpulse/
├── index_analyzer/             # 뉴스 크롤러 데몬
│   ├── crawling/              # 멀티스레드 크롤러
│   ├── parsing/               # HTML 파싱
│   ├── pipeline/              # IN → PROC → CALC → RCMD
│   ├── daemon/                # APScheduler + Redis
│   └── models/
│       └── database.py        # MBS 스키마 (8개 테이블)
├── data_fetcher/              # API 데이터 수집 라이브러리
│   ├── models/                # Pydantic 모델
│   │   ├── yahoo/
│   │   ├── fred/
│   │   └── alphavantage/
│   ├── fetchers/              # OpenBB 스타일 Fetcher
│   │   ├── base.py
│   │   ├── yahoo/
│   │   ├── fred/
│   │   └── alphavantage/
│   ├── router.py              # DataRouter (중앙 라우팅)
│   └── main.py               # CLI 인터페이스
└── marketpulse_app/           # 메인 앱 (미완성)
    ├── presentation/
    │   ├── charts/
    │   └── cli/
    └── models/
        └── database.py
```

**핵심 패턴**:
- ✅ **Fetcher Pattern**: OpenBB 스타일 3단계 (transform → extract → transform)
- ✅ **Event-Driven**: Redis Stream 기반 파이프라인
- ✅ **Layered MBS Schema**: IN/PROC/CALC/RCMD 4단계 처리
- ✅ **Monorepo**: 독립 배포 가능한 3개 프로젝트
- ⚠️ **하드코딩된 라우팅**: `router.py`에 fetcher가 직접 매핑됨
- ⚠️ **표준 모델 없음**: 각 fetcher가 독립적인 모델 사용
- ⚠️ **확장성 제한**: 새 API 추가 시 router 수정 필요

---

## 🎯 아키텍처 비교 분석

### 1. 데이터 흐름 비교

#### OpenBB 데이터 흐름
```
사용자 요청 (obb.commodity.spot())
    ↓
Extension Router (@router.command(model="CommoditySpotPrices"))
    ↓
ProviderInterface (동적 스키마 생성)
    ↓
QueryExecutor (provider 찾기)
    ↓
Registry (fred_provider 로드)
    ↓
FredCommoditySpotPricesFetcher
    ├─ transform_query()
    ├─ extract_data()
    └─ transform_data()
    ↓
OBBject (통일된 반환 타입)
```

**특징**:
- 표준 모델명만 알면 됨 (provider 몰라도 OK)
- 런타임에 provider 선택 가능
- 새 provider 추가 시 기존 코드 수정 불필요

#### MarketPulse 데이터 흐름
```
사용자 요청 (router.fetch(category=DataCategory.GDP))
    ↓
DataRouter.fetch()
    ↓
category → fetcher 매핑 (하드코딩)
    ├─ DataCategory.GDP → FREDGDPFetcher
    ├─ DataCategory.CPI → FREDCPIFetcher
    └─ DataCategory.QUOTE → AlphaVantageQuoteFetcher
    ↓
개별 Fetcher
    ├─ transform_query()
    ├─ extract_data()
    └─ transform_data()
    ↓
각기 다른 Data 모델 반환
```

**특징**:
- 카테고리 기반 라우팅 (간단하지만 유연성 낮음)
- 새 fetcher 추가 시 router 수정 필수
- 동일 데이터에 대한 multi-provider 지원 어려움

### 2. 확장성 비교

| 측면 | OpenBB | MarketPulse | 승자 |
|------|--------|-------------|------|
| **새 Provider 추가** | Entry point만 등록 | Router 수정 필요 | 🏆 OpenBB |
| **Multi-Provider** | 표준 모델 1개 → N개 provider | 카테고리당 1개 fetcher만 가능 | 🏆 OpenBB |
| **타입 안정성** | 표준 모델로 보장 | Fetcher별 독립 모델 | 🏆 OpenBB |
| **배포 복잡도** | Poetry plugin (간단) | 3개 독립 프로젝트 관리 | 🏆 MarketPulse |
| **도메인 분리** | Extension 단위 | 프로젝트 단위 | 🏆 MarketPulse |
| **독립 실행** | REST API 의존 | CLI/Daemon 독립 실행 | 🏆 MarketPulse |

### 3. 코드 패턴 비교

#### Provider 등록 방식

**OpenBB (Plugin 시스템)**:
```python
# providers/fred/openbb_fred/__init__.py
fred_provider = Provider(
    name="fred",
    credentials=["api_key"],
    fetcher_dict={
        "CommoditySpotPrices": FredCommoditySpotPricesFetcher,
        "GDP": FredGDPFetcher,
    }
)

# pyproject.toml
[tool.poetry.plugins."openbb_provider_extension"]
fred = "openbb_fred:fred_provider"
```
- ✅ 자동 발견 (entry points)
- ✅ 표준 모델명으로 매핑
- ✅ 런타임에 동적 로드

**MarketPulse (하드코딩)**:
```python
# data_fetcher/router.py
class DataRouter:
    def fetch(self, category: DataCategory, ...):
        if category == DataCategory.GDP:
            return FREDGDPFetcher.fetch_data(...)
        elif category == DataCategory.CPI:
            return FREDCPIFetcher.fetch_data(...)
        elif category == DataCategory.QUOTE:
            return AlphaVantageQuoteFetcher.fetch_data(...)
        ...
```
- ⚠️ 수동 매핑
- ⚠️ 카테고리 Enum 의존
- ⚠️ Router 수정 필요

#### 표준 모델 사용

**OpenBB (Standard Model)**:
```python
# core/provider/standard_models/commodity_spot_prices.py
class CommoditySpotPricesQueryParams(QueryParams):
    start_date: Optional[date] = None
    end_date: Optional[date] = None

class CommoditySpotPricesData(Data):
    date: date
    price: float

# providers/fred/models/commodity_spot_prices.py
class FredCommoditySpotPricesQueryParams(CommoditySpotPricesQueryParams):
    frequency: Literal["a", "q", "m"] = None  # FRED 전용

# extensions/commodity/commodity_router.py
@router.command(model="CommoditySpotPrices")  # 표준 모델명만 참조
async def spot(...):
    ...
```
- ✅ 계약 인터페이스 분리
- ✅ Extension이 provider 몰라도 됨
- ✅ Provider별 확장 가능

**MarketPulse (개별 모델)**:
```python
# data_fetcher/models/fred/gdp.py
class GDPQueryParams(BaseQueryParams):
    country: str = "US"
    frequency: str = "quarterly"

class GDPData(BaseData):
    date: date
    value: float

# data_fetcher/fetchers/fred/gdp.py
class FREDGDPFetcher(Fetcher[GDPQueryParams, GDPData]):
    ...

# Router에서 직접 사용
router.fetch(category=DataCategory.GDP, ...)
```
- ⚠️ 표준 인터페이스 없음
- ⚠️ 다른 provider가 GDP 제공 시 충돌 가능

---

## 💡 MarketPulse 개선 제안

### 제안 1: 하이브리드 아키텍처 (추천)

OpenBB의 plugin 시스템을 차용하되, MarketPulse의 monorepo 구조 유지

```
marketpulse/
├── core/                           # 새로 추가: 핵심 프레임워크
│   ├── provider/
│   │   ├── abstract/
│   │   │   ├── fetcher.py         # 기존 data_fetcher/base.py 이동
│   │   │   └── provider.py        # Provider 등록 클래스
│   │   ├── standard_models/       # 새로 추가: 표준 모델
│   │   │   ├── economic_indicators/
│   │   │   │   ├── gdp.py
│   │   │   │   ├── cpi.py
│   │   │   │   └── unemployment.py
│   │   │   ├── market_data/
│   │   │   │   ├── quote.py
│   │   │   │   └── timeseries.py
│   │   │   └── news/
│   │   │       └── article.py
│   │   ├── registry.py            # Provider 자동 발견
│   │   └── query_executor.py      # 쿼리 실행
│   └── app/
│       └── router.py              # 기본 라우터 (선택사항)
│
├── providers/                      # data_fetcher → providers 변경
│   ├── fred/
│   │   ├── marketpulse_fred/
│   │   │   ├── __init__.py        # fred_provider 인스턴스
│   │   │   ├── models/
│   │   │   │   ├── gdp.py         # FredGDPQueryParams, FredGDPData
│   │   │   │   ├── cpi.py
│   │   │   │   └── unemployment.py
│   │   │   └── fetchers/
│   │   │       ├── gdp.py         # FredGDPFetcher
│   │   │       └── ...
│   │   └── pyproject.toml         # [tool.poetry.plugins."marketpulse_provider"]
│   ├── yahoo/
│   │   └── marketpulse_yahoo/
│   │       ├── __init__.py
│   │       └── models/
│   │           └── quote.py
│   └── alphavantage/
│       └── marketpulse_alphavantage/
│
├── extensions/                     # 새로 추가: 도메인별 확장
│   ├── economy/                   # 경제 지표
│   │   └── marketpulse_economy/
│   │       ├── economy_router.py
│   │       └── pyproject.toml     # [tool.poetry.plugins."marketpulse_extension"]
│   ├── news/                      # 뉴스 분석
│   │   └── marketpulse_news/
│   │       ├── news_router.py
│   │       ├── crawling/          # index_analyzer에서 이동
│   │       ├── parsing/
│   │       └── pipeline/
│   └── market/                    # 시장 데이터
│       └── marketpulse_market/
│           └── market_router.py
│
├── daemon/                         # index_analyzer → daemon으로 이름 변경
│   └── marketpulse_daemon/
│       ├── scheduler.py
│       ├── worker.py
│       └── redis_bus.py
│
└── app/                            # marketpulse_app 개선
    └── marketpulse_cli/
        ├── cli.py
        └── charts/
```

#### 구현 예시

**1. 표준 모델 정의** (`core/provider/standard_models/economic_indicators/gdp.py`):
```python
from core.provider.abstract.data import Data, QueryParams
from datetime import date
from typing import Optional

class GDPQueryParams(QueryParams):
    """GDP 조회를 위한 표준 파라미터"""
    country: str = "US"
    start_date: Optional[date] = None
    end_date: Optional[date] = None

class GDPData(Data):
    """GDP 데이터의 표준 형식"""
    date: date
    value: float
    country: str
```

**2. Provider 구현** (`providers/fred/marketpulse_fred/models/gdp.py`):
```python
from core.provider.standard_models.economic_indicators.gdp import (
    GDPQueryParams, GDPData
)

class FredGDPQueryParams(GDPQueryParams):
    """FRED 전용 파라미터 추가"""
    frequency: Literal["a", "q", "m"] = "q"  # 연간/분기/월간
    units: Literal["lin", "chg", "pch"] = "lin"  # 단위 변환

class FredGDPData(GDPData):
    """FRED 전용 필드 추가 (선택사항)"""
    series_id: Optional[str] = None
```

**3. Provider 등록** (`providers/fred/marketpulse_fred/__init__.py`):
```python
from core.provider.abstract.provider import Provider
from .fetchers.gdp import FredGDPFetcher
from .fetchers.cpi import FredCPIFetcher

fred_provider = Provider(
    name="fred",
    website="https://fred.stlouisfed.org",
    credentials=["api_key"],
    fetcher_dict={
        "GDP": FredGDPFetcher,
        "CPI": FredCPIFetcher,
        "Unemployment": FredUnemploymentFetcher,
        # 표준 모델명 → Fetcher 매핑
    }
)
```

**4. Entry Point 등록** (`providers/fred/pyproject.toml`):
```toml
[tool.poetry.plugins."marketpulse_provider"]
fred = "marketpulse_fred:fred_provider"
```

**5. Extension 사용** (`extensions/economy/marketpulse_economy/economy_router.py`):
```python
from core.app.router import Router
from core.app.query import Query
from core.app.provider_interface import StandardParams, ExtraParams, ProviderChoices

router = Router(prefix="/economy")

@router.command(
    model="GDP",  # 표준 모델명만 참조
    description="Get GDP data from multiple providers"
)
async def gdp(
    cc: CommandContext,
    provider_choices: ProviderChoices,  # FRED, Yahoo, etc.
    standard_params: StandardParams,    # country, start_date, end_date
    extra_params: ExtraParams,          # frequency, units (FRED 전용)
) -> OBBject:
    """
    GDP 데이터 조회

    Examples:
        >>> obb.economy.gdp(provider="fred", country="US", frequency="q")
    """
    return await OBBject.from_query(Query(**locals()))
```

#### 장점

| 개선 사항 | 효과 |
|----------|------|
| ✅ **표준 모델 도입** | Extension이 provider 몰라도 사용 가능 |
| ✅ **Plugin 시스템** | 새 provider 추가 시 코드 수정 불필요 |
| ✅ **Multi-Provider** | GDP를 FRED/World Bank 등 여러 곳에서 가져올 수 있음 |
| ✅ **Monorepo 유지** | 독립 배포 가능 (현재 강점 유지) |
| ✅ **뉴스 파이프라인 통합** | `news` extension으로 일관된 구조 |

#### 단점
- ⚠️ 대규모 리팩토링 필요
- ⚠️ 기존 `data_fetcher` 사용자에게 breaking change

---

### 제안 2: 점진적 개선 (보수적 접근)

기존 구조 유지하되, 개선 사항만 적용

#### 2.1 Registry 패턴 도입

**현재** (`data_fetcher/router.py`):
```python
class DataRouter:
    def fetch(self, category: DataCategory, ...):
        if category == DataCategory.GDP:
            return FREDGDPFetcher.fetch_data(...)
        elif category == DataCategory.CPI:
            ...
```

**개선** (`data_fetcher/registry.py`):
```python
class FetcherRegistry:
    _registry: dict[str, Type[Fetcher]] = {}

    @classmethod
    def register(cls, category: str, fetcher: Type[Fetcher]):
        cls._registry[category] = fetcher

    @classmethod
    def get(cls, category: str) -> Type[Fetcher]:
        return cls._registry.get(category)

# 각 fetcher 파일에서
FetcherRegistry.register("gdp", FREDGDPFetcher)
FetcherRegistry.register("cpi", FREDCPIFetcher)

# Router에서
class DataRouter:
    def fetch(self, category: str, ...):
        fetcher = FetcherRegistry.get(category)
        if not fetcher:
            raise ValueError(f"Unknown category: {category}")
        return fetcher.fetch_data(...)
```

**장점**:
- ✅ Router 수정 없이 fetcher 추가 가능
- ✅ 기존 API 호환성 유지
- ✅ 최소 리팩토링

#### 2.2 Standard Model 레이어 추가

```
data_fetcher/
├── standard_models/           # 새로 추가
│   ├── __init__.py
│   ├── economic.py           # GDP, CPI, Unemployment 표준 모델
│   └── market.py             # Quote, TimeSeries 표준 모델
├── models/
│   ├── fred/
│   │   └── gdp.py           # FredGDPQueryParams(GDPQueryParams)
│   └── yahoo/
└── fetchers/
```

**장점**:
- ✅ Multi-provider 준비
- ✅ 타입 일관성 개선
- ✅ 기존 코드 재사용

#### 2.3 Provider 추상화

```python
# data_fetcher/providers/base.py
class Provider:
    name: str
    credentials: list[str]
    fetchers: dict[str, Type[Fetcher]]

# data_fetcher/providers/fred.py
fred_provider = Provider(
    name="fred",
    credentials=["api_key"],
    fetchers={
        "gdp": FREDGDPFetcher,
        "cpi": FREDCPIFetcher,
    }
)

# Router에서
class DataRouter:
    def __init__(self):
        self.providers = {
            "fred": fred_provider,
            "yahoo": yahoo_provider,
        }

    def fetch(self, category: str, provider: str = "fred", ...):
        provider_obj = self.providers[provider]
        fetcher = provider_obj.fetchers.get(category)
        return fetcher.fetch_data(...)
```

**장점**:
- ✅ Multi-provider 지원 (같은 카테고리에 여러 provider)
- ✅ 점진적 마이그레이션 가능

---

### 제안 3: 현재 구조 유지 (최소 변경)

OpenBB 패턴 도입 없이 현재 구조 개선만 진행

#### 개선 사항

1. **DataCategory Enum 자동화**
   ```python
   # 현재: 수동 추가
   class DataCategory(str, Enum):
       GDP = "gdp"
       CPI = "cpi"

   # 개선: 자동 발견
   DataCategory = Enum('DataCategory', {
       name: name.lower()
       for name in FetcherRegistry.list_categories()
   })
   ```

2. **Documentation 개선**
   - 각 fetcher에 docstring 추가
   - `examples.py` 확장
   - Sphinx 문서 생성

3. **Testing 강화**
   - 각 fetcher별 unit test
   - Integration test
   - Mock API 응답

4. **CLI 개선**
   - `marketpulse_app`을 fully functional CLI로
   - Typer 또는 Click 사용
   - 대화형 데이터 탐색

**장점**:
- ✅ 리스크 최소화
- ✅ 빠른 개선
- ✅ 기존 사용자 영향 없음

**단점**:
- ⚠️ 확장성 제한
- ⚠️ Multi-provider 어려움

---

## 📋 결론 및 권장 사항

### 프로젝트 목표별 추천

| 목표 | 추천 방식 | 이유 |
|------|----------|------|
| **빠른 MVP** | 제안 3 (최소 변경) | 기존 구조로 빠르게 기능 완성 |
| **장기 확장성** | 제안 1 (하이브리드) | OpenBB 수준의 확장성 확보 |
| **점진적 개선** | 제안 2 (보수적) | 리스크 분산하며 단계적 개선 |
| **오픈소스 공개** | 제안 1 (하이브리드) | 외부 기여자가 provider 추가 용이 |
| **개인 프로젝트** | 제안 3 (최소 변경) | Over-engineering 방지 |

### 최종 권장: 제안 2 (점진적 개선)

**이유**:
1. **현실적**: 대규모 리팩토링 없이 점진적 개선
2. **학습 곡선**: OpenBB 패턴을 단계적으로 학습하며 적용
3. **리스크 관리**: 기존 코드 보존하며 새 기능 추가
4. **확장성 확보**: 표준 모델 도입으로 향후 multi-provider 대비

### 구현 로드맵

#### Phase 1: 기반 구축 (1-2주)
- [ ] `FetcherRegistry` 구현
- [ ] `standard_models/` 디렉토리 생성
- [ ] GDP, CPI, Quote 표준 모델 정의
- [ ] 기존 fetcher를 registry에 등록

#### Phase 2: Provider 추상화 (2-3주)
- [ ] `Provider` 클래스 구현
- [ ] FRED, Yahoo, AlphaVantage provider 정의
- [ ] Router에 provider 선택 기능 추가
- [ ] Multi-provider 테스트

#### Phase 3: Extension 분리 (3-4주)
- [ ] `extensions/economy/` 디렉토리 생성
- [ ] `index_analyzer`를 `extensions/news/`로 이동
- [ ] CLI router 통합

#### Phase 4: Plugin 시스템 (선택사항)
- [ ] Entry point 기반 자동 발견
- [ ] 동적 로딩
- [ ] OpenBB 수준 호환성

---

## 🔧 빠른 시작: 제안 2 구현 예시

### Step 1: Registry 생성

```python
# data_fetcher/registry.py
from typing import Type, Dict
from .fetchers.base import Fetcher

class FetcherRegistry:
    _registry: Dict[str, Type[Fetcher]] = {}

    @classmethod
    def register(cls, name: str):
        """Decorator for registering fetchers"""
        def wrapper(fetcher_class: Type[Fetcher]):
            cls._registry[name] = fetcher_class
            return fetcher_class
        return wrapper

    @classmethod
    def get(cls, name: str) -> Type[Fetcher]:
        fetcher = cls._registry.get(name)
        if not fetcher:
            raise ValueError(f"Fetcher '{name}' not found. Available: {list(cls._registry.keys())}")
        return fetcher

    @classmethod
    def list(cls) -> list[str]:
        return list(cls._registry.keys())
```

### Step 2: Fetcher 등록

```python
# data_fetcher/fetchers/fred/gdp.py
from data_fetcher.registry import FetcherRegistry

@FetcherRegistry.register("gdp")
class FREDGDPFetcher(Fetcher[GDPQueryParams, GDPData]):
    ...

# data_fetcher/fetchers/fred/cpi.py
@FetcherRegistry.register("cpi")
class FREDCPIFetcher(Fetcher[CPIQueryParams, CPIData]):
    ...
```

### Step 3: Router 개선

```python
# data_fetcher/router.py
from .registry import FetcherRegistry

class DataRouter:
    def fetch(
        self,
        category: str,
        params: dict,
        credentials: dict = None
    ):
        """
        Fetch data from registered fetchers

        Args:
            category: Fetcher name (e.g., "gdp", "cpi")
            params: Query parameters
            credentials: API credentials

        Returns:
            List of data models

        Examples:
            >>> router = DataRouter()
            >>> data = router.fetch("gdp", {"country": "US"})
        """
        fetcher_class = FetcherRegistry.get(category)
        return fetcher_class.fetch_data(params, credentials)

    def list_categories(self) -> list[str]:
        """List all available data categories"""
        return FetcherRegistry.list()
```

### Step 4: 사용 예시

```python
from data_fetcher.router import DataRouter

router = DataRouter()

# 사용 가능한 카테고리 확인
print(router.list_categories())
# ['gdp', 'cpi', 'unemployment', 'quote', 'timeseries']

# 데이터 조회
gdp_data = router.fetch(
    category="gdp",
    params={"country": "US", "frequency": "quarterly"},
    credentials={"api_key": "your_fred_key"}
)
```

---

## 📚 참고 자료

### OpenBB 핵심 파일
- `core/provider/abstract/fetcher.py` - Fetcher 베이스 클래스
- `core/provider/registry.py` - Provider 자동 발견
- `core/app/provider_interface.py` - 동적 스키마 생성

### MarketPulse 핵심 파일
- `data_fetcher/router.py` - 현재 라우팅 로직
- `data_fetcher/fetchers/base.py` - Fetcher 베이스 (OpenBB 스타일)
- `index_analyzer/pipeline/` - MBS 파이프라인 구조

### 추천 읽을거리
- [OpenBB Platform Documentation](https://docs.openbb.co/platform)
- [FastAPI Dependency Injection](https://fastapi.tiangolo.com/tutorial/dependencies/)
- [Poetry Plugins](https://python-poetry.org/docs/plugins/)
- [Pydantic Models](https://docs.pydantic.dev/latest/)

---

## 📞 다음 단계

1. **의사결정**: 제안 1/2/3 중 선택
2. **POC 구현**: 선택한 방식으로 1개 fetcher 마이그레이션
3. **검증**: 기존 기능과 동일하게 동작하는지 확인
4. **전체 마이그레이션**: 나머지 fetcher 순차 적용
5. **문서화**: API 문서 및 아키텍처 다이어그램 작성

질문이나 추가 설명이 필요하면 언제든지 요청하세요!

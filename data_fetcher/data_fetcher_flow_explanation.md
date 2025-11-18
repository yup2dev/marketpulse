# Data Fetcher 폴더별 역할 및 데이터 흐름 설명

## 📊 데이터 흐름 순서도

```
사용자 요청
    ↓
① router.py (진입점)
    ↓
② registry.py + provider.py (Fetcher 선택)
    ↓
③ models/ (파라미터 검증)
    ↓
④ utils/credentials.py (API 키 확인)
    ↓
⑤ fetchers/ (API 호출 & 데이터 추출)
    ↓
⑥ models/ (데이터 변환)
    ↓
⑦ 결과 반환 → 사용자
```

---

## 🗂️ 폴더별 상세 역할

### ① **router.py** - 진입점 (Entry Point)
**역할**: 사용자의 첫 번째 접점, 모든 데이터 요청의 시작점

```python
# 사용자가 이렇게 호출하면
router = DataRouter()
gdp_data = await router.get_gdp(country="US", credentials={...})
```

**하는 일**:
- 사용자 요청 받기
- 어떤 카테고리(GDP, CPI 등)인지 파악
- 적절한 Fetcher 찾기
- 결과 반환

**위치**: `data_fetcher/router.py`

---

### ② **registry.py + provider.py** - Fetcher 관리자
**역할**: 어떤 Fetcher를 사용할지 결정

#### **registry.py** - Fetcher 등록소
```python
# Fetcher들이 자동으로 등록됨
FetcherRegistry.register(category="gdp", provider="fred", fetcher_class=FREDGDPFetcher)
```

**하는 일**:
- 모든 Fetcher 클래스 등록 및 관리
- 카테고리별로 어떤 Fetcher가 있는지 추적
- `router.py`가 요청하면 적절한 Fetcher 제공

#### **provider.py** - Provider 정보 관리
```python
# FRED, Yahoo, AlphaVantage 같은 Provider 정보
fred_provider = Provider(
    name="fred",
    description="Federal Reserve Economic Data",
    credentials=["api_key"]
)
```

**하는 일**:
- Provider별 메타데이터 관리
- Provider가 지원하는 카테고리 목록
- 자격증명 요구사항 정의

**위치**:
- `data_fetcher/registry.py`
- `data_fetcher/provider.py`
- `data_fetcher/providers_init.py`

---

### ③ **models/** - 데이터 모델 정의 (입력/출력 구조)
**역할**: 파라미터와 결과 데이터의 형태를 정의

```
models/
├── fred/
│   ├── gdp.py          # GDPQueryParams, GDPData
│   ├── cpi.py          # CPIQueryParams, CPIData
│   └── unemployment.py
├── yahoo/
│   └── short_interest.py
└── alphavantage/
```

**예시 - GDP 모델**:
```python
# 입력 파라미터 모델
class GDPQueryParams(BaseModel):
    country: str = "US"
    frequency: str = "quarterly"
    start_date: Optional[date] = None

# 출력 데이터 모델
class GDPData(BaseModel):
    date: date
    value: float
    growth_rate: Optional[float]
```

**하는 일**:
- 사용자 입력값 검증 (Pydantic)
- API 응답을 표준 형식으로 변환
- 타입 안정성 보장

**위치**: `data_fetcher/models/`

---

### ④ **utils/** - 공통 유틸리티
**역할**: 여러 곳에서 반복 사용되는 기능 제공

```
utils/
├── credentials.py      # API 키 관리
├── http_client.py      # (예정) HTTP 요청 공통화
├── validators.py       # (예정) 데이터 검증
└── helpers.py          # (예정) 헬퍼 함수
```

#### **credentials.py** - 가장 중요!
```python
# API 키를 환경변수에서 가져오기
credentials = get_credentials_for_api("FRED")
# → FRED_API_KEY 환경변수 자동 로드

# 또는 API 키 검증
api_key = get_api_key(credentials, "FRED", "FRED_API_KEY")
```

**하는 일**:
- 환경변수에서 API 키 자동 로드
- API 키 누락 시 에러 발생
- 보안 관리

**위치**: `data_fetcher/utils/`

---

### ⑤ **fetchers/** - 실제 데이터 수집 (핵심!)
**역할**: 외부 API를 호출해서 실제 데이터를 가져오는 곳

```
fetchers/
├── base.py             # 모든 Fetcher의 부모 클래스
├── fred/
│   ├── series.py       # FRED API 공통 로직
│   ├── gdp.py          # GDP 데이터 가져오기
│   ├── cpi.py          # CPI 데이터 가져오기
│   └── unemployment.py
├── yahoo/
│   └── short_interest.py
└── alphavantage/
```

#### **TET 패턴 (Transform-Extract-Transform)**:
```python
class FREDGDPFetcher(Fetcher):
    # 1️⃣ Transform Query: 파라미터 변환
    def transform_query(params: dict) -> GDPQueryParams:
        return GDPQueryParams(**params)

    # 2️⃣ Extract Data: API 호출 (실제 데이터 가져오기)
    def extract_data(query, credentials) -> dict:
        api_key = credentials["api_key"]
        response = requests.get(
            f"https://api.stlouisfed.org/fred/series/observations",
            params={"series_id": "GDP", "api_key": api_key}
        )
        return response.json()

    # 3️⃣ Transform Data: 표준 형식으로 변환
    def transform_data(query, raw_data) -> List[GDPData]:
        return [GDPData(date=..., value=...) for item in raw_data]
```

**하는 일**:
1. 사용자 파라미터를 API 요청에 맞게 변환
2. 외부 API 호출 (FRED, Yahoo 등)
3. API 응답을 표준 모델(GDPData)로 변환
4. 성장률 같은 추가 계산

**위치**: `data_fetcher/fetchers/`

---

### ⑥ **standard_models/** - 표준 인터페이스 정의
**역할**: Provider가 달라도 같은 형식으로 데이터 제공

```
standard_models/
├── economic.py         # GDP, CPI, Unemployment 표준
└── market.py           # Stock, Quote 표준
```

**예시**:
```python
# FRED든 World Bank든 모두 이 인터페이스를 따름
class GDPQueryParams(BaseModel):
    country: str
    start_date: Optional[date]

class GDPData(BaseModel):
    date: date
    value: float
```

**하는 일**:
- Provider 간 일관성 보장
- Provider를 바꿔도 코드 수정 불필요

**위치**: `data_fetcher/standard_models/`

---

### ⑦ **examples/** - 사용 예제
**역할**: 어떻게 사용하는지 보여주는 샘플 코드

```
examples/
├── unified_usage.py            # 기본 사용법
├── popup_visualization.py      # 시각화 예제
└── interactive_visualization.py
```

**위치**: `data_fetcher/examples/`

---

## 🔄 실제 데이터 흐름 예시

### 사용자가 GDP 데이터를 요청할 때:

```python
# 1. 사용자 요청
router = DataRouter()
gdp_data = await router.get_gdp(country="US", credentials={"api_key": "xxx"})
```

**내부 흐름**:

```
① router.py
   → "gdp" 카테고리 요청이 들어옴

② registry.py
   → "gdp" 카테고리의 Fetcher 찾기
   → FREDGDPFetcher 발견!

③ models/fred/gdp.py
   → GDPQueryParams로 파라미터 검증
   → country="US", frequency="quarterly" 확인

④ utils/credentials.py
   → API 키가 있는지 확인
   → 없으면 에러!

⑤ fetchers/fred/gdp.py
   → transform_query: 파라미터 변환
   → extract_data: FRED API 호출
     GET https://api.stlouisfed.org/fred/series/observations?series_id=GDP&api_key=xxx
   → transform_data: JSON을 GDPData 리스트로 변환
     [GDPData(date="2024-01-01", value=28000, growth_rate=2.5), ...]

⑥ 결과 반환
   → router.py가 GDPData 리스트를 사용자에게 반환

⑦ 사용자
   → gdp_data[0].value 로 데이터 사용 가능!
```

---

## 📂 폴더 중요도 순위

| 순위 | 폴더 | 역할 | 사용 빈도 |
|------|------|------|----------|
| 🥇 1 | **router.py** | 진입점 | 매번 사용 |
| 🥈 2 | **fetchers/** | 실제 데이터 수집 | 매번 사용 |
| 🥉 3 | **models/** | 데이터 구조 정의 | 매번 사용 |
| 4 | **utils/credentials.py** | API 키 관리 | 매번 사용 |
| 5 | **registry.py** | Fetcher 관리 | 내부에서 사용 |
| 6 | **provider.py** | Provider 정보 | 내부에서 사용 |
| 7 | **standard_models/** | 표준 인터페이스 | 새 Provider 추가 시 |
| 8 | **examples/** | 사용 예제 | 학습용 |

---

## 🎯 핵심 정리

### 데이터가 흐르는 3단계
1. **요청 단계**: router → registry → fetcher 선택
2. **수집 단계**: fetcher → API 호출 → 원시 데이터 획득
3. **변환 단계**: 원시 데이터 → 표준 모델 → 사용자에게 반환

### 각 폴더를 한 줄로
- **router.py**: "어디로 가야 하지?" (교통 경찰)
- **registry.py**: "이 일은 누가 하지?" (전화번호부)
- **provider.py**: "이 회사 정보가 뭐지?" (회사 명함)
- **models/**: "데이터 형태가 어떻게 생겼지?" (설계도)
- **fetchers/**: "실제로 데이터 가져와!" (일꾼)
- **utils/**: "자주 쓰는 도구 모음" (연장통)
- **standard_models/**: "모두가 따를 규칙" (표준 규격)

---

## 💡 실전 팁

### 새로운 데이터 소스 추가하려면?
1. `models/fred/` 안에 새 모델 파일 만들기
2. `fetchers/fred/` 안에 새 fetcher 파일 만들기
3. `router.py`에 편의 메서드 추가 (선택)

### 문제 발생 시 디버깅 순서
1. `router.py` - 요청이 제대로 들어왔나?
2. `registry.py` - Fetcher가 등록되어 있나?
3. `utils/credentials.py` - API 키가 있나?
4. `fetchers/` - API 호출이 성공했나?
5. `models/` - 데이터 변환이 제대로 됐나?

---

**이제 각 폴더의 역할과 흐름이 명확해졌나요?** 🎉

---
name: add-fetcher
description: data_fetcher에 새 데이터 소스(provider/model fetcher)를 추가할 때 사용. 구조별 플레이북(ApiFetcher 선언형 / LibraryFetcher·yfinance / DbFetcher / ComputeFetcher / OpenBB 이식형 / KIS형 다중자격증명) + TET 파이프라인 + standard model 상속 + providers_init 등록 + 라우트/위젯 연결 + exe(PyInstaller) 번들 주의사항까지 안내한다. "fetcher 추가", "새 provider 붙이기", "새 지표/모델 추가", "yahoo/fmp/polygon 등에 모델 추가" 같은 요청에 사용.
---

# Fetcher 추가 가이드 (구조별)

이 프로젝트의 데이터 계층은 OpenBB 스타일 **TET 파이프라인 + standard model** 구조다.
provider가 달라도 같은 `category`(model)는 **동일 standard model을 상속**해 동일 shape를 반환하므로,
UniversalWidget의 provider 셀렉터가 shape-safe하게 동작한다.

```
요청 → QueryExecutor.fetch(provider, model, params)
        └→ ProviderRegistry.get(provider).fetcher_dict[model]
            └→ Fetcher.fetch_data():
                 transform_query(params)  → ProviderQueryParams (← 표준 QueryParams 상속)
                 extract_data(query)       → 원시 데이터
                 transform_data(query,data)→ [ProviderData(...)]  (← 표준 Data 상속)
```

핵심 파일:
- 유형별 베이스: `data_fetcher/abstract_provider/abstract/base_fetchers.py`
- 표준 모델: `data_fetcher/abstract_provider/standard_models/<model>.py` (+ `__init__.py` export)
- provider fetcher: `data_fetcher/providers/<provider>/…` (구조는 아래 §1)
- 등록: `data_fetcher/providers_init.py` / 캐시 TTL: `query_executor.py`의 `_DEFAULT_TTL`
- 라우트: 범용 게이트웨이 `app/backend/api/routes/data.py`(무코드) 또는 전용 `routes/<area>.py`
- 프론트: `app/frontend/src/registry/widgetEndpoints.js` + `urlWidgetMap.js`
- exe 빌드 spec: `build/MarketPulseFetcher.spec` + `build/MarketPulseFetcherSidecar.spec`

---

## 0. 먼저 판단: 새 model인가, 기존 model의 새 provider인가?

- **기존 model에 provider 추가** (예: `income_statement`를 tiingo로도) → standard model **재사용**. §1~2 구조 선택 후 §3부터.
- **완전히 새 model** → standard model부터 신규 작성(§2). 같은 category에 provider가 2개 이상이면 프론트 provider 셀렉터가 자동 노출된다.

---

## 1. 구조 선택 매트릭스

| 데이터 소스 유형 | 베이스 | 파일 위치 | 예시 |
|---|---|---|---|
| 원격 HTTP API (키 유/무) | `ApiFetcher` | `providers/<p>/<model>.py` | fmp, polygon, fred |
| 파이썬 라이브러리 래퍼 | `LibraryFetcher` / `YFinanceFetcher` | `providers/<p>/<model>.py` | yahoo(yfinance), krx(pykrx) |
| 로컬 SQLite 조회 | `DbFetcher` | `providers/database/<model>.py` | stock_ranking, stock_list |
| 순수 로컬 계산 | `ComputeFetcher` | `providers/<p>/<model>.py` | quantitative, quantlib |
| OpenBB에서 이식 | `ApiFetcher` | `providers/<p>/models/<model>.py` + `utils/` | wsj, bls, eia, oecd, imf, sec/models |
| 다중 자격증명·스트림 | `ApiFetcher` + rest/stream 분리 | `providers/<p>/{ranking,rest,stream}.py` | kis (appkey/appsecret) |

모든 베이스는 제네릭 subscript 필수: `class My(ApiFetcher[MyQuery, MyData])` — `_generic_args()`가 이걸로 `query_params_type`을 해석한다.

### A. ApiFetcher — 선언형 (신규 HTTP API 권장)

`build_url`만 선언하면 `aextract_data` 기본 구현(aiohttp `amake_request(s)`)이 처리한다:

```python
class FMPThingFetcher(ApiFetcher[FMPThingQueryParams, FMPThingData]):
    api_name = "FMP"                  # 에러 메시지용
    api_key_env = "FMP_API_KEY"       # env 폴백
    credential_key = "fmp_api_key"    # credentials dict 키 (기본 "api_key")
    # request_kwargs = {"timeout": 30} / response_callback = ...  필요 시

    @staticmethod
    def transform_query(params): return FMPThingQueryParams(**params)

    @staticmethod
    def build_url(query, api_key) -> str:   # 또는 list[str] (병렬 요청)
        return f"https://…?symbol={query.symbol}&apikey={api_key}"

    @staticmethod
    def transform_data(query, data, **kwargs):
        return [FMPThingData(**row) for row in data]
```
- 무인증 API: `require_credentials = False`만 선언.
- 복잡한 페이징/헤더가 필요하면 `aextract_data`를 직접 오버라이드(마이그레이션 스타일).

### B. LibraryFetcher / YFinanceFetcher — 라이브러리 래퍼

- **라이브러리 import는 반드시 메서드 내부에서** (모듈 상단 금지 아님, 다만 무거운 것은 지연 권장). yfinance는 `YFinanceFetcher.get_ticker(symbol)` 헬퍼 사용.
- sync `extract_data`로 구현해도 됨(스레드로 감싸짐). `library_name` 선언.
- 예시: `providers/yahoo/dividends.py`.

### C. DbFetcher — 로컬 SQLite

```python
class DBThingFetcher(DbFetcher[Q, D]):
    @classmethod
    def extract_data(cls, query, credentials=None, **kwargs):
        with cls.db_session(**kwargs) as session:
            rows = session.execute(text("SELECT …")).fetchall()
        return [...]
```
- **주의**: sqlalchemy는 Fetcher(exe) 환경에 없다 → providers_init에서 database provider는 `try/except ImportError`로 fail-soft 등록된다(기존 블록에 추가하면 됨).
- 테이블은 적재 배치 의존(예: `mbs_in_stk_stbd` ← `scripts/backfill_stk_stbd.py`). **적재가 없으면 빈 응답**이므로 어느 배치가 채우는지 도큐스트링에 명시. 클라우드 반영은 `scripts/sync_db_to_cloud.py`(/api/ingest) 경유.
- 새 테이블이면 `index_analyzer/models/orm/ingest.py`에 ORM + `/api/ingest` whitelist(`app/backend/api/routes/ingest.py` `_TABLES`) + sync 스크립트 `TABLES`에도 추가.

### D. ComputeFetcher — 순수 로컬 계산

- 네트워크/credentials 없음. scipy·QuantLib 등 **선택적 의존성이면 providers_init에서 try/except 등록** (quantlib/quantitative 블록 참조) + PyInstaller spec `excludes` 유지 확인.

### E. OpenBB 이식형 — `providers/<p>/models/` 구조

OpenBB provider를 이식할 때(프로젝트 네이티브 — `_obb` shim 금지):
1. 파일 배치: `providers/<p>/models/<model>.py`, 공용 유틸은 `providers/<p>/utils/`.
2. import 경로 치환: `openbb_core.provider.abstract.*` → `data_fetcher.abstract_provider.abstract.*`, standard models → `data_fetcher.abstract_provider.standard_models.*` (OpenBB 전용 베이스는 `standard_models/openbb/_base` 참조), 요청 헬퍼 → `data_fetcher/utils/provider_helpers.py`.
3. raw 키 매핑은 `__alias_dict__` + `field_validator(..., mode="before")` 패턴 유지 (예: `providers/wsj/models/active.py`).
4. **provider가 import 시점에 자산 파일/네트워크를 요구하면 fail-soft로** — IMF `imf_cache.pkl.gz`가 없어 import가 죽으면 providers_init 전체(→ REST/WS 워커)가 못 뜨는 사고가 있었다. 자산 파일은 두 spec의 `datas`에 추가.
5. Provider `metadata={"group": "macro"|"stock"}` 지정 → `/api/providers` 그룹 노출.

### F. KIS형 — 다중 자격증명 / 스트리밍

- `Provider(credentials=["appkey", "appsecret"])` — 단일 `api_key`가 아님.
- Fetcher 키스토어(`data_fetcher/server/keystore.py`)는 다중 필드 지원: 프론트 `/settings`(SettingsPage.jsx)와 keys API의 `fields` 사용.
- REST/WS 분리를 `rest.py`/`stream.py`로. httpx/websockets는 함수 내부 지연 import(§7 hiddenimports 주의).
- providers_init에서 try/except 등록(의존성 없는 환경 fail-soft).

---

## 2. Standard model (신규 model일 때만)

`data_fetcher/abstract_provider/standard_models/<model>.py`:

```python
from data_fetcher.abstract_provider.abstract.data import BaseData
from data_fetcher.abstract_provider.abstract.query_params import BaseQueryParams

class <Model>QueryParams(BaseQueryParams):
    symbol: str = Field(description="종목 코드")     # 공통 입력만

class <Model>Data(BaseData):
    symbol: str = Field(description="종목 코드")     # 모든 provider 공통분모만
```
- `BaseData`/`BaseQueryParams`는 `extra='allow'` + camelCase→snake_case alias + 빈문자열→None 정리를 기본 제공.
- provider 고유 필드는 여기 말고 provider 서브클래스에.
- `standard_models/__init__.py`에 export + `__all__` 추가.

---

## 3. Provider fetcher 공통 규칙

```python
class <P><M>QueryParams(<M>QueryParams): ...   # provider 고유 입력
class <P><M>Data(<M>Data): ...                 # provider 고유 출력
class <P><M>Fetcher(<베이스>[<P><M>QueryParams, <P><M>Data]):
    transform_query / (a)extract_data / transform_data
```
- `aextract_data`를 정의하면 `extract_data`로 자동 연결(둘 중 하나만).
- **입력 필드명을 같은 category 내에서 통일** — polygon `ticker` vs social `symbol`로 갈라져 provider 전환이 깨진 전례. 불가피하면 `__alias_dict__`로 흡수.

---

## 4. 등록 (`data_fetcher/providers_init.py`)

- 상단 import + 해당 provider `fetcher_dict`에 `"<category>": <Fetcher>` 추가. category key가 곧 QueryExecutor model / API category 이름(snake_case).
- **새 provider면**: `Provider(...)` 생성 + `register_all_providers()`에 register. 키 필요 시 `credentials=[...]`, `routes/providers.py`의 `_PROVIDER_META`/`_PROVIDER_GROUP_FALLBACK`에 표시 메타.
- 선택적 의존성/취약한 import는 **try/except ImportError + `if provider is not None: register`** 패턴 (db/kis/quantlib/quantitative 블록 참조).

## 5. 캐시 TTL (`query_executor.py` `_DEFAULT_TTL`)

model별 TTL(초). 실시간 60 / 반-신선 300~600 / 일일 1800~3600. 같은 category가 이미 있으면 생략.

## 6. 라우트 + 프론트 위젯

- 기본: 게이트웨이 `GET /api/data/<provider>/<category>?param=…` — 무코드. provider별 파라미터 폼은 `/api/data/{provider}/{model}/schema`가 자동 생성.
- 전용 라우트가 필요하면 `routes/<area>.py`에서 `QueryExecutor.fetch(...)` 호출 + **`provider: str = "<default>"` 쿼리 파라미터 노출**.
- `widgetEndpoints.js`에 위젯 추가(`category` 지정 시 provider 셀렉터 자동) + `urlWidgetMap.js` 화면 등록.
- 프론트는 항상 `res.results`로 읽는다(OBBject 계약) — `.data` 참조 금지.

---

## 7. exe(PyInstaller) 번들 영향 — 배포되는 Fetcher까지 생각하기

providers_init이 정적 import하므로 **모듈 자체는 자동 번들**된다. 하지만:

1. **함수 내부 지연 import 모듈은 정적분석이 못 잡는다** → `build/MarketPulseFetcher.spec`과 `build/MarketPulseFetcherSidecar.spec` **양쪽** `hiddenimports`에 추가. (사례: SEC의 `xmltodict` 누락 → exe에서 13F 파싱 시 ModuleNotFoundError)
2. **provider 자산 파일**(예: IMF `imf_cache.pkl.gz`)은 양쪽 spec `datas`에 추가하고, 없어도 import가 죽지 않게 fail-soft.
3. 무거운/백엔드 전용 의존성(sqlalchemy, scipy 등)은 spec `excludes` 유지 + providers_init try/except.
4. 빌드·배포: `bash build/build.sh` (Win/Mac 공용, 실제 바탕화면에 복사). Tauri sidecar는 `build/build_sidecar.sh`.
5. 배포 환경에서 keyless 스크래핑 provider(yahoo/whalewisdom 등)는 **사용자 로컬 Fetcher 워커로 위임**된다 — default 위젯에는 지양(SEC 게이트웨이 위젯 선호).

---

## 8. 검증

```bash
# (a) 레지스트리 등록 + category별 provider 확인
python -c "import data_fetcher.providers_init; from data_fetcher.utils.registry import FetcherRegistry; print(FetcherRegistry.list_providers('<category>'))"

# (b) fetcher 단위 TET 검증 (실 호출)
python -c "import data_fetcher.providers_init; from data_fetcher.providers.<p>.<m> import <F> as F; F.test({'symbol':'AAPL'})"

# (c) 게이트웨이: GET /api/data/<provider>/<category>?symbol=AAPL / GET /api/providers
# (d) 프론트 빌드: cd app/frontend && npm run build
# (e) 지연 import를 추가했다면: bash build/build.sh 후 exe로 해당 model 1회 호출
```

## 체크리스트

- [ ] §1 구조 선택 (베이스 클래스 + 파일 위치)
- [ ] standard model(신규 시) + `__init__.py` export
- [ ] provider fetcher: 표준 상속 + TET + 제네릭 subscript
- [ ] 같은 category 내 입력 필드명 통일
- [ ] providers_init: import + fetcher_dict + (신규 provider) register (+ 취약 import는 fail-soft)
- [ ] TTL / 라우트(`?provider=` 노출) / widgetEndpoints + urlWidgetMap
- [ ] 지연 import·자산 파일 → 두 spec 반영 (hiddenimports / datas)
- [ ] §8 검증 통과

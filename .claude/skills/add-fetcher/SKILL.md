---
name: add-fetcher
description: data_fetcher에 새 데이터 소스(provider/model fetcher)를 추가할 때 사용. provider 디렉터리 배치 표준(model fetcher는 예외 없이 providers/<p>/models/) + 베이스 클래스 선택(ApiFetcher 선언형 / LibraryFetcher·yfinance / DbFetcher / ComputeFetcher / KIS형 다중자격증명) + TET 파이프라인 + standard model 상속 + provider 패키지 Provider 정의 · providers_init 등록 + OpenBB식 범용 series 조합 + 라우트 등록(routes/ 자동 탐색)·인증 게이트 + 위젯 연결 + exe(Rust 런처 + 내장 Python) 번들 주의사항까지 안내한다. "fetcher 추가", "새 provider 붙이기", "새 지표/모델 추가", "yahoo/fmp/polygon 등에 모델 추가" 같은 요청에 사용.
---

# Fetcher 추가 가이드

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
- 유형별 베이스: `MarketpulseFetcher/data_fetcher/abstract_provider/abstract/base_fetchers.py`
- 표준 모델: `MarketpulseFetcher/data_fetcher/abstract_provider/standard_models/<model>.py` (+ `__init__.py` export)
- provider fetcher: `MarketpulseFetcher/data_fetcher/providers/<provider>/…` (구조는 아래 §1)
- provider 정의: `providers/<p>/__init__.py` 의 `<p>_provider = Provider(...)` (OpenBB `openbb_<p>/__init__.py` 와 같음)
- 등록: `MarketpulseFetcher/data_fetcher/providers_init.py` — 패키지의 `<p>_provider` 를 import 해 `PROVIDERS` 에 넣기만 한다 / 캐시 TTL: `query_executor.py`의 `_DEFAULT_TTL`
- 라우트: 범용 게이트웨이 `MarketpulseWeb/app/backend/api/routes/data.py`(무코드) 또는 전용 `routes/<area>.py`
- 프론트: `MarketpulseWeb/app/frontend/src/widget/registry/widgetEndpoints.js` + `urlWidgetMap.js`
- exe 빌드: `MarketpulseFetcher/build/build.py` + 번들 의존성 `MarketpulseFetcher/build/requirements-fetcher.txt` (런처: `MarketpulseFetcher/launcher`)

---

## 0. 먼저 판단: 새 model인가, 기존 model의 새 provider인가?

- **기존 model에 provider 추가** (예: `income_statement`를 tiingo로도) → standard model **재사용**. §1~2 구조 선택 후 §3부터.
- **완전히 새 model** → standard model부터 신규 작성(§2). 같은 category에 provider가 2개 이상이면 프론트 provider 셀렉터가 자동 노출된다.

## 0-1. 새 provider 는 코드 provider 로 (JSON 스펙 provider 는 기존 유지용)

**새 데이터 소스는 단순 REST API 라도 §1 이후의 코드 provider 양식으로 만든다** — standard model 선언 →
`providers/<p>/models/` fetcher(TET) → `providers/<p>/__init__.py` 의 `Provider(...)` → providers_init 등록,
이름 규칙까지 다른 provider 와 똑같이. 같은 성격의 기존 provider(시계열 통계면 fred · kosis)를 먼저 읽고
파일 배치 · 클래스명 · 등록 지점을 그대로 맞춘다.

`providers/declarative/specs/*.json`(JSON 스펙 provider, 실례 `ecos.json`)은 이미 있는 것을 유지하기 위한 경로다.
새 provider 를 이걸로 만들지 않는다 (KOSIS 를 JSON 스펙으로 만들었다가 "기존 fetcher 양식을 따르라"로 되돌린 전례).

## 0-2. 매크로 지표면 개념(concept)에 매핑

CPI·실업률·정책금리처럼 **여러 provider가 같은 것을 제공하는 지표**는 `data_fetcher/concepts.py`
의 `CONCEPTS` 에 `ConceptImpl(provider, model, countries, params, scale, yoy)` 를 추가한다.
`/api/concepts/{id}` 가 국가와 '내 키' 기준으로 구현을 골라 같은 단위(%)로 정규화해 준다 —
위젯(`conceptWidget(...)`)은 provider 를 모른다. 구현 순서 = 우선순위(국가 전용 원천 → 국제기구).
값 단위가 비율이면 `scale=100`, 수준 시계열이면 `yoy=True`. 실제 호출로 국가별 응답을 확인하고
데이터가 없는 국가(404/관측치 거의 없음)는 `countries` 에서 뺀다.

---

## 1. provider 디렉터리 배치 (모든 provider 동일)

**model fetcher는 예외 없이 `models/` 안에 둔다.** provider 최상위에는 인프라 파일만 남긴다.

```
MarketpulseFetcher/data_fetcher/providers/<p>/
  __init__.py          ← fetcher import + `<p>_provider = Provider(...)` 정의 (providers_init 은 모으기만)
  models/              ← model fetcher 전부. 파일명은 주 category 키 (snake_case)
    __init__.py
    series.py          ← (시계열 API) 범용 series fetcher — 이 provider 의 HTTP 를 하는 유일한 곳
    <model>.py
  utils/
    helpers.py         ← 상수 · 지표별 코드 맵 · 순수 함수 (HTTP 없음. OpenBB fred_helpers.py 처럼)
  assets/              ← 동봉 데이터 파일 (imf_cache.pkl.gz 등)
  rest.py / stream.py / client.py   ← provider 인프라 (kis 처럼 필요할 때만)
```

한 모듈이 **밀접하게 관련된 category 여럿**을 담는 것은 정상이다 — fmp `gainers.py` 는
gainers/losers/most_actives 를, yahoo `insider_trading.py` 는 거래·보유·요약 3종을 함께
정의한다(같은 QueryParams·엔드포인트를 공유한다). 쪼개지 말고 주 category 이름을 쓴다.

배치를 **데이터 소스 유형이나 이식 출처와 무관하게 하나로 고정**한다. 예전에는 OpenBB에서
이식한 provider만 `models/`를 쓰고 나머지는 최상위에 평평하게 뒀는데, 이건 코드의 성질이
아니라 **출처**로 갈린 규칙이라 처음 보는 사람이 예측할 수 없었다(`bls`는 `models/`인데
`fred`는 최상위인 이유를 코드만 봐서는 알 수 없다). 한 provider가 양쪽을 동시에 쓰는 일도 생겼다.

## 1-0. 흐름 — OpenBB 처럼 "범용 series fetcher + 지표 모델 조합"

시계열 API(fred · kosis …)는 OpenBB `openbb_fred` 와 같은 흐름을 따른다:

```
지표 모델 (cpi · mining_manufacturing_index …)
  transform_query   자기 파라미터 검증 (category · measure · 기간)
  aextract_data     helpers 의 코드 맵으로 series_id/통계표 코드를 만든 뒤
                    await <P>SeriesFetcher.fetch_data(dict(...), credentials)     ← HTTP 는 여기 안에서만
  transform_data    지표에 맞게 정규화 (category 키 · 단위 환산 · yoy/mom) → AnnotatedResult(result, metadata)
```

- **HTTP · 오류 코드 · 호출 간격(Semaphore + sleep) · 로그는 범용 series fetcher 한 곳**에 둔다 (`fred/models/generic_series.py`, `kosis/models/series.py`).
  helper 클래스에 HTTP 를 두지 않는다 — 원본 해석(시점 문자열 · 콤마 · 통계부호 · 전각 단위)이 지표마다 중복되기 때문.
- 여러 계열은 범용 fetcher 가 한 번에 받는다 (fred: `series_id="A,B"` 병렬 요청 · kosis: 코드 `'+'` 로 이어 요청 1번).
- 빈 결과는 `EmptyDataError` 대신 빈 목록 — 게이트웨이가 예외를 400 으로 바꿔 위젯이 '오류'를 띄우므로 (OpenBB 와 다른 점).
- 안쪽 호출은 QueryExecutor 를 거치지 않는다 — 캐시 · 서킷브레이커는 바깥 지표 모델 단위로 걸린다.
- 테스트는 `data_fetcher.utils.provider_helpers.amake_json_request` 한 곳을 대체하면 전 경로가 검증된다 (`tests/test_kosis_provider.py`).

## 1-1. 베이스 클래스 선택

| 데이터 소스 유형 | 베이스 | 예시 |
|---|---|---|
| 원격 HTTP API (키 유/무) | `ApiFetcher` | fmp, polygon, fred, wsj, bls, eia, oecd, imf, sec |
| 파이썬 라이브러리 래퍼 | `LibraryFetcher` / `YFinanceFetcher` | yahoo(yfinance), krx(pykrx) |
| 로컬 SQLite 조회 | `DbFetcher` | database(stock_ranking, stock_list) |
| 순수 로컬 계산 | `ComputeFetcher` | quantitative, quantlib |
| 다중 자격증명·스트림 | `ApiFetcher` + `rest.py`/`stream.py` 분리 | kis (appkey/appsecret) |

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
- sync `extract_data`로 구현해도 됨 — `fetch_data`가 `asyncio.to_thread`로 워커 스레드에서 실행한다(루프 블로킹 없음, contextvar 전달). 단 스레드풀 크기만큼만 동시 실행되므로 대량 병렬 HTTP는 aextract_data가 낫다. `library_name` 선언.
- 예시: `providers/yahoo/models/dividends.py`.

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
- 테이블은 적재 배치 의존(예: `mbs_in_stk_stbd` ← `MarketpulseBatch/jobs/backfill_stk_stbd.py`). **적재가 없으면 빈 응답**이므로 어느 배치가 채우는지 도큐스트링에 명시. 클라우드 반영은 `MarketpulseBatch/jobs/sync_db_to_cloud.py`(/api/ingest) 경유.
- 새 테이블이면 ORM 을 **양쪽에 각각** 정의한다: 웹 `MarketpulseWeb/app/backend/models/orm/ingest.py`(스키마 주인, alembic 리비전) + 배치 `MarketpulseBatch/index_analyzer/db/orm/ingest.py`(로컬 적재). database provider 가 읽는다면 `MarketpulseFetcher/data_fetcher/providers/database/schema.py` 에도. 그다음 `/api/ingest` whitelist(`MarketpulseWeb/app/backend/api/routes/ingest.py` `_TABLES`) + sync 스크립트 `TABLES`에 추가. 컬럼이 어긋나면 `tests/test_ingest_contract.py` 가 실패한다.

### D. ComputeFetcher — 순수 로컬 계산

- 네트워크/credentials 없음. scipy·QuantLib 등 **선택적 의존성이면 providers_init에서 try/except 등록** (quantlib/quantitative 블록 참조) + `requirements-fetcher.txt`에 넣을지(용량) 판단.

### E. OpenBB 이식 시 추가로 할 일

배치는 §1과 같다(`models/`). 이식 특유의 작업만 여기 적는다 — 프로젝트 네이티브로 옮긴다(`_obb` shim 금지):
1. import 경로 치환: `openbb_core.provider.abstract.*` → `data_fetcher.abstract_provider.abstract.*`, standard models → `data_fetcher.abstract_provider.standard_models.*` (OpenBB 전용 베이스는 `standard_models/openbb/_base` 참조), 요청 헬퍼 → `MarketpulseFetcher/data_fetcher/utils/provider_helpers.py`.
2. raw 키 매핑은 `__alias_dict__` + `field_validator(..., mode="before")` 패턴 유지 (예: `providers/wsj/models/active.py`).
3. **provider가 import 시점에 자산 파일/네트워크를 요구하면 fail-soft로** — IMF `imf_cache.pkl.gz`가 없어 import가 죽으면 providers_init 전체(→ REST/WS 워커)가 못 뜨는 사고가 있었다. 자산 파일은 spec의 `datas`에 추가.
4. Provider `metadata={"group": "macro"|"stock"}` 지정 → `/api/providers` 그룹 노출.

### F. KIS형 — 다중 자격증명 / 스트리밍

- `Provider(credentials=["appkey", "appsecret"])` — 단일 `api_key`가 아님.
- Fetcher 키스토어(`MarketpulseFetcher/data_fetcher/server/keystore.py`)는 다중 필드 지원: 프론트 `/settings`(`MarketpulseWeb/app/frontend/src/pages/settings/SettingsPage.jsx`)와 keys API의 `fields` 사용.
- REST/WS 분리를 `rest.py`/`stream.py`로. httpx/websockets는 함수 내부 지연 import(§7 hiddenimports 주의).
- providers_init에서 try/except 등록(의존성 없는 환경 fail-soft).

---

## 2. Standard model (신규 model일 때만)

`MarketpulseFetcher/data_fetcher/abstract_provider/standard_models/<model>.py`:

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

## 4. 등록 — provider 패키지 `__init__.py` + `providers_init.py`

- **모델 추가**: `providers/<p>/__init__.py` 에 fetcher import + `<p>_provider` 의 `fetcher_dict` 에 `"<category>": <Fetcher>`. category key가 곧 QueryExecutor model / API category 이름(snake_case).
- **새 provider**: `providers/<p>/__init__.py` 에 `<p>_provider = Provider(name, description, website, credentials, fetcher_dict, metadata={"group": ...})` 정의
  → `providers_init.py` 에 `from data_fetcher.providers.<p> import <p>_provider` + `PROVIDERS` 목록에 추가.
  키가 필요하면 `credentials=["api_key"]` + `utils/api_keys.API_ENV_MAPPING` 의 `<P>_API_KEY`, 설정 화면 표시는
  `provider_catalog._INFO`(label · key_docs · key_test) · `routes/providers._PROVIDER_GROUP_FALLBACK` · 프론트 `common/widget/sources.js` 라벨.
- 선택적 의존성/취약한 import는 `providers_init.py` 에서 **패키지 import 를 try/except ImportError** 로 감싸고 실패하면 `<p>_provider = None` (db/kis/quantlib/quantitative 블록 참조) — `PROVIDERS` 의 None 은 등록에서 건너뛴다.

## 5. 캐시 TTL (`query_executor.py` `_DEFAULT_TTL`)

model별 TTL(초). 실시간 60 / 반-신선 300~600 / 일일 1800~3600. 같은 category가 이미 있으면 생략.

## 6. 라우트 + 프론트 위젯

- 기본: 게이트웨이 `GET /api/data/<provider>/<category>?param=…` — 무코드. provider별 파라미터 폼은 `/api/data/{provider}/{model}/schema`가 자동 생성.
- 전용 라우트가 필요하면 `MarketpulseWeb/app/backend/api/routes/<area>.py`에서 `QueryExecutor.fetch(...)` 호출 + **`provider: str = "<default>"` 쿼리 파라미터 노출**.
- **새 라우트 파일은 `MarketpulseWeb/app/backend/api/routes/` 에 두기만 하면 자동 등록된다** (`api/routers.py` 의 자동 탐색 — 모듈의 `router` 를 찾아 붙인다). 붙는 주소는 `PREFIX`(기본 `/api`) + `APIRouter(prefix="/my-area")` 이므로 라우터에 자기 구간 prefix 를 준다. 앞부분이 다르면 모듈에 `PREFIX = "/api/stock"` 처럼, `/{provider}/{model}` 처럼 넓게 받는 범용 라우트면 `ORDER = 900` 으로 뒤로 보낸다. 태그는 `TAGS`(기본 모듈 이름). `tests/test_app_boot.py` 가 등록 누락을 잡는다.
- **인증 게이트는 deny-by-default다**(`MarketpulseWeb/app/backend/core/middleware/auth_gate.py`). `/api/` 아래 새 경로는 자동으로 Bearer 토큰을 요구하므로 별도 조치가 필요 없다. 반대로 **공개가 필요하면 그 파일의 `PUBLIC_PATHS`/`PUBLIC_PREFIXES`에 명시해야 한다** — 무심코 `/api/` 밖(루트)에 엔드포인트를 달면 `test_app_boot.py`가 실패한다(과거 무인증 노출 사고의 재발 방지).
- `widgetEndpoints.js`에 위젯 추가(`category` 지정 시 provider 셀렉터 자동) + `urlWidgetMap.js` 화면 등록.
- 프론트는 항상 `res.results`로 읽는다(OBBject 계약) — `.data` 참조 금지.

---

## 7. exe 번들 영향 — 배포되는 Fetcher까지 생각하기

exe 는 Rust 런처(`MarketpulseFetcher/launcher`)가 내장 Python 런타임 + `data_fetcher` 패키지 폴더 통째(자산 파일 포함, tests 제외)를 품고 실행한다. 정적분석이 없으므로 모듈·자산 누락 걱정은 없지만 **서드파티 패키지는 명시한 것만 들어간다**:

1. **새 서드파티 의존성은 `MarketpulseFetcher/build/requirements-fetcher.txt`에 버전 고정으로 추가** (지연 import 포함). 누락 시 exe에서만 ModuleNotFoundError. (루트 requirements.txt 는 exe에 쓰이지 않는다) 서버·배치용으로는 `MarketpulseFetcher/requirements.txt`에도 추가 — Docker 이미지는 `MarketpulseWeb/requirements.txt`(→ 이 파일을 `-r`)만 설치하므로 누락 시 운영 서버에서만 ModuleNotFoundError.
2. 무거운/백엔드 전용 의존성(sqlalchemy, scipy 등)은 requirements-fetcher.txt 에서 빼고 providers_init try/except 로 건너뛴다.
3. 빌드·배포: `python MarketpulseFetcher/build/build.py` (Win/Mac 공용, uv·cargo 필요, 실제 바탕화면에 복사. CI는 `--no-desktop`). 빌드 중 번들 런타임으로 `providers_init` import 를 확인한다.
5. 배포 환경에서 keyless 스크래핑 provider(yahoo/whalewisdom 등)는 **사용자 로컬 Fetcher 워커로 위임**된다 — default 위젯에는 지양(SEC 게이트웨이 위젯 선호).

---

## 8. 검증

```bash
# (a) 테스트 기준선 — import 깨짐·라우터 등록 누락을 여기서 먼저 잡는다
python -m pytest

# (b) 레지스트리 등록 + category별 provider 확인
# 패키지가 MarketpulseFetcher/ 아래에 있으므로 import 경로 지정 (Common 은 database provider 용, Mac 은 ; 대신 :)
PYTHONPATH="MarketpulseFetcher" python -c "import data_fetcher.providers_init; from data_fetcher.utils.registry import FetcherRegistry; print(FetcherRegistry.list_providers('<category>'))"

# (c) fetcher 단위 TET 검증 (실 호출)
PYTHONPATH="MarketpulseFetcher" python -c "import data_fetcher.providers_init; from data_fetcher.providers.<p>.models.<m> import <F> as F; F.test({'symbol':'AAPL'})"

# (d) 게이트웨이: GET /api/data/<provider>/<category>?symbol=AAPL / GET /api/providers
# (e) 프론트 빌드: cd MarketpulseWeb/app/frontend && npm run build
# (f) 서드파티 의존성을 추가했다면: requirements-fetcher.txt 반영 → python MarketpulseFetcher/build/build.py 후 exe로 해당 model 1회 호출
```

## 체크리스트

- [ ] 파일 위치: `providers/<p>/models/<model>.py` (예외 없음) + 베이스 클래스 선택(§1-1)
- [ ] standard model(신규 시) + `__init__.py` export
- [ ] provider fetcher: 표준 상속 + TET + 제네릭 subscript
- [ ] 같은 category 내 입력 필드명 통일
- [ ] 시계열 API면 범용 series fetcher 한 곳에서만 HTTP, 지표 모델은 그걸 조합 (§1-0) · utils/helpers.py 는 HTTP 없음
- [ ] `providers/<p>/__init__.py` 의 `Provider(...)` fetcher_dict + (신규 provider) providers_init `PROVIDERS` 등록 (+ 취약 import는 fail-soft)
- [ ] TTL / 라우트(`?provider=` 노출) + **새 라우트면 `routes/` 에 두고 `APIRouter(prefix=…)` 확인 (자동 등록)** / widgetEndpoints + urlWidgetMap
- [ ] 지연 import·자산 파일 → spec 반영 (hiddenimports / datas)
- [ ] §8 검증 통과

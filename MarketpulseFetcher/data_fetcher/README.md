# data_fetcher — 데이터 조회 계층

OpenBB 스타일 **TET(Transform-Extract-Transform) 파이프라인 + standard model** 구조.
웹 백엔드(`MarketpulseWeb/app/backend`)와 사용자 PC에 배포되는 Fetcher exe가 같은 코드를 공유한다.

새 provider/model 추가 절차는 `.claude/skills/add-fetcher/SKILL.md`가 기준 문서다.

## 진입점

```python
import data_fetcher.providers_init  # noqa: F401 — provider 등록
from data_fetcher.query_executor import QueryExecutor

rows = await QueryExecutor().execute("fred", "gdp", {"start_date": "2020-01-01"})
```

`QueryExecutor` 는 OpenBB `openbb_core.provider.query_executor` 와 같은 모양의 **순수 실행기**다 —
`get_provider` → `get_fetcher` → `filter_credentials` → 파라미터 거르기 → `fetcher.fetch_data()`.
캐시 · 실행 위치(로컬 전용 / 서버) · 사용자 키 · 서킷브레이커는 **없다** — 그건 부르는 쪽의 일이다:

- 웹 서버: `MarketpulseWeb/app/backend/core/execution` (ServerExecutor) — fetcher 의 `target` 으로 위임을 정한다
  (긴급 전환만 DB 표 `data_model_routes`)
- 사용자 PC Fetcher: `server/runner.py` (이 PC 의 키 + 작은 TTL 캐시) — `target="local"` fetcher 만 실행
- 배치: 그대로 `QueryExecutor().execute`

app 계층(`MarketpulseWeb/app/backend/platform/` — Router · Query · CommandRunner · ProviderInterface · OBBject · concepts, OpenBB `openbb_core.app`)의 `Query.execute` 는
`ProviderInterface.create_executor()` 가 주는 실행기를 쓴다 (기본은 순수 QueryExecutor, 웹 서버는 ServerExecutor 를 끼운다).
provider 계층(fetcher · 순수 실행기 · utils)은 app 계층을 import 하지 않는다. fetcher 는 다른 fetcher 나 실행기를
부르지 않는다 (예외 목록은 `tests/test_module_boundaries.py`).

## 구조

```
data_fetcher/
├── query_executor.py        # 순수 실행기 (OpenBB QueryExecutor) — 캐시 · 위임 없음
├── providers_init.py        # 각 패키지의 <p>_provider 를 모아 등록만 (선택 의존성은 fail-soft)
├── abstract_provider/
│   ├── abstract/            # Fetcher, Api/Db/Compute/Library 베이스, BaseData/BaseQueryParams, Provider
│   └── standard_models/     # model(category)별 공통 QueryParams/Data — provider 간 shape 통일
├── providers/
│   ├── api/<p>/             # 외부 API provider (폴더 이름 = provider 이름) — 아래 구성
│   └── db/                  # 중앙 DB provider (이름 "db") — api/<p>/ 와 같은 구성
│   (provider 폴더 구성)
│   ├── __init__.py          # <p>_provider = Provider(...) 정의 (OpenBB openbb_<p>/__init__.py 와 같음)
│   ├── models/<model>.py    # model fetcher (예외 없이 여기)
│   ├── utils/helpers.py     # 상수 · 코드 맵 · 순수 함수 (HTTP 없음)
│   └── assets/              # 동봉 데이터 파일
├── core/                    # model_schema(위젯 폼 스키마), warnings — 웹 계층(OBBject · Router 등)은 app/backend/platform/
├── server/                  # Fetcher exe 측: 로컬 REST, 백엔드 WS 워커, 키스토어, wire.py(WS 메시지 계약 · hello)
├── utils/                   # api_keys, http_client, circuit_breaker, registry 등
├── assets/                  # exe 아이콘 / 키 관리 UI
├── app.py, tray.py          # Fetcher exe 진입점 (트레이 / 헤드리스)
└── tests/                   # 레지스트리 스모크
```

## Fetcher 골격

```python
class FMPThingFetcher(ApiFetcher[FMPThingQueryParams, FMPThingData]):
    api_key_env = "FMP_API_KEY"

    @staticmethod
    def transform_query(params): return FMPThingQueryParams(**params)

    @staticmethod
    def build_url(query, api_key): return f"https://…?symbol={query.symbol}&apikey={api_key}"

    @staticmethod
    def transform_data(query, data, **kwargs): return [FMPThingData(**r) for r in data]
```

`QueryParams`/`Data`는 `standard_models/<model>.py`를 상속한다. 등록은 `providers/api/<p>/__init__.py`(DB 는 `providers/db/__init__.py`) 의
`Provider(...)` fetcher_dict (새 provider 면 `providers_init.py` 의 `PROVIDERS` 에도).

## 흐름 — HTTP 헬퍼 + 지표 모델 (fred · kosis · sec 적용)

```
지표 모델 (cpi · mining_manufacturing_index …)
  aextract_data   helpers 코드 맵 → await <p>_series(dict(...), credentials)   ← utils/series.py HTTP 헬퍼 (다른 fetcher 를 부르지 않는다)
  transform_data  지표 정규화 (category 키 · 단위 · yoy/mom) → AnnotatedResult(result, metadata)
라우트 · 서비스
  OBBject.from_result(raw, provider)   응답 (AnnotatedResult 풀기 · metadata 보존 · 직렬화)
  OBBject.unwrap(raw) / metadata_of    모델 객체 그대로 계산할 때
```

- HTTP · 오류 코드 · 호출 간격(Semaphore + sleep) · 로그는 provider 의 HTTP 헬퍼 한 곳 (`fred/utils/series.py`, `kosis/utils/series.py`,
  `sec/utils/filings.py` · `sec/utils/institutions.py`). 범용 series fetcher 와 지표 모델이 모두 그걸 쓴다.
- `utils/helpers.py` 에는 HTTP 를 두지 않는다 (OpenBB `fred_helpers.py` 처럼 상수 · 코드 맵 · 순수 함수).
- 라우트 · 서비스 · provider 는 `isinstance(raw, AnnotatedResult)` 를 직접 쓰지 않는다 — `tests/test_response_envelope.py` 가 막는다.

## TODO — 모든 provider 를 이 흐름으로

2026-11 에 **provider 정의 위치**(22개 전부)와 **AnnotatedResult → OBBject**(전부)는 맞췄고,
**HTTP 한 곳 + 지표 조합**은 fred · kosis 만 적용했다. 나머지 provider 도 같은 흐름으로 옮긴다.
옮길 때는 실 API 로 모델 전부를 호출해 결과를 전후 비교한다 (fred 는 30개 중 28개 동일, 나머지 2개는 의도한 차이였다).

| provider | 지금 HTTP 위치 | 할 일 |
|---|---|---|
| fmp | 모델 11개 각자 + `utils/helpers.py` | 범용 요청 fetcher 하나로 모으고 모델은 조합, helpers 에서 HTTP 제거 |
| oecd | 모델 8개 각자 + `utils/helpers.py` | SDMX 범용 series fetcher + 지표 조합 |
| imf | `utils/` 3곳 | SDMX 범용 series fetcher + 지표 조합 (자산 파일 fail-soft 유지) |
| polygon | 모델 7개 각자 + `utils/helpers.py` | 범용 요청 fetcher + 모델 조합 |
| sec | 모델 9개 + `utils/` 6곳 | EDGAR 요청(User-Agent · 초당 10건)을 한 곳으로, 파서는 utils 에 순수 함수로 |
| bls · eia | `utils/helpers.py` | `series` fetcher 로 HTTP 이동 (bls 는 이미 series 모델 있음), helpers 는 순수 함수만 |
| alphavantage · wsj · nasdaq | 모델마다 각자 | 범용 요청 fetcher + 모델 조합 |
| tiingo · social · nasdaqtrader · bond · krx | 모델 1~2개 | 모델이 늘 때 같이 — 지금은 그대로 둬도 됨 |
| yahoo · kis · database · quantlib · quantitative | 라이브러리 · DB · 계산 · 전용 클라이언트 | 해당 없음 (HTTP 를 직접 하지 않거나 rest.py/stream.py 인프라) |

바꾸지 않기로 한 것 (비용 > 이득): 키 필드 이름 `<p>_api_key` 통일(저장된 사용자 키 마이그레이션 필요),
모델 키 · 표준 모델을 OpenBB 이름으로(`/api/data` 주소 · 위젯 · DB 위젯 행 · concepts 전부 영향).

## TODO — 웹 백엔드(`MarketpulseWeb/app/backend`)도 OpenBB 식으로 (다음 단계)

OpenBB 는 `openbb_core/app`(Router · CommandRunner · Query) + `openbb_core/api`(exception_handlers) 가 이 계층을 맡는다.
지금 이 프로젝트와 다른 점과 할 일:

| | OpenBB | 지금 | 할 일 |
|---|---|---|---|
| 엔드포인트 | `@router.command(model="ConsumerPriceIndex")` — 파라미터 · provider 선택지 · REST 경로를 표준 모델에서 자동 생성, 본문은 `return await OBBject.from_query(Query(**locals()))` 한 줄 | 영역별 라우트를 손으로 작성 (`macro.py` · `stock.py` …). 범용 게이트웨이 `/api/data/{p}/{m}` 와 `fundamental.py` 만 비슷 | 손 라우트를 표준 모델 기반 command 로 — 프론트 엔드포인트 주소가 바뀌므로 위젯 레지스트리 · DB 위젯 행과 같이 옮긴다 |
| 가공 로직 | fetcher `transform_data` / 계산 command(`methods=["POST"]`, `OBBject(results=…)`) | 옮김 — 배치 테이블 읽기는 `db` provider (fx_rate · quote · stock_list 필터 · company_profile · company_relations · sector_performance · news_events · quant_snapshot · equity_screener · stock_ranking 정렬), 받은 뒤의 분석(지표 최신값 · 변화율 · 기업이익 %GDP · 주요 환율 · 종목 비교)은 fetcher 가 아니라 백엔드 command(`app/backend/commands/`) — fetcher 는 fred · alphavantage · yahoo 의 기본 모델(gdp · series · forex · quote · key_metrics)만 준다. `macro_service` · `portfolio_service` · `fx_service` 없음. 서비스에 남은 것은 fetcher 가 갖지 않는 상태와 조합뿐: 실시간 시세 SWR 캐시 · 프리워밍(ranking), provider 고르기 · 폴백(ranking · 관계 그래프), 사용자 전략 계산(quant — 패널은 메모리 때문에 행렬로 직접 읽음), DB 카탈로그로 짜는 화면(industry) | 사용자 전략 계산을 계산 command 로 (선택) |
| 실행 · 오류 | CommandRunner 가 OBBject 보장 · 경고 수집 · `OpenBBError` 로 감싸기, 전역 exception handler 가 HTTP 로 | `deps.route_handler` · 게이트웨이 try/except (키 없음 424 · Fetcher 꺼짐 503 · 서킷 OPEN 503) | 전역 exception handler 로 모은다 — 주소 변화 없이 내부만 바뀌어 먼저 하기 좋다 |
| 빈 결과 | `EmptyDataError` → 204 | 빈 목록 200 (위젯 '데이터 없음') | 200 + 빈 목록 유지 (204 로 바꾸면 위젯 응답 처리가 달라진다) |

## 검증

```bash
python -m pytest                       # tests/ + MarketpulseFetcher/data_fetcher/tests
python -c "import data_fetcher.providers_init; from data_fetcher.providers.api.fred.models.gdp import FREDGDPFetcher as F; F.test({})"
```

exe 빌드는 `python MarketpulseFetcher/build/build.py` (uv·cargo 필요). Rust 런처(`MarketpulseFetcher/launcher`)가 내장 Python 런타임 + data_fetcher 페이로드를 품은 단일 실행파일이며, 첫 실행 때 `%LOCALAPPDATA%/MarketPulseFetcher/runtime/<id>`에 풀고 `python -I -m data_fetcher.app`(헤드리스)를 띄운다. 번들 의존성은 `MarketpulseFetcher/build/requirements-fetcher.txt`.

## 확인 필요

- [ ] fastapi · starlette 버전 고정이 서로 어긋난다 — `MarketpulseFetcher/requirements.txt` 는 `fastapi>=0.104` · `starlette<0.48`,
  exe 번들 `build/requirements-fetcher.txt` 는 `fastapi==0.120.0` · `starlette==0.48.0`, 웹 서버 venv 는 fastapi 0.116.1 · starlette 0.47.3.
  starlette 1.x 는 fastapi 0.116 과 충돌해 기동하지 않으므로(`<0.48` 고정 이유) 어느 쪽으로 맞출지 정한다.

# data_fetcher — 데이터 조회 계층

OpenBB 스타일 **TET(Transform-Extract-Transform) 파이프라인 + standard model** 구조.
웹 백엔드(`MarketpulseWeb/app/backend`)와 사용자 PC에 배포되는 Fetcher exe가 같은 코드를 공유한다.

새 provider/model 추가 절차는 `.claude/skills/add-fetcher/SKILL.md`가 기준 문서다.

## 진입점

```python
import data_fetcher.providers_init  # noqa: F401 — provider 등록
from data_fetcher.query_executor import QueryExecutor

rows = await QueryExecutor.fetch("fred", "gdp", {"start_date": "2020-01-01"})
```

`QueryExecutor.fetch(provider, model, params)` 가 캐시(TTL) · 서킷브레이커 · 자격증명 ·
라우팅을 처리한 뒤 `ProviderRegistry.get(provider).fetcher_dict[model].fetch_data()` 를 호출한다.

- **원격 위임**: `_remote_only_providers`(yahoo)와 `_local_only_models`(13F 원본 파싱)는
  웹 서버에서 직접 실행하지 않고 그 사용자의 Fetcher 워커(`server/ws_worker.py`)로 위임한다.
- 그 외 provider는 서버에서 직접 실행한다(사용자 키 → 없으면 오류, 배치는 운영자 키).
- fetcher 안에서 다른 모델이 필요하면 `QueryExecutor.fetch` 를 지연 import로 호출한다
  (예: `quantitative` 모델이 yahoo 시세를 받음) — 위임 규칙이 그대로 적용된다.

## 구조

```
data_fetcher/
├── query_executor.py        # 실행 진입점 (캐시·라우팅·위임)
├── providers_init.py        # Provider 생성 + fetcher_dict 등록 (선택 의존성은 fail-soft)
├── abstract_provider/
│   ├── abstract/            # Fetcher, Api/Db/Compute/Library 베이스, BaseData/BaseQueryParams, Provider
│   └── standard_models/     # model(category)별 공통 QueryParams/Data — provider 간 shape 통일
├── providers/<p>/
│   ├── models/<model>.py    # model fetcher (예외 없이 여기)
│   ├── utils/               # provider 전용 헬퍼
│   └── assets/              # 동봉 데이터 파일
├── core/                    # OBBject 응답 래퍼, CommandRouter, warnings
├── server/                  # Fetcher exe 측: 로컬 REST, 백엔드 WS 워커, 키스토어
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

`QueryParams`/`Data`는 `standard_models/<model>.py`를 상속한다. 등록은 `providers_init.py`.

## 검증

```bash
python -m pytest                       # tests/ + MarketpulseFetcher/data_fetcher/tests
python -c "import data_fetcher.providers_init; from data_fetcher.providers.fred.models.gdp import FREDGDPFetcher as F; F.test({})"
```

exe 빌드는 `bash MarketpulseFetcher/build/build.sh` (spec: `MarketpulseFetcher/build/MarketPulseFetcher.spec`).

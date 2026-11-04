# index_analyzer 아키텍처

MarketPulse 의 **데이터 수집 장치(데몬)**. 이 문서는 수집 구조를 ① 역할 분리(중앙 수집 vs
BYOK 조회), ② Phase 1 — 종목 유니버스 입수, ③ 뉴스 입수, ④ BYOK 조회 흐름, ⑤ 저장소/스케줄/모듈
구조 순으로 정리한다.

---

## 0. 한눈에 보기

```
                         ┌──────────────────────────────────────────────┐
   사용자 본인 API 키 ──▶ │ app/backend (FastAPI)                        │
   (BYOK)                │   · 시세/재무/실시간 = 사용자 키로 on-demand   │
                         │   · 종목/뉴스        = DB 조회 (데몬이 적재)   │
                         └───────┬───────────────────────────┬──────────┘
                       BYOK 조회 │                           │ DB/캐시 조회
                                 ▼                           ▼
                  ┌──────────────────────────┐   ┌────────────────────────┐
                  │ data_fetcher             │   │ PostgreSQL  (MBS_IN_*)  │
                  │  QueryExecutor           │   │ Redis  (qe:* 공유캐시,  │
                  │  · 사용자 키로 외부 호출  │   │        stream:*)        │
                  │  · 데이터단위 공유 SWR캐시│   └───────────▲────────────┘
                  └───────────┬──────────────┘               │ 적재
                              ▼                               │
                       외부 유료 API                  ┌───────┴──────────────────┐
                  (fmp/polygon/kis/… 사용자 키)       │ index_analyzer (데몬·중앙)│
                                                      │  ★ 유료 키 0개 — 무료소스만 │
                                                      │  · crawler  → 뉴스         │
                                                      │  · universe → 종목 유니버스 │
                                                      └───────────────────────────┘
```

---

## 1. 핵심 원칙

1. **중앙 데몬은 유료 API 키를 보유하지 않는다.** 무료·공개 소스로만 동작한다.
   - 뉴스 = 크롤러(자체), KR 유니버스 = KRX/pykrx(무료), US 유니버스 = NASDAQ Trader 공개 파일(무료).
2. **크롤러는 뉴스 전용.** 종목·시세 등 정형 데이터는 크롤링하지 않는다.
3. **나머지 데이터(시세·재무·실시간·펀더멘털)는 전부 BYOK** — 사용자가 등록한 본인 API 키로,
   요청 시점에 `data_fetcher` 를 통해 가져온다. 서버는 사용자당 외부 비용을 부담하지 않는다.

삭제예정(4번)
4. **BYOK 데이터는 "데이터 단위"로 공유 캐시한다.** `AAPL` 주가는 누가 가져오든 동일하므로
   캐시 키는 `qe:{provider}:{model}:{params}` (사용자·키와 무관). 사용자 키는 *조회 권한*일 뿐,
   캐시는 전 사용자가 공유한다. → 외부 호출 최소화 + 빠른 응답.

5. **느린 조회 대응 = 선적재 + SWR.**
   - 공통·기반 데이터(종목·뉴스) → 데몬이 미리 DB 적재 → Backend는 즉시 조회.
   - BYOK 데이터 → `QueryExecutor` 의 stale-while-revalidate 공유 캐시가 흡수(첫 호출만 느림,
     이후 즉답, 만료 경계에서도 빈 화면 없음).
6. **지수/거래소는 4개로 한정**: `KOSPI`, `KOSDAQ`, `NYSE`, `NASDAQ`.

> 결과적으로 **중앙 실시간 폴러나 `rt:*` 스냅샷이 필요 없다.** 실시간(거래량 상위 등)은 BYOK +
> 공유 SWR 캐시로 처리된다. 첫 사용자가 캐시를 채우고, 이후 모든 사용자가 공유 캐시를 보며,
> 보는 사람이 있는 동안에만 백그라운드 갱신된다(아무도 안 보면 캐시는 자연 소멸).

---

## 2. 컴포넌트 책임

| 컴포넌트 | 책임 | 키/소스 |
|---|---|---|
| `data_fetcher` | "어떻게 가져오나"(HOW). QueryExecutor 가 인증·서킷브레이커·공유 SWR 캐시 담당 | BYOK(사용자 키) + 무료 provider(krx/nasdaqtrader) |
| `index_analyzer` (데몬) | "언제/무엇을/어디에 적재"(WHEN/WHAT/WHERE) — 뉴스·종목 유니버스 중앙 수집 | 무료 소스만 |
| `app/backend` | "사용자에게 어떻게"(SHOW) — BYOK 조회 + DB 조회 + 필터/정제 | 사용자 키 주입 |

---

## 3. 데이터 분류 — 중앙 적재 vs BYOK

| 데이터 | 처리 | 소스 | 저장/캐시 | 주기 |
|---|---|---|---|---|
| **뉴스** | 중앙(크롤) | 자체 크롤러(sites.yaml) | `MBS_IN_ARTICLE` (DB) | 매시 |
| **종목 유니버스** | 중앙(배치) | KR=pykrx/KRX, US=NASDAQ Trader | `MBS_IN_STBD_MST` / `MBS_IN_INDX_*` (DB) | KR 일 / US 주·월 |
| 실시간 시세·호가·체결 | **BYOK** | 사용자 키(kis/polygon/fmp…) | `qe:*` 공유캐시 (TTL 30~60s) | on-demand |
| 일별 시세·차트 | **BYOK** | 사용자 키 | `qe:*` 공유캐시 | on-demand |
| 재무·펀더멘털·애널리스트 | **BYOK** | 사용자 키(fmp/yahoo…) | `qe:*` 공유캐시 (TTL 30~60m) | on-demand |
| 거래량/등락 상위(시장무버) | **BYOK** | 사용자 키 | `qe:*` 공유캐시 (TTL ~2m) | on-demand |
| 기관/내부자/13F 등 | **BYOK** | 사용자 키(sec/whalewisdom…) | `qe:*` 공유캐시 | on-demand |

> `MBS_IN_STK_STBD`(일별시세) / `MBS_IN_FINANCIAL_METRICS`(재무) 등 시세·재무 적재 테이블은 더 이상
> 데몬이 채우지 않는다(BYOK 전환). 스크리너처럼 *대량 정렬/필터*가 필요한 화면은 §7-③ 참고.

---

## 4. Phase 1 — 종목 유니버스 입수 (최우선)

가장 먼저 구현한다. 다른 모든 기능(검색·관심종목·스크리너·BYOK 조회)의 **기준 데이터**다.

### 4.1 대상 — 4개 지수/거래소

| `indx_cd` | `indx_nm` | `indx_type` | `region` | 소스(무료) |
|---|---|---|---|---|
| `KOSPI`  | 코스피      | exchange | KR | pykrx / KRX 공개데이터 |
| `KOSDAQ` | 코스닥      | exchange | KR | pykrx / KRX 공개데이터 |
| `NYSE`   | 뉴욕증권거래소 | exchange | US | NASDAQ Trader `otherlisted.txt` |
| `NASDAQ` | 나스닥      | exchange | US | NASDAQ Trader `nasdaqlisted.txt` |

> NYSE/NASDAQ 은 *지수가 아니라 상장 거래소* 이므로 "해당 거래소 상장 전 종목"을 입수한다
> (NASDAQ-100 같은 부분집합 아님). NASDAQ Trader 심볼 디렉터리는 무료·공개·일 갱신.
> 서버 유료 키가 확보되면 FMP `/stock/list`(거래소 필터)로 대체 가능 — 단 기본은 무료 소스.

### 4.2 ORM 매핑 (기존 테이블 재사용)

```
MBS_IN_INDX_STBD   ← 4개 지수/거래소 마스터 (indx_cd, indx_nm, indx_type, region, is_active)
MBS_IN_STBD_MST    ← 전 종목 식별 마스터 (ticker_cd, ticker_nm, asset_type='stock',
                      exchange, country, sector, curr, data_source, is_active, start_date)
MBS_IN_INDX_MEMBER ← 소속 관계 (indx_cd, stk_cd, stk_nm, sector, date_added, is_current)
```

- `MBS_IN_STK_PROFILE` 의 `in_sp500/in_nasdaq100/in_dow30` 플래그는 **legacy** — 소속은
  `MBS_IN_INDX_MEMBER` 로 표현한다(4지수 체제). 프로필 상세(시총·beta·CEO 등)는 BYOK 또는
  필요 시 별도 일배치로 보강.

### 4.3 모듈 구조

```
index_analyzer/
├── collectors/                  # ★신규 — "무엇을 수집" (작업 정의)
│   ├── base.py                  #   Collector ABC: targets() → fetch() → store()
│   └── universe/                #   Phase 1
│       ├── kr_listing.py        #     KOSPI/KOSDAQ  (krx provider)
│       └── us_listing.py        #     NYSE/NASDAQ   (nasdaqtrader provider)
├── ingest/                      # ★신규 — "어디에 적재" (저장 추상)
│   └── repository.py            #   bulk upsert: MBS_IN_STBD_MST / INDX_STBD / INDX_MEMBER
└── server/
    └── scheduler.py             # universe_kr_job(일) / universe_us_job(주·월) 등록

data_fetcher/providers/          # ★신규 무료 provider (credentials=[])
├── krx/listing.py               #   pykrx 기반 KOSPI/KOSDAQ 종목 리스트
└── nasdaqtrader/listing.py      #   NASDAQ Trader 공개 파일 파싱 (NYSE/NASDAQ)
```

### 4.4 Collector 계약

```python
class Collector(ABC):
    provider: str                      # data_fetcher provider 키 ("krx", "nasdaqtrader")
    model: str                         # fetcher 모델 키 ("listing")

    @abstractmethod
    def targets(self) -> list[TargetDTO]:
        """수집 대상 (예: KR이면 [KOSPI, KOSDAQ] 시장 파라미터)."""

    async def fetch(self, t: TargetDTO) -> list[RawDataDTO]:   # 공통 — QueryExecutor 위임
        return await QueryExecutor.fetch(self.provider, self.model, t.params)  # creds 불필요(무료)

    @abstractmethod
    def store(self, index_cd: str, rows: list[RawDataDTO]) -> StoreResult:
        """repository.upsert(MBS_IN_STBD_MST + MBS_IN_INDX_MEMBER) — ingest_batch_id 단위 bulk."""
```

`RawDataDTO` 는 `data_fetcher/abstract_provider/standard_models/*` 의 표준 모델을 재사용
(예: stock_list 표준 스키마) → "규격화" 단계가 무료로 해결.

### 4.5 시퀀스

```
[scheduler] universe_kr_job (매일 새벽)
  → KRUniverseCollector.run()
      targets() : [ {market:"KOSPI"}, {market:"KOSDAQ"} ]
      fetch()   : QueryExecutor.fetch("krx", "listing", {market})        (무료, 키 없음)
      store()   : repository.upsert(MBS_IN_STBD_MST, MBS_IN_INDX_MEMBER) (bulk, batch_id)
  → 폐지 종목은 is_current=False / is_active=False 처리(소프트 만료)
──────────────────────────────────────────────────────────────────────
[사용자] 종목 검색/목록  →  GET /api/stocks?exchange=NASDAQ&sector=Tech
[backend] SELECT … FROM mbs_in_stbd_mst JOIN mbs_in_indx_member … (외부 0회, 즉시)
```

### 4.6 스케줄

| Job | 주기 | 비고 |
|---|---|---|
| `universe_kr_job` | 매일 (장 마감 후) | pykrx — 신규상장/상폐 반영 |
| `universe_us_job` | 주 1회 (또는 월) | NASDAQ Trader 파일 — 변경 드묾 |

> 기존 `scheduler.py` 의 `_monthly_collect_job`(S&P500 전체수집)·`_daily_stock_job`(주가갱신)은
> 4지수 universe 체제로 **대체**된다. `stock_service.run_sp500_initial_collection` 등은 universe
> collector 로 마이그레이션.

---

## 5. 뉴스 입수 (기존 파이프라인 유지)

뉴스만 크롤러로 처리하며, 입수 후 분석 파이프라인을 탄다.

```
IN(크롤) ──▶ stream:new_articles ──▶ PROC(감정·티커추출·요약) ──▶ CALC ──▶ RCMD
```

- IN: `services/crawl_service.crawl_with_stream` → `MBS_IN_ARTICLE` 저장 + Stream 발행
- 소비: `server/consumer.start_analyzer_consumer` → `pipeline/proc_stage`(PROC/CALC/RCMD)
- 산출: `MBS_PROC_ARTICLE` / `MBS_CALC_METRIC` / `MBS_RCMD_RESULT`

(상세 코드 흐름은 `server/worker.py`, `server/redis_bus.py` 참고. 본 절은 변경 없음.)

---

## 6. BYOK 조회 흐름 (시세·재무·실시간)

### 6.1 사용자 키 등록

- 사용자가 본인 provider 키(fmp/polygon/alphavantage/kis 등)를 등록 → **암호화 저장**.
- 위치: `app/backend` (User 도메인). 권장: `UserApiKey(user_id, provider, enc_key, ...)` 신규 테이블
  + 앱 비밀키로 대칭 암호화. (ORM `models/orm/user.py` 에 추가)

### 6.2 조회 경로

```
[frontend] GET /api/stock/AAPL/quote
[backend]
   creds = decrypt(UserApiKey[user, "fmp"])
   result = await QueryExecutor.fetch("fmp", "quote", {"symbol":"AAPL"}, credentials=creds)
            │
            ├─ [1] qe:fmp:quote:{"symbol":"AAPL"}  Fresh HIT → 즉시 반환 (외부 0회)
            ├─ [2] Stale HIT → 즉시 반환 + 백그라운드 SWR 갱신
            └─ [3] MISS → single-flight 락으로 외부 1회 호출(사용자 키) → 캐시 채움
```

- 캐시 키에 **사용자/키가 들어가지 않으므로**(§1-4) 사용자 A가 채운 캐시를 사용자 B가 공유한다.
- 동시 요청 폭주는 `QueryExecutor` 의 single-flight 가 1회로 합친다 → 중앙 폴러 불필요.
- ⚠️ 공유 캐시는 일부 데이터 provider ToS(재배포 제한)와 충돌할 수 있음 — 운영 정책으로 검토.

### 6.3 BYOK provider 목록(사용자 선택)

`data_fetcher` 의 기존 provider 를 그대로 BYOK 로 사용: `fmp`, `polygon`, `alphavantage`,
`yahoo`(무키), `fred`, `sec`(무키), `whalewisdom`. 국내 실시간이 필요한 사용자는 `kis`(한국투자증권)
provider 를 추가해 본인 키로 사용(선택). 신규 provider 는 기존 TET 패턴
(`transform_query → aextract_data → transform_data`, standard_models 매핑)을 따른다.

---

## 7. 느린 조회 대응

| 케이스 | 대응 |
|---|---|
| 종목 목록/검색/관심종목 | 데몬이 `MBS_IN_*` 선적재 → DB 인덱스 조회로 즉답 |
| 개별 시세·재무 상세 | BYOK + 공유 SWR 캐시 (첫 호출만 느림, 이후 즉답) |
| ③ 스크리너(대량 정렬·필터) | 1차: 사용자 키로 시장무버/배치쿼리 + 공유캐시. 부족하면 사용자별 **온디맨드 적재 잡**(사용자가 "갱신" 시 본인 키로 N종목 fetch→임시 캐시) 검토. 중앙 일괄 적재는 하지 않음(유료 비용 회피) |

---

## 8. 데몬 스레드 / 스케줄 구성 (`server/worker.py`)

```
worker.main()
 ├─ Thread 1: AnalyzerConsumer  (stream:new_articles → PROC/CALC/RCMD)   [뉴스]
 ├─ Thread 2: CommandListener   (backend/Spring 명령: crawl/refresh)
 └─ APScheduler
       news_crawl_job    (매시)            → crawl_with_stream
       universe_kr_job   (매일 새벽)        → KRUniverseCollector.run
       universe_us_job   (주 1회)           → USUniverseCollector.run
```

> 중앙 실시간 폴러 스레드 없음(§1 결론). graceful shutdown 은 기존 `signal_handler` 그대로.

---

## 9. Redis 키 스키마 (단순화)

| 키 | 타입 | 용도 | 쓰기 |
|---|---|---|---|
| `qe:{provider}:{model}:{params}` | String | BYOK 데이터 **데이터단위 공유 캐시**(SWR) | QueryExecutor |
| `qe:{…}:f` | String | 신선도 플래그(원본 TTL) | QueryExecutor |
| `stream:new_articles` | Stream | 뉴스 IN→PROC 트리거 | crawler |
| `marketpulse:commands` | List | backend → 데몬 명령 | backend |
| `marketpulse:status` | Pub/Sub | 데몬 → backend 상태 | 데몬 |

> 이전 설계의 `rt:*` 실시간 스냅샷 네임스페이스는 **제거**(BYOK + `qe:*` 공유캐시로 대체).

---

## 10. 모듈 구조 (변경 요약)

```
index_analyzer/
├── collectors/            ★신규  universe/(kr_listing, us_listing) + base
├── ingest/               ★신규  repository(bulk upsert)
├── services/             crawl/sentiment/ticker (뉴스). stock_service → universe 로 마이그레이션
├── pipeline/             in/proc/calc/rcmd (뉴스 전용, 유지)
├── server/               worker/scheduler/consumer/redis_bus/command_handler (실시간폴러 제외)
└── models/orm/           ingest(MBS_IN_*)/process/calc/recommend/user

data_fetcher/
└── providers/
    ├── krx/listing.py           ★신규  무료 (KOSPI/KOSDAQ)
    ├── nasdaqtrader/listing.py  ★신규  무료 (NYSE/NASDAQ)
    └── (기존)                    BYOK provider 들 (fmp/polygon/yahoo/…)
```

---

## 11. 스케일업

| 병목 | 대응 |
|---|---|
| 종목 수 증가 | universe 는 `targets()` 만 커짐. bulk upsert(`ingest_batch_id`) |
| BYOK 외부 호출 폭주 | 데이터단위 공유캐시 + single-flight 로 사용자 수와 무관하게 데이터당 1회 |
| provider rate limit | `QueryExecutor` circuit_breaker(사용자 키별/ provider별) |
| 데몬 단일 인스턴스 | collector stateless → 컬렉터별 프로세스/컨테이너 수평 확장 |

---

## 12. 구현 순서

1. `data_fetcher/providers/nasdaqtrader/listing.py` — US 종목 리스트(무료) + provider 등록
2. `data_fetcher/providers/krx/listing.py` — KR 종목 리스트(pykrx) + provider 등록
3. `index_analyzer/ingest/repository.py` — `MBS_IN_STBD_MST`/`INDX_STBD`/`INDX_MEMBER` bulk upsert
4. `index_analyzer/collectors/base.py` + `collectors/universe/{kr,us}_listing.py`
5. `server/scheduler.py` — `universe_kr_job`/`universe_us_job` 등록(기존 S&P500 잡 대체)
6. backend `GET /api/stocks` — `MBS_IN_*` 조회 엔드포인트
7. (이후) BYOK: `UserApiKey` 저장 + backend 조회 시 `QueryExecutor(credentials=user_key)` 연결

---

## 부록. 입수(IN) ORM 테이블 현황 (4지수·BYOK 체제 기준)

| 테이블 | 상태 | 채우는 주체 |
|---|---|---|
| `MBS_IN_STBD_MST` | **활성** | 데몬 universe |
| `MBS_IN_INDX_STBD` | **활성** (4행) | 데몬 universe |
| `MBS_IN_INDX_MEMBER` | **활성** | 데몬 universe |
| `MBS_IN_ARTICLE` | **활성** | 데몬 crawler |
| `MBS_IN_STK_PROFILE` | 보조 | (선택) 일배치/BYOK — 플래그 컬럼 legacy |
| `MBS_IN_STK_STBD` | legacy/보류 | BYOK 전환 (데몬 미적재) |
| `MBS_IN_FINANCIAL_METRICS` | legacy/보류 | BYOK 전환 (데몬 미적재) |
| `MBS_IN_STK_RELATIONS` | 보류 | (peer/경쟁사 — 필요 시 BYOK) |
| `MBS_IN_ETF/BOND/CMDTY_STBD`, `BOND_ISSUANCE` | 제거 후보 | — |
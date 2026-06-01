# MarketPulse — Provider / Extension 아키텍처 가이드

> 데이터·분석 로직을 **어디에 둘지** 판단하기 위한 기준 문서.
> OpenBB Platform의 2레이어 모델(Provider / Extension)을 따른다.

---

## 1. 핵심 모델

| 레이어 | 역할 | 예시 |
|-----------|-------------------------------------------|----------------------------------|
| **Provider** | 데이터 소스 연결 (API 호출, 데이터 반환) | fmp, yfinance, fred, polygon, sec |
| **Extension** | 비즈니스 도메인 정의 + 라우터 + 분석 로직 | etf, veighna, technical, econometrics |

한 줄 요약:

- **Provider = "어디서(Where) 가져오는가"** — 외부 API/DB를 두드려 *표준 스키마*로 정규화. 순수 I/O.
- **Extension = "무엇을(What) / 어떻게(How) 다루는가"** — 도메인 커맨드를 정의하고, Provider가 준 데이터를 *분석·가공*해서 노출. 비즈니스 로직.

> 같은 도메인을 여러 소스에서 받을 수 있게 하는 게 Provider 추상화의 목적이다.
> `obb.etf.holdings(symbol="XLK", provider="fmp" | "sec")` 처럼 **Extension은 하나, Provider는 교체 가능**.

---

## 2. 이 저장소에서의 물리적 위치

이 프로젝트는 OpenBB 패턴을 **두 가지 구현체**로 가지고 있다. 둘을 혼동하지 말 것.

| | 디렉토리 | 기반 | 누가 쓰나 |
|---|---|---|---|
| **Provider 레이어** | `data_fetcher/` | 자체 구현(OpenBB 클론, `openbb-core` 미사용) | 백엔드 런타임이 `QueryExecutor`로 호출 |
| **Extension 레이어** | `extensions/` | 진짜 `openbb-core` + poetry 패키지 | 독립 패키지 / `obb.*` SDK (아직 백엔드 미연결) |
| **앱 레이어** | `app/backend/` | FastAPI | HTTP 라우팅·DB·인증·웹소켓 |

```
marketpulse/
├── data_fetcher/              # ── Provider 레이어 ──
│   ├── core/                  #   OBBject, Query, Router, Data (자체 OpenBB 코어)
│   ├── provider.py            #   Provider / ProviderRegistry
│   ├── providers_init.py      #   모든 provider·fetcher 등록 (단일 진입점)
│   ├── fetchers/<provider>/   #   소스별 Fetcher 구현 (fmp/, yahoo/, fred/ …)
│   └── models/<provider>/     #   소스별 표준 모델
│
├── extensions/                # ── Extension 레이어 ──
│   ├── etf/                   #   openbb-etf  (도메인 + provider 위임)
│   │   ├── pyproject.toml     #     [openbb_core_extension] etf = ...:router
│   │   └── openbb_etf/etf_router.py
│   └── veighna/               #   openbb-veighna (순수 분석: momentum/backtest/rank)
│       ├── pyproject.toml     #     [openbb_core_extension] veighna = ...:router
│       └── openbb_veighna/{veighna_router.py, models.py}
│
└── app/backend/               # ── 앱 레이어 ──
    ├── api/routes/            #   FastAPI 라우트 (QueryExecutor 호출)
    └── services/              #   DB·인증·앱 전용 오케스트레이션만 잔류
```

---

## 3. Provider 레이어 (`data_fetcher/`)

### 책임
- 외부 API·DB 호출, 인증(API 키), 레이트리밋, 페이지네이션, 에러 처리
- 응답을 **표준 모델(`data_fetcher/models/`)** 로 정규화
- **상태 없음**: 분석·가공·비즈니스 판단을 하지 않는다

### 패턴
- 각 소스는 `Provider` 객체로 정의되고 `fetcher_dict`(category → Fetcher)를 가진다
- 모든 등록은 `data_fetcher/providers_init.py` 한 곳에서 이뤄진다
- 호출: `QueryExecutor.fetch("<provider>", "<category>", params)` → `OBBject`

### 현재 등록된 Provider (`providers_init.py` 기준)

| Provider | 성격 | 대표 카테고리 |
|---|---|---|
| `fred` | 경제지표 API | gdp, cpi, yield_curve, labor_dashboard … (27) |
| `yahoo` | 주식 데이터 API | stock_price, financials, holders, insider_trading … (21) |
| `fmp` | 펀더멘털 API | quote, income_statement, analyst_data … (13) |
| `polygon` | 시장/뉴스 API | news, earnings, options, technical_indicators (7) |
| `alphavantage` | 시세/FX/크립토 API | quote, timeseries, forex, crypto (5) |
| `sec` | EDGAR 공시 | insider_trading, institutional_13f (3) |
| `whalewisdom` | 13F 보유 | institutional_holdings, institutions_list (2) |
| `social` | 소셜 감성 수집 | sentiment (1) |
| `db` | 로컬 SQLite | index_constituents, stock_list (2) |
| ⚠️ `quantlib` | **계산(외부 API 아님)** | pricing |
| ⚠️ `quantitative` | **분석(외부 API 아님)** | summary, normality, capm, rolling, unitroot |

> ⚠️ 표시 2개는 데이터 소스가 아니라 **분석 로직**이다. → §6 참조.

---

## 4. Extension 레이어 (`extensions/`)

### 책임
- **비즈니스 도메인**을 커맨드로 정의 (`Router` + `@router.command`)
- 두 가지 형태로 존재:
  1. **도메인형(provider 위임)** — 직접 계산하지 않고 `model="..."`로 Provider에 데이터 요청
     예: `extensions/etf` → `holdings`, `sectors`, `nport_disclosure`
  2. **분석형(self-contained)** — 입력 데이터를 받아 *직접 계산*. Provider 불필요
     예: `extensions/veighna` → `momentum`, `backtest`, `rank_universe`
- 출력은 `OBBject[Model]`, 스키마는 extension 내부 `models.py`에 정의

### 패턴
- 자체 `pyproject.toml` + `poetry.lock` + `tests/`로 **독립 배포 가능**
- `[tool.poetry.plugins."openbb_core_extension"]` 엔트리포인트로 `obb.*` 에 등록
- 도메인형: `return await OBBject.from_query(Query(**locals()))`
- 분석형: `data: list[Data]`를 받아 계산 후 `OBBject(results=...)` 반환 (POST)

### 현재 Extension

| Extension | 형태 | 커맨드 | 비고 |
|---|---|---|---|
| `etf` | 도메인형 | search, holdings, info, sectors, countries, price_performance, nport_disclosure, equity_exposure | OpenBB 표준 패키지 vendoring |
| `veighna` | 분석형 | momentum, backtest, rank_universe | 자체 알파/백테스트 로직 |

---

## 5. 판단 기준 — "어떤 경우에 어디로 빼는가"

새 코드를 작성할 때 다음 순서로 묻는다.

### Q1. DB·인증·세션·웹소켓·유저 상태에 묶여 있는가?
→ **예: `app/backend/services/`** (extension/provider 아님)
포트폴리오, 워치리스트, 알림, 노트, 워크스페이스, 메뉴, export, 권한 — 전부 여기.
판별식: *유저가 누군지 알아야 하거나, 상태를 영속화하면* 앱 레이어다.

### Q2. 외부 API/DB에서 데이터를 가져와 표준 스키마로 변환하는 일인가?
→ **예: Provider (`data_fetcher/fetchers/<provider>/`)**
새 데이터 소스이거나, 기존 소스의 새 엔드포인트. 순수 I/O.
판별식: *네트워크/DB를 두드리고, 분석 판단은 하지 않으면* Provider다.

### Q3. 입력 데이터를 받아 분석·가공·시뮬레이션하는 순수 로직인가?
→ **예: Extension (`extensions/<name>/`)**
팩터 계산, 백테스트, 통계, 지표, 가격결정 모델.
판별식: *`(입력 데이터) → (분석 결과)` 로 성립하고 유저·DB·HTTP를 모르면* Extension(분석형)이다.

### Q4. 여러 Provider를 한 도메인 인터페이스로 묶고 싶은가?
→ **예: Extension (도메인형)**
`provider=` 만 바꿔 같은 커맨드를 쓰게 하려면 도메인형 Extension으로 라우터를 정의.

### 결정 플로우
```
상태(DB/auth/세션) 결합?  ──예──▶  app/backend/services/
        │아니오
외부에서 데이터를 가져옴?  ──예──▶  data_fetcher/  (Provider)
        │아니오 (입력→출력 순수 로직)
분석/계산 로직?           ──예──▶  extensions/    (Extension)
```

### 빠른 체크리스트 — Extension으로 빼도 되는가
- [ ] 유저가 누군지, 세션이 뭔지 **몰라도** 동작한다
- [ ] DB/Redis/웹소켓에 직접 접근하지 **않는다**
- [ ] 입출력을 표준 모델(`Data`/`OBBject`)로 표현할 수 있다
- [ ] 떼어내서 단독 테스트가 가능하다 (자체 `tests/`)
- [ ] 다른 프로젝트나 `obb.*` SDK로 노출할 가치가 있다

5개가 모두 ✅ → Extension. 데이터 출처 연결이 핵심이면 → Provider. 하나라도 상태에 묶이면 → 앱 레이어.

---

## 6. 알려진 미스매치 & 정리 대상

### 6-1. `quantitative` / `quantlib` 가 Provider에 잘못 있음 ⚠️
`providers_init.py`에서 둘 다 `Provider`로 등록돼 있으나:
- `quantlib`: *"local quantitative computation (**no external API**)"*, `credentials=[]`
- `quantitative`: *"descriptive stats, normality, CAPM, rolling, ADF"*

→ **데이터 소스가 아니라 분석 로직**이다. 2레이어 모델 기준 **Extension**이어야 한다
(OpenBB 본가에서도 `openbb-quantitative`, `openbb-technical`, `openbb-econometrics`는 provider가 아니라 extension).
`extensions/veighna`(분석형)와 정확히 같은 부류 → 같은 위치로 가는 게 일관적이다.

**권고 방향:** `quantitative`·`quantlib`를 `extensions/`로 승격하고, 데이터(가격 시계열)는
`data: list[Data]` 입력 또는 도메인형 `model=` 위임으로 받는다. 즉 *"계산"과 "데이터 페칭"을 분리*.

### 6-2. `app/backend/api/routes/quantitative.py` 의 인라인 로직
`correlation`(`quantitative.py:116`)이 라우트 안에서 직접 `yf.download`를 호출한다.
→ 데이터 페칭은 Provider로, 상관계산은 Extension(분석형)으로 분리되어야 할 전형적 후보.
현재는 앱 레이어에 분석+페칭이 함께 박혀 있어 계층이 깨져 있다.

### 6-3. 최상위 `veighna/` 디렉토리 중복
최상위 `veighna/` 는 `extensions/veighna/` 와 **내용이 완전히 동일**(diff 차이 없음)하다. untracked 상태.
→ 제거: `rm -rf veighna`

### 6-4. 큰 그림: `data_fetcher` ↔ `extensions` 의 이중성
Provider 레이어는 자체 OpenBB 클론(`data_fetcher`)이고, Extension 레이어는 진짜 `openbb-core`다.
둘은 `OBBject`·`Data`·`Router`를 각자 따로 갖고 있어 **현재 서로 연결되지 않는다**(`app/backend`에 `import openbb` 없음).
같은 도메인(예: ETF holdings)이 `data_fetcher/fetchers/sec`·`whalewisdom` 와 `extensions/etf` 양쪽에 생길 수 있다.

→ 중장기적으로 **provider 계층을 하나로 수렴**할지 정해야 한다. 선택지:
- **A. data_fetcher 단일화** — extension을 fetcher로 흡수 (백엔드 직결, 단 OpenBB 생태계 포기)
- **B. openbb-core 단일화** — data_fetcher 폐기, 백엔드가 `obb.*` 직접 호출 (대규모 리라이트)
- **C. 역할 분리(현실적)** — `data_fetcher`=런타임 내부 페칭, `extensions`=공개/SDK·실험.
  경계 규칙 명문화: *"네트워크/DB 닿으면 Provider(data_fetcher), 순수 계산이면 Extension"*

---

## 7. 요약 결정표

| 만들려는 것 | 위치 | 레이어 |
|---|---|---|
| 새 데이터 소스 연동 (Bloomberg, Tiingo …) | `data_fetcher/fetchers/<provider>/` | Provider |
| 기존 소스의 새 엔드포인트 | 해당 `fetchers/<provider>/` + `providers_init.py` | Provider |
| 팩터/백테스트/통계/지표/가격모델 | `extensions/<name>/` | Extension(분석형) |
| 여러 소스를 한 도메인 커맨드로 묶기 | `extensions/<name>/` (`model=` 위임) | Extension(도메인형) |
| 유저 포트폴리오·워치리스트·알림·노트 | `app/backend/services/` | 앱 |
| 인증·세션·권한·웹소켓·캐시 | `app/backend/` | 앱 |
| 화면 전용 데이터 조합·export·메뉴 | `app/backend/services/` | 앱 |

---

_최종 업데이트: 2026-06-01 · 근거: `providers_init.py`, `extensions/{etf,veighna}`, `app/backend/api/routes/quantitative.py`_
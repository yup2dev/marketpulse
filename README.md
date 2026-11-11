# MarketPulse

주식·거시경제·포트폴리오를 한 화면에서 보는 금융 데이터 대시보드.
터미널 스타일의 다크 UI 위에 위젯을 배치하고, 여러 데이터 소스를 통합해 시세·재무·뉴스·13F·거시지표를 제공한다.

- **Frontend**: React + Vite (Vercel 배포)
- **Backend**: FastAPI (AWS Lightsail, Docker)
- **데이터 수집**: `MarketpulseBatch`(적재 배치·크롤러) + `MarketpulseFetcher`(통합 조회 시스템)
- **저장소**: SQLite (`data/marketpulse.db`) · Redis(캐시)

---

## 아키텍처

```
┌──────────────┐     HTTPS/WSS      ┌────────────────────────┐
│  Frontend    │ ─────────────────▶ │  Backend (FastAPI)     │
│  React+Vite  │  /api, /ws         │  MarketpulseWeb        │
│  (Vercel)    │ ◀───────────────── │                        │
└──────┬───────┘                    │  ├─ QueryExecutor      │ ← data_fetcher 라이브러리
       │ 로그인 토큰 전달             │  │   ├ 서버 직접 조회   │
       │ (127.0.0.1:8765)           │  │   └ Fetcher 위임     │
       ▼                            │  ├─ user_key_service   │ ← 사용자 API 키(Fernet 암호화 DB)
┌──────────────┐                    │  └─ /api/ingest        │ ← 배치 적재 데이터 수신
│ 로컬 Fetcher  │  /ws/fetcher       └───────┬────────▲───────┘
│ (사용자 PC)   │ ◀── 워커풀 합류 ──────────┘        │ HTTP bulk upsert
│ data_fetcher │                            │        │
└──────────────┘                    ┌───────▼─────┐  │   ┌──────────────────┐
                                    │ SQLite      │  └── │ Batch (로컬 PC)   │
                                    │ Redis 캐시   │      │ 적재 → 로컬 DB    │
                                    └─────────────┘      └──────────────────┘
```

코드는 최상위 폴더 3개로 나뉜다 — **Web**(서버+프론트), **Fetcher**(데이터 조회 라이브러리 + 사용자 PC용 exe),
**Batch**(적재 배치). `data_fetcher` 는 한 벌의 코드가 세 곳에서 돈다: 서버 프로세스 안, 배치 프로세스 안,
사용자 PC 의 exe 안.

---

## 동작 구조

### 조회 요청 한 건의 흐름

```
위젯 ─ apiClient ─▶ auth_gate ─▶ 라우트 ─▶ QueryExecutor.fetch(provider, model, params)
        Bearer         │           │              │
                       │           │              ├ [1] 캐시 fresh HIT ─────────────▶ 즉시 반환
                  user_id 를       │              ├ [2] 캐시 stale HIT ─▶ 즉시 반환 + 백그라운드 갱신(SWR)
                  contextvar 에    │              └ [3] MISS ─▶ single-flight 락 ─▶ 업스트림 1회 호출
                  심는다           │                                  │
                                   │                 ┌────────────────┴───────────────┐
                                   │                 ▼                                ▼
                                   │        사용자 PC Fetcher 로 위임          서버가 직접 호출
                                   │        (/ws/fetcher 워커)               (사용자 키 · 서킷브레이커)
                                   ▼
                          OBBject { results, provider, warnings … }  ← 프론트는 `res.results` 를 읽는다
```

- **라우트는 두 종류다.** `/api/data/{provider}/{model}` 은 범용 게이트웨이로, `providers_init.py` 에 등록된
  fetcher 를 그대로 노출한다 (fetcher 를 추가해도 라우트를 고칠 필요가 없다). 여러 fetcher 를 조합하거나
  DB 를 읽는 화면은 전용 라우트(`/api/stock/*`, `/api/macro/*`, `/api/portfolio/*` …)가 서비스 계층을 거친다.
- **캐시는 백엔드에만 있다.** 값은 TTL×2 동안, 신선도 플래그는 TTL 동안 보관한다. 플래그만 만료되면 옛 값을
  즉시 돌려주고 뒤에서 갱신한다. TTL 은 모델별로 다르다 (시세 30~60초, 뉴스 5분, 재무 30분 … `query_executor.py`
  의 `_DEFAULT_TTL`). Redis 가 없으면 인메모리로 동작한다.
- **서킷브레이커**는 provider 단위다. 열려 있으면 stale 값이라도 돌려주고, 없으면 503 + `Retry-After`.

### 분기 처리 — 어디서 실행되는가

분기는 한 곳(`QueryExecutor._upstream_fetch`)에 모여 있다. 위에서부터 순서대로 판정한다.

| # | 조건 | 처리 |
|---|------|------|
| 1 | **로컬 실행 필수** — provider 가 `yahoo` 이거나, 13F 원본 파싱 모델(`sec/institutional_13f`·`fund_performance`·`institutions_list`, `whalewisdom/institutional_holdings`·`institutions_list`) **이고** 위임 transport 가 설정됨 | 요청한 **그 사용자의** PC Fetcher 로만 위임. 서버 직접 호출로 폴백하지 않는다. 워커가 없거나 사용자 컨텍스트가 없으면(배경 작업) 오류 |
| 2 | 13F 원본 파싱 모델인데 위임 transport 가 없는 **서버** | 실행 거부 — 작은 운영 서버에서 파싱하면 메모리로 죽는다. 화면은 배치가 적재한 DB(`/api/portfolio/13f`)를 읽는다 |
| 3 | **키가 필요한 provider** (FRED·FMP·Polygon·AlphaVantage·KIS·ECOS …) + 로그인 사용자 | 서버가 직접 호출하되 **그 사용자가 등록한 키**(DB, Fernet 복호화)로 호출. 키가 없으면 운영자 키로 폴백하지 않고 오류 |
| 4 | 키가 필요한 provider + 사용자 컨텍스트 없음 (서버 배경 작업·배치) | 환경변수의 운영자 키로 호출 |
| 5 | 그 외 — 무키 공개 API(SEC·IMF·OECD·BLS …), 적재 DB 조회(`db`), 계산(`quantlib`·`quantitative`) | 서버가 직접 실행 |

1번이 "위임 transport 가 설정됐을 때만" 인 이유: Fetcher exe 와 배치도 같은 `QueryExecutor` 를 쓴다. 그쪽은
transport 가 없으므로 1·2번을 건너뛰고 직접 실행한다 — 즉 **위임의 끝(leaf)** 이다.

**위임 방식은 서버 설정으로 정한다** (`core/config.py`, 기동 시 `core/lifespan.py` 가 주입):

| `FETCHER_REMOTE_ENABLED` | `FETCHER_WORKER_MODE` | 동작 |
|---|---|---|
| `false` | — | 위임 없음. 서버가 yahoo 까지 직접 호출한다 (로컬 개발용) |
| `true` | `true` | **운영 구성.** 사용자 PC 의 Fetcher 가 `/ws/fetcher` 로 먼저 접속(outbound)해 워커풀에 합류하고, 서버는 그 연결로 요청을 내려보낸다. NAT·방화벽 뒤 PC 도 된다 |
| `true` | `false` | 서버가 `FETCHER_URL`(기본 `http://127.0.0.1:8765`)의 Fetcher REST `/fetch` 를 호출. 서버와 Fetcher 가 같은 PC 에 있을 때 |

**실패했을 때 프론트가 받는 것** — 위젯은 `stateFromError()` 로 안내 화면을 고른다:

| 상황 | 응답 | 위젯 표시 |
|------|------|-----------|
| 사용자가 그 provider 의 키를 등록하지 않음 | `424` + `code: "missing_key"`, `provider` | "키 등록" 안내 (`/settings`) |
| Fetcher 워커 미접속·타임아웃 / 13F 파싱 모델을 서버에서 호출 | `503` | "Fetcher 실행" 안내 |
| 서킷브레이커 OPEN (stale 값도 없음) | `503` + `Retry-After` | 〃 |
| 토큰 만료·미인증 | `401` | refresh 시도 → 실패 시 `/login` |
| 그 밖의 조회 오류 | `502` (외부 API 오류는 그 상태코드에 맞춰 변환) | 오류 메시지 |

키 미등록에 401/403 을 쓰지 않는 이유는 `apiClient` 가 그 둘을 세션 만료로 보고 로그아웃시키기 때문이다.
범용 게이트웨이(`/api/data/*`)는 조회 오류를 자체적으로 `404`(provider·model 없음) / `400` 으로 내려준다.

**provider 를 고르는 분기**도 있다. 같은 지표를 여러 provider 가 제공하면(`/api/concepts/{concept}`),
그 국가를 지원하는 구현 중 사용자가 쓸 수 있는 것(무키이거나 키 등록됨)을 순서대로 고른다. 전부 키가 없으면
첫 구현으로 호출해 424 가 나가게 한다 — 그래서 사용자는 키만 등록하면 화면이 채워진다.

### Fetcher 활용 — 같은 코드, 세 곳

| 어디서 | 어떻게 | 무엇을 |
|--------|--------|--------|
| **서버 프로세스** | `import data_fetcher` 후 `QueryExecutor.configure(cache, remote, credential_resolver, server_mode=True)` | 키 기반·무키 provider 직접 조회, 캐시, 위임 판단 |
| **사용자 PC (exe)** | Rust 런처가 내장 Python 으로 `data_fetcher.app` 실행. `127.0.0.1:8765` REST + `/ws/fetcher` 워커 | 서버 IP 에서 막히는 조회(yahoo)와 13F 원본 파싱 |
| **배치 프로세스** | 수집기가 `QueryExecutor` 를 직접 호출 | 적재용 원천 데이터 수집 (yahoo·SEC 13F·FMP …) |

**사용자 PC Fetcher 가 워커풀에 붙는 과정**

1. 사용자가 exe 를 실행하면 트레이에 상주하며 `127.0.0.1:8765` 를 연다.
2. 웹앱이 로그인·토큰 갱신 때마다 access token 을 `POST http://127.0.0.1:8765/user-token` 으로 넘긴다
   (`utils/fetcherToken.js`). Fetcher 가 꺼져 있으면 조용히 무시된다.
3. Fetcher 가 그 토큰으로 `wss://…/ws/fetcher?token=…` 에 접속한다. 서버는 토큰의 user_id 로 워커를 등록한다.
4. 그 사용자의 요청 중 "로컬 실행 필수"에 해당하는 것만 이 연결로 내려가고, Fetcher 가 실행해 결과를 돌려준다.
   캐시는 서버에 남으므로 같은 조회가 반복되면 PC 까지 내려가지 않는다.

토큰이 바뀌면(재로그인·다른 계정) Fetcher 가 파일 변경을 감지해 재접속한다 — 재시작이 필요 없다.

**새 데이터 소스를 붙이는 순서**: `providers/<name>/models/` 에 fetcher 작성 → `providers_init.py` 등록 →
`/api/data/<name>/<model>` 로 바로 호출됨 → 프론트 `registry/widgetEndpoints.js` 에 위젯 등록.
서드파티 의존성이 생기면 `MarketpulseFetcher/requirements.txt` 와 `build/requirements-fetcher.txt` 양쪽에 넣는다.

### 적재 데이터 흐름 (Batch → Web)

랭킹·13F·환율처럼 미리 모아 둬야 하는 데이터는 조회 시점에 외부를 부르지 않고 DB 를 읽는다.

```
로컬 PC (작업 스케줄러 07:30, jobs/daily_ingest.bat)
  backfill_stk_stbd → collect_fx → collect_13f(일요일만) ─▶ 로컬 SQLite
  sync_db_to_cloud ── POST /api/ingest/{table} (admin JWT, 증분 bulk upsert) ─▶ 서버 DB
                                                                                  │
서버: `db` provider · 서비스 계층이 이 테이블을 읽어 화면에 낸다 ◀────────────┘
```

13F 원본 파싱을 서버에서 하지 않는 것도 같은 이유다 — 무거운 일은 로컬 배치가 하고, 서버는 결과만 받는다.

---

## 디렉토리 구조

```
marketpulse/
├── MarketpulseWeb/                # 웹 — 서버(Docker)와 프론트(Vercel)
│   ├── requirements.txt           # 서버 런타임 의존성 (Docker 이미지가 설치)
│   └── app/
│       ├── backend/               # FastAPI (패키지 app.backend)
│       │   ├── main.py            # 조립만: core/lifespan + auth_gate + api/routers
│       │   ├── api/routes/        # auth, keys, data, concepts, stock, macro, portfolio, ingest, ws ...
│       │   ├── services/          # 비즈니스 로직 (user_key_service, auth_service ...)
│       │   ├── models/            # 웹 ORM — 스키마 주인 (alembic 이 이 metadata 를 본다)
│       │   └── core/              # config, db, lifespan, middleware, cache,
│       │                          #   fetcher_pool · fetcher_ws_transport · fetcher_client (위임)
│       └── frontend/              # React + Vite (vercel.json)
├── MarketpulseFetcher/            # 데이터 조회 라이브러리 + 사용자 PC 용 exe
│   ├── requirements.txt           # data_fetcher 라이브러리 의존성 (Web·Batch 가 -r 로 포함)
│   ├── data_fetcher/              # providers/, query_executor.py, server/(exe REST·WS 워커)
│   ├── launcher/                  # Rust 런처 (트레이·스킴 등록·내장 Python 실행)
│   └── build/                     # build.py + requirements-fetcher.txt (exe 용 버전 고정 lock)
├── MarketpulseBatch/              # 스케줄러(외부 C 스케줄러)가 실행하는 프로그램
│   ├── requirements.txt           # 배치 의존성
│   ├── jobs/                      # 적재 배치: backfill_stk_stbd, collect_fx, collect_13f,
│   │                              #   collect_sp500, load_all_relations, sync_db_to_cloud ...
│   ├── index_analyzer/            # 수집기(collectors), 뉴스 크롤러·분석(Redis worker)
│   │   └── db/                    # 배치 ORM·엔진 (로컬 적재 DB, 웹과 공유하지 않음)
│   └── sites.yaml                 # 크롤링 대상 사이트
├── migrations/                    # alembic (baseline + 리비전)
├── tests/                         # 테스트 (Fetcher 단위 테스트는 data_fetcher/tests)
├── scripts/                       # 개발 도구: smoke 테스트, 이식 도구, 일회성 설정
├── Dockerfile  docker-compose.yml
├── requirements.txt               # 위 세 파일 + dev 를 모은 것 (로컬 개발·CI)
└── requirements-dev.txt           # pytest·린트 도구
```

**의존 방향**: `Web → Fetcher`, `Batch → Fetcher`. 공통 모듈은 없다 — Web 과 Batch 는 서로 import
하지 않고, 각자 ORM·DB 엔진·로거·경로를 따로 갖는다. Fetcher 는 Web·Batch 를 import 하지 않는다
(`tests/test_module_boundaries.py` 가 검사). Fetcher 가 서버의 캐시·사용자 키를 쓸 수 있는 건 서버가
기동할 때 `QueryExecutor.configure()` 로 **주입**하기 때문이다.

Web 과 Batch 가 맞춰야 하는 건 코드가 아니라 **`/api/ingest` 요청 형식**이다. 배치는 로컬 DB 에 적재하고
`jobs/sync_db_to_cloud.py` 가 HTTP 로 웹에 보낸다. 같은 테이블을 양쪽이 따로 정의하므로, 컬럼이
어긋나면 `tests/test_ingest_contract.py` 가 실패한다. 스키마의 주인은 웹이다 (alembic).

**의존성도 배포 단위별로 나뉜다.** 패키지를 추가할 때는 루트가 아니라 실제로 import 하는 쪽 파일에 적는다.
`data_fetcher` 가 이미 요구하는 패키지는 Web·Batch 파일에 다시 적지 않는다.

| 파일 | 설치하는 곳 |
|------|-------------|
| `MarketpulseFetcher/requirements.txt` | Web·Batch 가 `-r` 로 포함 |
| `MarketpulseWeb/requirements.txt` | Docker 이미지 (서버) |
| `MarketpulseBatch/requirements.txt` | 배치를 돌리는 PC |
| `requirements-dev.txt` | 개발·CI |
| `requirements.txt` | 위 전부 — 로컬 개발·CI 는 이것 하나로 설치 |
| `MarketpulseFetcher/build/requirements-fetcher.txt` | exe 빌드 (버전 고정, 용량 때문에 일부 provider 의존성 제외) |

패키지 이름(`app`, `data_fetcher`, `index_analyzer`)은 소문자 그대로이고, 진입점마다 필요한 폴더만
import 경로에 넣는다 (Docker 는 `PYTHONPATH`, 직접 실행하는 진입점은 파일 상단의 `mp-bootstrap` 블록,
pytest 는 `pyproject.toml` 의 `pythonpath` 로 전부).

데이터 파일(`data/`, `logs/`, `.env`)은 저장소 루트에 있다. 웹은 `app.backend.core.paths`, 배치는
`index_analyzer.paths` 로 찾는다.

---

## 기술 스택

| 영역 | 사용 |
|------|------|
| Frontend | React 18, Vite, React Router, Zustand, TanStack Table, Plotly, Tailwind, react-grid-layout |
| Backend | FastAPI, Uvicorn, SQLAlchemy 2, Pydantic v2, python-jose(JWT), passlib/bcrypt, cryptography(Fernet) |
| 데이터 | SQLite, Redis, aiohttp/requests, BeautifulSoup/lxml, pandas, yfinance |
| 인프라 | Docker, AWS Lightsail, GitHub Actions, Docker Hub, Vercel |

---

## 로컬 개발

### 1) 백엔드

```bash
# (권장) 가상환경
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt          # 서버 + 배치 + dev 전부
# 서버만 띄울 거면: pip install -r MarketpulseWeb/requirements.txt

# 환경변수 — 루트 .env 참고 (SECRET_KEY 필수)
# 최소: SECRET_KEY, CORS_ORIGINS=["http://localhost:5173"]
# Fetcher 없이 서버가 yahoo 까지 직접 부르게 하려면: FETCHER_REMOTE_ENABLED=false

# 실행 (http://localhost:8000)
uvicorn app.backend.main:app --app-dir MarketpulseWeb --reload --host 0.0.0.0 --port 8000
```

DB는 `data/marketpulse.db`(SQLite). 최초 기동 시 테이블/메뉴 초기화가 수행된다. Redis는 캐시용(선택) — `docker compose up -d redis`로 띄울 수 있다.

### 2) 프론트엔드

```bash
cd MarketpulseWeb/app/frontend
npm install

# ⚠️ 로컬 백엔드를 바라보게 .env.local 생성 (없으면 운영 API로 감)
echo 'VITE_API_URL=http://localhost:8000' > .env.local

npm run dev      # http://localhost:5173
npm run build    # 프로덕션 빌드 (dist/)
npm run lint
```

> `VITE_API_URL`이 비면 `config/api.js`가 `http://localhost:8000`으로 폴백한다.
> 운영 URL은 `.env.production`(또는 Vercel 환경변수)으로만 주입한다 — 폴백을 운영 서버로 두면
> `.env` 없이 dev 서버를 띄운 개발자가 운영 API를 직접 때리게 된다.

### 3) 로컬 Fetcher (선택)

Yahoo 등 일부 소스는 서버 고정 IP에서 차단되므로 사용자 PC의 Fetcher가 대신 조회한다.
[Releases](https://github.com/yup2dev/marketpulse/releases/latest)에서 받아 실행하면
트레이에 상주하고, 웹앱 로그인 시 토큰이 자동 전달되어 클라우드 워커 풀에 합류한다.
(동작 방식은 위 [Fetcher 활용](#fetcher-활용--같은-코드-세-곳) 참고)

### 4) 테스트

```bash
pytest                    # 전체
pytest tests/             # 백엔드만
```

---

## 인증 흐름

- 로그인 → access/refresh JWT 발급. access token 은 **메모리**에만 두고, refresh token 은 **httpOnly 쿠키**로 받는다
  (`localStorage` 에 두지 않는다 — XSS 로 읽힌다). 새로고침하면 `/auth/refresh` 로 access token 을 다시 받는다.
- `apiClient`(`config/api.js`)가 모든 `/api` 요청에 Bearer 주입. **401** 응답 시 자동으로 `/auth/refresh` 시도 → 성공하면 재시도, 실패하면 `forceLogout()` → `ProtectedRoute`/`AuthGuard`가 `/login`으로 리다이렉트.
- 백엔드는 `auth_gate` 미들웨어가 **deny-by-default** 로 동작한다 — 공개 목록(`/`, `/health`, 로그인·가입·refresh)에
  없는 모든 경로는 Bearer 가 필요하다. 만료·미인증·자격증명 누락은 **모두 401로 통일**한다.
  통과한 요청의 user_id 는 contextvar 에 심어져 `QueryExecutor` 가 사용자별 키·워커를 고르는 데 쓴다.
- **CORS는 최외곽 미들웨어**여야 한다 — `auth_gate`가 단락(401) 반환하는 응답에도 CORS 헤더가 붙어야 브라우저가 401을 정상 수신하고 리다이렉트가 동작한다.

---

## 배포

### 백엔드 — GitHub Actions → Docker Hub → Lightsail

`main` 브랜치에 `MarketpulseWeb/app/backend/**`, `MarketpulseFetcher/data_fetcher/**`, `migrations/**`, `MarketpulseWeb/requirements.txt`, `MarketpulseFetcher/requirements.txt`, `Dockerfile`, `docker-compose.yml` 변경이 push되면 `.github/workflows/deploy-backend.yml`이 동작한다 (수동: `workflow_dispatch`). 테스트 워크플로가 통과해야 배포로 넘어간다.

1. Docker 이미지 빌드 → Docker Hub `:latest` / `:<sha>` push (이미지에는 `MarketpulseWeb/requirements.txt` 만 설치된다)
2. SSH로 서버 접속 → `docker compose pull app` → `up -d --no-deps --force-recreate app`

운영 API: `https://api.finance.dns-co.kr`. 서버 경로 `/opt/marketpulse`, 컨테이너 `marketpulse-app` + `marketpulse-redis`.

> **주의**: 서버 `.env`는 배포 유저가 읽을 수 있어야 하고(`chmod 600` 유지), 그렇지 않으면 `docker compose`가 실패해 컨테이너가 구버전으로 남는다.

### 프론트엔드 — Vercel

`main` push 시 Vercel Git 연동으로 자동 배포 (Vercel 프로젝트 Root Directory: `MarketpulseWeb/app/frontend`). `vercel.json`이 SPA 리라이트 + COOP 헤더를 설정한다. 백엔드만 바뀐 경우 프론트 재배포는 불필요하다.

---

## 주요 API (요약)

| 경로 | 설명 |
|------|------|
| `/api/auth/*` | 로그인·회원가입·refresh·verify |
| `/api/keys` | 사용자 API 키 관리(암호화 DB) |
| `/api/data/{provider}/{model}` | 범용 데이터 게이트웨이 — 등록된 모든 fetcher. `/schema` 는 파라미터 폼 스펙 |
| `/api/concepts/{concept}` | provider 무관 지표 — 내 키 기준으로 provider 자동 선택 |
| `/api/providers` | provider 목록·키 필요 여부 |
| `/api/stock/*` | 시세·재무·애널리스트·내부자·랭킹 |
| `/api/macro/*` | 거시지표·수익률곡선·물가·고용·레짐 |
| `/api/portfolio/*`, `/api/user-portfolio/*` | 13F·사용자 포트폴리오 |
| `/api/screener/*` | 스크리너 |
| `/api/quantlib/*`, `/api/quantitative/*` | 가격 결정·통계 분석 |
| `/api/watchlist`, `/api/alerts`, `/api/notes`, `/api/workspace` | 관심종목·알림·노트·워크스페이스 |
| `/api/ingest/*` | 배치 적재 데이터 수신 (admin 전용) |
| `/ws/quotes` | 실시간 시세 WebSocket |
| `/ws/fetcher` | 사용자 PC Fetcher 워커풀 (JWT 토큰 쿼리 인증) |

전체 스키마는 `'/openapi.json'`, 문서는 `'/docs'` — `DEBUG=true` 일 때만 열린다.

---

## 참고

- 하위 모듈 상세: [`MarketpulseBatch/index_analyzer/README.md`](MarketpulseBatch/index_analyzer/README.md), [`MarketpulseFetcher/data_fetcher/README.md`](MarketpulseFetcher/data_fetcher/README.md), [`MarketpulseWeb/app/frontend/README.md`](MarketpulseWeb/app/frontend/README.md)
- 데이터 소스: nasdaqtrader·KRX(universe), SEC·IMF·OECD·BLS(무키 공개 API), FRED/FMP/Polygon/AlphaVantage/KIS(키 기반), Yahoo(로컬 실행형)

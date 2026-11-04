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
└──────┬───────┘                    │  ├─ QueryExecutor      │
       │                            │  │   ├ 서버 직접 조회   │
       │                            │  │   └ Fetcher 위임     │
       ▼                            │  ├─ user_key_service   │ ← 사용자 API 키(Fernet 암호화 DB)
┌──────────────┐                    │  └─ scheduler/crawl    │
│ 로컬 Fetcher  │  /ws/fetcher       └───────┬────────────────┘
│ (사용자 PC)   │ ◀── 워커풀 합류 ──────────┘
│ data_fetcher │                            │
└──────────────┘                    ┌───────▼────────┐  ┌─────────┐
                                    │ SQLite          │  │ Redis    │
                                    │ marketpulse.db  │  │ 캐시      │
                                    └─────────────────┘  └─────────┘
```

**데이터 소스 라우팅 (2분류)**
- **Class A — 사용자 PC 실행형**: Yahoo·WhaleWisdom 등 IP 차단 회피가 필요한 소스. 사용자 PC의 Fetcher가 `/ws/fetcher` 워커풀에 합류해 백엔드 요청을 대신 처리한다.
- **Class B — 키 기반 서버 조회형**: FRED·FMP·Polygon·AlphaVantage·KIS 등. 사용자가 웹 설정 화면에서 등록한 API 키를 백엔드 DB에 **Fernet 암호화** 저장하고, 서버가 그 키로 직접 호출한다. (Fetcher 불필요)

---

## 디렉토리 구조

```
marketpulse/
├── MarketpulseWeb/                # 웹 — 서버(Docker)와 프론트(Vercel)
│   └── app/
│       ├── backend/               # FastAPI (패키지 app.backend)
│       │   ├── main.py            # 조립만: core/lifespan + auth_gate + api/routers
│       │   ├── api/routes/        # auth, keys, stock, macro, portfolio, screener, ws ...
│       │   ├── services/          # 비즈니스 로직 (user_key_service, auth_service ...)
│       │   └── core/              # config, db, lifespan, middleware, 메뉴 시드
│       └── frontend/              # React + Vite (vercel.json)
├── MarketpulseFetcher/            # 데이터 조회 라이브러리 + 사용자 PC 용 exe
│   ├── data_fetcher/              # providers/, query_executor.py, server/(exe REST·WS 워커)
│   └── build/                     # PyInstaller spec, build.sh/.bat
├── MarketpulseBatch/              # 스케줄러(외부 C 스케줄러)가 실행하는 프로그램
│   ├── jobs/                      # 적재 배치: backfill_stk_stbd, collect_fx, collect_13f,
│   │                              #   collect_sp500, stock_profile, universe, sync_db_to_cloud ...
│   ├── run_job.py                 # 배치 실행기 (작업·daily 묶음, 종료코드·lock·로그)
│   ├── index_analyzer/            # 수집기(collectors), 뉴스 크롤러·분석(Redis worker)
│   └── sites.yaml                 # 크롤링 대상 사이트
├── MarketpulseCommon/             # 공통 — ORM, DB 세션, 경로(paths.py), 로깅
│   └── marketpulse_common/
├── migrations/                    # alembic (baseline + 리비전)
├── tests/                         # 테스트 (Fetcher 단위 테스트는 data_fetcher/tests)
├── scripts/                       # 개발 도구: smoke 테스트, 이식 도구, 일회성 설정
├── Dockerfile  docker-compose.yml
└── requirements.txt
```

**의존 방향**: `Web → Fetcher → Common`, `Batch → Fetcher → Common`. Web 과 Batch 는 서로 import 하지 않고,
Common 은 다른 패키지를 import 하지 않는다. 패키지 이름(`app`, `data_fetcher`, `index_analyzer`,
`marketpulse_common`)은 소문자 그대로이고, 최상위 폴더 4개를 import 경로에 넣는다
(pytest 는 `pyproject.toml` 의 `pythonpath`, Docker 는 `PYTHONPATH`, 직접 실행하는 진입점은
파일 상단의 `mp-bootstrap` 블록).

데이터 파일(`data/`, `logs/`, `.env`)은 저장소 루트에 있고, 코드는 `marketpulse_common.paths` 로만 찾는다.

---

## 기술 스택

| 영역 | 사용 |
|------|------|
| Frontend | React 18, Vite, React Router, Zustand, TanStack Table, Plotly, Tailwind, react-grid-layout |
| Backend | FastAPI, Uvicorn, SQLAlchemy 2, Pydantic v2, python-jose(JWT), passlib/bcrypt, cryptography(Fernet) |
| 데이터 | SQLite, Redis, aiohttp/requests, BeautifulSoup/lxml, feedparser |
| 인프라 | Docker, AWS Lightsail, GitHub Actions, Docker Hub, Vercel |

---

## 로컬 개발

### 1) 백엔드

```bash
# (권장) 가상환경
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

# 환경변수 — 루트 .env 참고 (SECRET_KEY 필수)
# 최소: SECRET_KEY, CORS_ORIGINS=["http://localhost:5173"]

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

### 4) 배치

적재 배치는 실행기 하나로 돌린다. 언제 돌릴지는 Windows 작업 스케줄러가 정한다
(`MarketpulseBatch/jobs/daily_ingest.bat` → `run_job.py daily`, 매일 07:30).

```bash
python MarketpulseBatch/run_job.py list                  # 작업·묶음 목록
python MarketpulseBatch/run_job.py daily --dry-run       # 오늘 실행 계획 (실행 안 함)
python MarketpulseBatch/run_job.py fx 1y                 # 작업 하나 + 인자
```

- `daily` = universe_kr → universe_us(일) → stk_backfill → fx → 13f(일) → sync_cloud
- 종료 코드 0 성공 / 1 실패 / 2 이미 실행 중 / 3 사용법 오류
- 로그 `logs/batch/<작업>_<YYYYMMDD>.log`, 이력 `logs/batch/history.jsonl`
- 뉴스 크롤링은 배치가 아니라 worker(`cd MarketpulseBatch && python -m index_analyzer.server.worker`, Redis 필요)가 돌린다

### 5) 테스트

```bash
pytest                    # 전체
pytest tests/             # 백엔드만
```

---

## 인증 흐름

- 로그인 → access/refresh JWT 발급, `localStorage` 저장.
- `apiClient`(`config/api.js`)가 모든 `/api` 요청에 Bearer 주입. **401** 응답 시 자동으로 `/auth/refresh` 시도 → 성공하면 재시도, 실패하면 `forceLogout()` → `ProtectedRoute`/`AuthGuard`가 `/login`으로 리다이렉트.
- 백엔드는 `auth_gate` 미들웨어 + `HTTPBearer401`로 만료·미인증·자격증명 누락을 **모두 401로 통일**한다.
- **CORS는 최외곽 미들웨어**여야 한다 — `auth_gate`가 단락(401) 반환하는 응답에도 CORS 헤더가 붙어야 브라우저가 401을 정상 수신하고 리다이렉트가 동작한다.

---

## 배포

### 백엔드 — GitHub Actions → Docker Hub → Lightsail

`main` 브랜치에 `MarketpulseWeb/app/backend/**`, `MarketpulseFetcher/data_fetcher/**`, `MarketpulseCommon/**`, `migrations/**`, `requirements.txt`, `Dockerfile`, `docker-compose.yml` 변경이 push되면 `.github/workflows/deploy-backend.yml`이 동작한다 (수동: `workflow_dispatch`).

1. Docker 이미지 빌드 → Docker Hub `:latest` / `:<sha>` push
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
| `/api/stock/*` | 시세·재무·애널리스트·내부자·랭킹 |
| `/api/macro/*` | 거시지표·수익률곡선·물가·고용·레짐 |
| `/api/portfolio/*`, `/api/user-portfolio/*` | 13F·사용자 포트폴리오 |
| `/api/screener/*` | 스크리너 |
| `/api/watchlist`, `/api/alerts`, `/api/notes`, `/api/workspace` | 관심종목·알림·노트·워크스페이스 |
| `/ws/quotes` | 실시간 시세 WebSocket |
| `/ws/fetcher` | 사용자 PC Fetcher 워커풀 (JWT 토큰 쿼리 인증) |

전체 스키마는 운영/로컬 `'/openapi.json'`, 문서는 `'/docs'`.

---

## 참고

- 하위 모듈 상세: [`MarketpulseBatch/index_analyzer/README.md`](MarketpulseBatch/index_analyzer/README.md), [`MarketpulseFetcher/data_fetcher/README.md`](MarketpulseFetcher/data_fetcher/README.md), [`MarketpulseWeb/app/frontend/README.md`](MarketpulseWeb/app/frontend/README.md)
- 데이터 소스(무료·무로그인): nasdaqtrader·KRX(universe), FRED/FMP/Polygon/AlphaVantage/KIS(키 기반), Yahoo/WhaleWisdom(로컬 실행형)

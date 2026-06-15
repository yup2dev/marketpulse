# MarketPulse

주식·거시경제·포트폴리오를 한 화면에서 보는 금융 데이터 대시보드.
터미널 스타일의 다크 UI 위에 위젯을 배치하고, 여러 데이터 소스를 통합해 시세·재무·뉴스·13F·거시지표를 제공한다.

- **Frontend**: React + Vite (Vercel 배포) · 데스크톱은 Tauri 래퍼
- **Backend**: FastAPI (AWS Lightsail, Docker)
- **데이터 수집**: `index_analyzer`(크롤링 데몬) + `data_fetcher`(통합 조회 시스템)
- **저장소**: SQLite (`data/marketpulse.db`) · Redis(캐시)

---

## 아키텍처

```
┌──────────────┐     HTTPS/WSS      ┌────────────────────────┐
│  Frontend    │ ─────────────────▶ │  Backend (FastAPI)     │
│  React+Vite  │  /api, /ws         │  app/backend           │
│  (Vercel)    │ ◀───────────────── │                        │
└──────┬───────┘                    │  ├─ QueryExecutor      │
       │                            │  │   ├ 서버 직접 조회   │
       │ Tauri 래핑(데스크톱)        │  │   └ Fetcher 위임     │
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
├── app/
│   ├── backend/              # FastAPI 백엔드
│   │   ├── main.py           # 앱 진입점 · 미들웨어(CORS/auth_gate) · 라우터 등록
│   │   ├── api/routes/       # auth, keys, stock, macro, portfolio, screener, ws ...
│   │   ├── services/         # 비즈니스 로직 (user_key_service, auth_service ...)
│   │   ├── core/             # config, db, auth(dependencies/security)
│   │   └── constants/        # 상수
│   └── frontend/             # React + Vite
│       ├── src/
│       │   ├── components/   # core(페이지), widgets(위젯), common, backtest
│       │   ├── config/api.js # API 클라이언트(401 refresh·forceLogout 인터셉터)
│       │   ├── store/        # Zustand (authStore ...)
│       │   ├── hooks/        # useFetcherHealth, useQuoteSocket ...
│       │   └── utils/        # fetcherToken ...
│       └── vercel.json
├── index_analyzer/           # 뉴스 크롤링·분석 + universe 수집 데몬
│   ├── collectors/universe/  # US/KR 종목·ETF·채권 마스터 수집
│   ├── crawling/ parsing/ pipeline/
│   └── models/orm/           # SQLAlchemy ORM (User 등)
├── data_fetcher/             # 통합 데이터 조회 시스템 (OpenBB 패턴)
│   ├── providers/            # yahoo, fred, fmp, polygon, kis, krx, sec, social ...
│   ├── query_executor.py     # 조회 실행 · 서버/Fetcher 라우팅 seam
│   ├── server/  app.py       # 로컬 REST 서버(.exe 패키징)
│   └── tray.py               # 트레이 상주
├── desktop/                  # Tauri 데스크톱 래퍼 (Vercel 프론트 로드 + sidecar fetcher)
│   └── src-tauri/
├── scripts/                  # DB 초기화·시드·백필 스크립트
├── launcher.py / launch.vbs  # Windows 트레이 런처
├── Dockerfile                # 백엔드 컨테이너
├── docker-compose.yml        # app + redis
└── requirements.txt
```

---

## 기술 스택

| 영역 | 사용 |
|------|------|
| Frontend | React 18, Vite, React Router, Zustand, TanStack Table, Plotly/Recharts, Tailwind, react-grid-layout |
| Backend | FastAPI, Uvicorn, SQLAlchemy 2, Pydantic v2, python-jose(JWT), passlib/bcrypt, cryptography(Fernet) |
| 데이터 | SQLite, Redis, aiohttp/requests, BeautifulSoup/lxml, feedparser |
| 데스크톱 | Tauri (Rust) + sidecar fetcher |
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
uvicorn app.backend.main:app --reload --host 0.0.0.0 --port 8000
```

DB는 `data/marketpulse.db`(SQLite). 최초 기동 시 테이블/메뉴 초기화가 수행된다. Redis는 캐시용(선택) — `docker compose up -d redis`로 띄울 수 있다.

### 2) 프론트엔드

```bash
cd app/frontend
npm install

# ⚠️ 로컬 백엔드를 바라보게 .env.local 생성 (없으면 운영 API로 감)
echo 'VITE_API_URL=http://localhost:8000' > .env.local

npm run dev      # http://localhost:5173
npm run build    # 프로덕션 빌드 (dist/)
npm run lint
```

> `VITE_API_URL`이 비면 `config/api.js`가 운영(`https://api.finance.dns-co.kr`)으로 폴백한다. 로컬 백엔드로 테스트하려면 `.env.local`이 반드시 필요하다. (`.env.local`은 `.gitignore`의 `*.local`로 커밋되지 않음)

### 3) 데스크톱 (Tauri, 선택)

```bash
cd desktop
npm install
npm run tauri dev
```

Tauri 앱은 Vercel 프론트를 로드하고 sidecar로 로컬 Fetcher를 기동한다. Windows에서는 `launch.vbs`(트레이 런처)로 상주 실행한다.

---

## 인증 흐름

- 로그인 → access/refresh JWT 발급, `localStorage` 저장.
- `apiClient`(`config/api.js`)가 모든 `/api` 요청에 Bearer 주입. **401** 응답 시 자동으로 `/auth/refresh` 시도 → 성공하면 재시도, 실패하면 `forceLogout()` → `ProtectedRoute`/`AuthGuard`가 `/login`으로 리다이렉트.
- 백엔드는 `auth_gate` 미들웨어 + `HTTPBearer401`로 만료·미인증·자격증명 누락을 **모두 401로 통일**한다.
- **CORS는 최외곽 미들웨어**여야 한다 — `auth_gate`가 단락(401) 반환하는 응답에도 CORS 헤더가 붙어야 브라우저가 401을 정상 수신하고 리다이렉트가 동작한다.

---

## 배포

### 백엔드 — GitHub Actions → Docker Hub → Lightsail

`main` 브랜치에 `app/backend/**`, `requirements.txt`, `Dockerfile`, `docker-compose.yml` 변경이 push되면 `.github/workflows/deploy-backend.yml`이 동작한다 (수동: `workflow_dispatch`).

1. Docker 이미지 빌드 → Docker Hub `:latest` / `:<sha>` push
2. SSH로 서버 접속 → `docker compose pull app` → `up -d --no-deps --force-recreate app`

운영 API: `https://api.finance.dns-co.kr`. 서버 경로 `/opt/marketpulse`, 컨테이너 `marketpulse-app` + `marketpulse-redis`.

> **주의**: 서버 `.env`는 배포 유저가 읽을 수 있어야 하고(`chmod 600` 유지), 그렇지 않으면 `docker compose`가 실패해 컨테이너가 구버전으로 남는다.

### 프론트엔드 — Vercel

`main` push 시 Vercel Git 연동으로 자동 배포. `vercel.json`이 SPA 리라이트 + COOP 헤더를 설정한다. 백엔드만 바뀐 경우 프론트 재배포는 불필요하다.

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

- 하위 모듈 상세: [`index_analyzer/README.md`](index_analyzer/README.md), [`data_fetcher/README.md`](data_fetcher/README.md), [`app/frontend/README.md`](app/frontend/README.md)
- 데이터 소스(무료·무로그인): nasdaqtrader·KRX(universe), FRED/FMP/Polygon/AlphaVantage/KIS(키 기반), Yahoo/WhaleWisdom(로컬 실행형)

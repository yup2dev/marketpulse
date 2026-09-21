"""
Application settings via pydantic-settings
"""
from pydantic import field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict
from typing import Annotated, List, Optional


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        env_ignore_empty=True,
        extra="ignore",
        case_sensitive=False,
    )

    # App
    APP_VERSION: str = "1.0.0"
    APP_NAME: str = "MarketPulse"
    DEBUG: bool = False

    # Security
    SECRET_KEY: str = "dev-only-key-override-in-env"
    # 사용자 API 키 암호화 전용 시크릿(미지정 시 SECRET_KEY에서 파생).
    # 운영에서는 고정값으로 지정해야 SECRET_KEY 교체 시에도 기존 키 복호화가 유지된다.
    API_KEY_ENC_SECRET: str = ""
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    # 사용자 PC Fetcher 워커(/ws/fetcher) 전용 장수명 토큰. 브라우저가 닫혀 있어도
    # 워커가 유지되도록 access(30분)보다 길게 둔다. API/refresh로는 쓸 수 없다(type=fetcher).
    FETCHER_TOKEN_EXPIRE_DAYS: int = 30

    # ── refresh token 쿠키 ────────────────────────────────────────────────────
    # refresh token 은 httpOnly 쿠키로 내린다. localStorage 에 두면 XSS 한 건으로
    # 장기 세션이 통째로 탈취된다(access 는 30분이지만 refresh 는 7일).
    #
    # SameSite 를 설정으로 빼는 이유: 프론트와 API 의 관계가 배포처마다 다르다.
    #   finance.dns-co.kr ↔ api.finance.dns-co.kr  → same-site  (lax 로 충분)
    #   frontend-*.vercel.app ↔ api.finance…       → cross-site (none + secure 필요)
    #   localhost:5173 ↔ localhost:8000            → same-site  (secure 불가, http)
    # 기본값은 운영 커스텀 도메인 기준(lax)이고, 프리뷰 배포에서 로그인 유지가
    # 필요하면 운영 .env 에서 AUTH_COOKIE_SAMESITE=none 으로 올린다.
    AUTH_COOKIE_NAME: str = "refresh_token"
    AUTH_COOKIE_SAMESITE: str = "lax"          # lax | none | strict
    AUTH_COOKIE_DOMAIN: Optional[str] = None   # None 이면 host-only
    # None 이면 DEBUG 의 반대 — 운영은 자동으로 Secure, 로컬 http 개발은 자동으로 해제.
    AUTH_COOKIE_SECURE: Optional[bool] = None

    @property
    def auth_cookie_secure(self) -> bool:
        return (not self.DEBUG) if self.AUTH_COOKIE_SECURE is None else self.AUTH_COOKIE_SECURE

    # CORS — comma-separated in env: CORS_ORIGINS=https://example.com,http://localhost:5173
    CORS_ORIGINS: Annotated[List[str], NoDecode] = [
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:5175",
        "http://localhost:3000",
    ]

    # 배포와 무관하게 항상 허용하는 origin — CORS_ORIGINS(env) 에 '덧붙는다'.
    # 별도 필드로 두는 이유: env 로 CORS_ORIGINS 를 지정하면 위 기본값을 통째로
    # 대체하므로, 여기 있는 것들을 같은 목록에 합쳐두면 운영 env 설정이 Vercel
    # 프론트 origin 을 조용히 지워버린다(프론트 전체가 CORS 로 막힌다).
    CORS_ALWAYS_ALLOWED_ORIGINS: Annotated[List[str], NoDecode] = [
        "https://frontend-yup2devs-projects.vercel.app",  # Vercel 프론트엔드
        "http://localhost",
        "http://127.0.0.1",
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:5175",
    ]

    @field_validator("CORS_ORIGINS", "CORS_ALWAYS_ALLOWED_ORIGINS", mode="before")
    @classmethod
    def _split_cors_origins(cls, v):
        if isinstance(v, str):
            return [origin.strip() for origin in v.split(",") if origin.strip()]
        return v

    @property
    def cors_allow_origins(self) -> List[str]:
        """CORSMiddleware 에 넘길 최종 origin 목록 (등장 순서 유지 + 중복 제거)."""
        merged = dict.fromkeys((*self.CORS_ORIGINS, *self.CORS_ALWAYS_ALLOWED_ORIGINS))
        return list(merged)

    # Database
    SQLITE_PATH: str = "data/marketpulse.db"

    # Redis / Queue
    REDIS_URL: str = "redis://localhost:6379/0"
    QUEUE_ENABLED: bool = False
    SCHEDULER_ENABLED: bool = False

    # Fetcher(exe) 위임 — Backend가 provider를 직접 호출하지 않고 Fetcher로 위임
    FETCHER_REMOTE_ENABLED: bool = True              # True면 모든 조회를 Fetcher로 위임
    FETCHER_URL: str = "http://127.0.0.1:8765"        # Fetcher REST 주소 (HTTP/pull 모드)
    FETCHER_TOKEN: str = ""                            # Fetcher와 공유하는 인증 토큰
    FETCHER_TIMEOUT: float = 90.0   # batch_quotes 등 수백 종목 일괄 조회는 30s를 초과할 수 있음
    # True: 사용자 PC의 Fetcher가 /ws/fetcher 로 outbound 접속해 위임받는 워커 풀 모드(push).
    # NAT/방화벽 뒤의 PC도 동작 가능. False(기본): 위 FETCHER_URL로 직접 호출(pull, HTTP).
    FETCHER_WORKER_MODE: bool = False

    # Crawler
    CRAWLER_MAX_WORKERS: int = 5
    CRAWLER_TIMEOUT: int = 30
    CRAWLER_MAX_RETRIES: int = 3
    USE_TRANSFORMERS: bool = False
    MARKET_DATA_INTERVAL_HOURS: int = 6

    # Logging
    LOG_LEVEL: str = "INFO"
    LOG_FILE: str = "logs/app.log"

    # Copilot (AI 어시스턴트) — 키는 'API 키 관리'(사용자별 DB)가 우선, 아래는 서버 폴백.
    ANTHROPIC_API_KEY: Optional[str] = None
    COPILOT_MODEL: str = "claude-opus-4-8"
    GEMINI_API_KEY: Optional[str] = None            # 무료 티어: aistudio.google.com
    COPILOT_GEMINI_MODEL: str = "gemini-2.5-flash"
    OPENAI_API_KEY: Optional[str] = None
    COPILOT_OPENAI_MODEL: str = "gpt-4o-mini"

    # API Keys
    FRED_API_KEY: Optional[str] = None
    ALPHA_VANTAGE_API_KEY: Optional[str] = None
    POLYGON_API_KEY: Optional[str] = None
    FMP_API_KEY: Optional[str] = None


settings = Settings()
